#!/usr/bin/env python3
"""g4d-v3-vendor-hosts-sync (E11d). Runs on the web server HOST, installed as /usr/local/sbin/g4d-v3-vendor-hosts-sync.

Keeps ONE nginx file, /etc/nginx/conf.d/v3-vendor-hosts.conf, equal to the list of vendor host names that Version 3 serves (GET /v3/public/site/hosts).
No Version 2 or shared file is ever written. The one other file it touches: on the first run it moves aside the hand-made Version 3 file it replaces.

Every doubt means "change nothing". Every failure after a change means "put the previous files back".

Exit codes:  0 done, or nothing to do      1 refused, nothing changed
             2 the change failed and was undone      3 the change failed and UNDOING IT FAILED: a person must look now

Settings come from the environment (defaults are the server's own paths), so the tests can run it in a temporary folder with a fake nginx and systemctl.
Python 3.8 or newer, standard library only.
"""
import argparse
import datetime
import http.client
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.parse
import urllib.request

DEFAULTS = {
    'G4D_API_URL': 'http://10.77.0.50:3008/v3/public/site/hosts',
    'G4D_CONF': '/etc/nginx/conf.d/v3-vendor-hosts.conf',
    'G4D_REPLACES': '/etc/nginx/sites-enabled/v3-vendor-sites.get4domain.com.conf',
    'G4D_BACKUP_DIR': '/var/backups/g4d-nginx',
    'G4D_STATE_DIR': '/var/lib/g4d',
    'G4D_NGINX': 'nginx',
    'G4D_SYSTEMCTL': 'systemctl',
    'G4D_PROBE_URL': 'http://127.0.0.1:80/',
    'G4D_V2_PROBE_HOST': 'get4domain.com',
    'G4D_BASE_DOMAIN': 'get4domain.com',
    'G4D_UPSTREAM': 'http://10.77.0.50:3006',
}

MAX_LABEL = 40
KEEP_BACKUPS = 20
LOCK_STALE_SECONDS = 600
MAX_LIST_BYTES = 2_000_000
# Names that never go to Version 3, whatever the list says: the platform's own hosts and the Version 2 client sites known on 26 Nov 2026.
# The owner's export of every Version 2 vendor name is added from <state dir>/v2-reserved-names.txt.
BUILT_IN_RESERVED = (
    'www', 'app', 'admin', 'api', 'gapi', 'directory', 'media', 'partner', 'mail', 'send', 'get4domain',
    'allwintours', 'deebiphotography', 'indianambulance', 'ksmquantum', 'stepnrock', 'jscomputersmobiles', 'unicatherapy', 'mrtravels', 's2travels',
)
RESERVED_PREFIX = re.compile(r'(v3|t3-)')
_FOLD = str.maketrans({'0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't', '$': 's', '@': 'a'})


class Refused(Exception):
    """Nothing was changed and nothing will be."""


def log(message):
    print(message, flush=True)


def command(value):
    """A command setting is a program name, or (for tests) a JSON list: program and leading arguments."""
    return json.loads(value) if value.startswith('[') else [value]


def run(argv):
    try:
        p = subprocess.run(argv, capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError) as e:
        return 127, '', f'{type(e).__name__}: {e}'
    return p.returncode, p.stdout, p.stderr


def fold_keys(label):
    """Look-alike keys of a name (the same folding the API uses): hyphens and dots dropped, digits read as the letters they imitate."""
    base = label.lower().replace('-', '').replace('.', '').translate(_FOLD)
    return {base.replace('1', 'i'), base.replace('1', 'l')}


def write_atomically(path, text):
    tmp = f'{path}.tmp'   # never ends in .conf, so nginx does not read a half-written file
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def read_text(path):
    try:
        with open(path, encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return None


# ── the list ────────────────────────────────────────────────────────────────

def fetch_list(url, timeout=10):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(url, timeout=timeout) as r:
            if r.status != 200:
                raise Refused(f'the API answered {r.status}')
            body = r.read(MAX_LIST_BYTES + 1)
    except Refused:
        raise
    except Exception as e:   # unreachable, timeout, HTTP error, broken connection: all mean "keep what is there"
        raise Refused(f'the host list could not be read ({type(e).__name__})')
    if len(body) > MAX_LIST_BYTES:
        raise Refused('the answer is too large')
    try:
        obj = json.loads(body.decode('utf-8'))
        if obj.get('success') is False:
            raise Refused('the API reported a failure')
        data = obj.get('data', obj)
        hosts = data['hosts']
        if not isinstance(hosts, list) or not all(isinstance(h, str) for h in hosts):
            raise Refused('the answer holds no list of names')
    except Refused:
        raise
    except Exception:
        raise Refused('the answer is not the expected JSON')
    return hosts


def load_reserved(path):
    text = read_text(path)
    if text is None:
        raise Refused(f'the Version 2 reserved names file is missing: {path}')
    names = set()
    for line in text.splitlines():
        line = line.split('#', 1)[0].strip().lower().rstrip('.')
        if line:
            names.add(line.split('.', 1)[0])
    if not names:
        raise Refused(f'the Version 2 reserved names file holds no name: {path}')
    return names


def valid_hosts(raw, base, reserved):
    """The names that may be routed to Version 3, sorted; and the ones dropped with the reason. Only a full match is accepted, so no nginx syntax can get in."""
    shape = re.compile(r'[a-z0-9]([a-z0-9-]{0,%d}[a-z0-9])?\.%s' % (MAX_LABEL - 2, re.escape(base)))
    reserved_keys = set()
    for name in reserved:
        reserved_keys |= fold_keys(name)
    good, dropped = set(), []
    for host in raw:
        if not shape.fullmatch(host):
            dropped.append((host[:80], 'not a valid address of at most %d characters' % MAX_LABEL))
            continue
        label = host[:-(len(base) + 1)]
        if RESERVED_PREFIX.match(label) or fold_keys(label) & reserved_keys:
            dropped.append((host, 'reserved'))
            continue
        good.add(host)
    return sorted(good), dropped


# ── what nginx serves now ───────────────────────────────────────────────────

def server_names(text):
    plain = '\n'.join(line.split('#', 1)[0] for line in text.splitlines())
    names = set()
    for m in re.finditer(r'(?<![\w-])server_name\s+([^;{}]+);', plain):
        for token in m.group(1).split():
            token = token.strip('"\'').lower()
            if token.startswith('~') or '*' in token:
                continue   # wildcards and patterns do not take an exact name away
            names.add(token.lstrip('.'))
    names.discard('_')
    names.discard('')
    return names


def same_file(a, b):
    return os.path.normcase(os.path.realpath(a)) == os.path.normcase(os.path.realpath(b))


def names_taken_elsewhere(nginx, own_files):
    """Exact names that any OTHER enabled nginx file already declares (nginx -T prints every file it loads)."""
    code, out, err = run(nginx + ['-T'])
    if code != 0:
        raise Refused('nginx -T failed: the present configuration is not in order')
    sections, current = {}, None
    for line in out.splitlines():
        head = re.fullmatch(r'# configuration file (.+):', line.strip())
        if head:
            current = head.group(1)
            sections.setdefault(current, [])
        elif current is not None:
            sections[current].append(line)
    if not sections:
        raise Refused('nginx -T showed no configuration files')
    taken = set()
    for path, lines in sections.items():
        if not any(same_file(path, own) for own in own_files):
            taken |= server_names('\n'.join(lines))
    return taken


def render(hosts, upstream):
    head = '# GENERATED by g4d-v3-vendor-hosts-sync. Do not edit by hand. Source: the API route /v3/public/site/hosts\n'
    if not hosts:
        return head + '# No vendor host at the moment.\n'
    return head + (
        'server {\n'
        '    listen 80;\n'
        '    listen [::]:80;\n'
        f'    server_name {" ".join(hosts)};\n'
        '    server_tokens off;\n'
        '    include snippets/cloudflare-realip.conf;\n'
        '    include snippets/g4d-gzip.conf;\n'
        '    client_max_body_size 2m;\n'
        '    access_log /var/log/nginx/v3-vendor-sites.access.log;\n'
        '    error_log  /var/log/nginx/v3-vendor-sites.error.log;\n'
        '    location / {\n'
        f'        proxy_pass {upstream};\n'
        '        include snippets/g4d-v3-proxy.conf;\n'
        '        include snippets/g4d-headers-site.conf;\n'
        '    }\n'
        '}\n'
    )


def probe(url, host):
    """The status code the local web server answers for this host name, or None when it does not answer. Redirects are not followed."""
    u = urllib.parse.urlsplit(url)
    try:
        c = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=10)
        try:
            c.request('GET', u.path or '/', headers={'Host': host, 'User-Agent': 'g4d-vendor-hosts-sync'})
            r = c.getresponse()
            r.read(1024)
            return r.status
        finally:
            c.close()
    except Exception:
        return None


# ── change and undo ─────────────────────────────────────────────────────────

class Change:
    """The two files this script may write, saved before the change so they can be put back exactly."""

    def __init__(self, cfg, saved_conf, saved_replaced):
        self.cfg, self.saved_conf, self.saved_replaced = cfg, saved_conf, saved_replaced

    @classmethod
    def save(cls, cfg):
        os.makedirs(cfg['G4D_BACKUP_DIR'], exist_ok=True)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S-%f')
        saved_conf = saved_replaced = None
        if os.path.exists(cfg['G4D_CONF']):
            saved_conf = os.path.join(cfg['G4D_BACKUP_DIR'], f'{stamp}.conf')
            shutil.copy2(cfg['G4D_CONF'], saved_conf)
        if os.path.exists(cfg['G4D_REPLACES']):
            saved_replaced = os.path.join(cfg['G4D_BACKUP_DIR'], f'{stamp}.replaced')
            shutil.copy2(cfg['G4D_REPLACES'], saved_replaced)
        return cls(cfg, saved_conf, saved_replaced)

    def restore_files(self):
        if self.saved_conf:
            shutil.copy2(self.saved_conf, self.cfg['G4D_CONF'])
        elif os.path.exists(self.cfg['G4D_CONF']):
            os.remove(self.cfg['G4D_CONF'])
        if self.saved_replaced:
            shutil.copy2(self.saved_replaced, self.cfg['G4D_REPLACES'])

    def record(self):
        return {'conf': self.saved_conf, 'replaced': self.saved_replaced}


def prune_backups(directory):
    """Keeps the newest KEEP_BACKUPS of each kind. The oldest copy of the hand-made file is never removed."""
    names = sorted(os.listdir(directory))
    for suffix in ('.conf', '.replaced'):
        mine = [n for n in names if n.endswith(suffix)]
        old = mine[:-KEEP_BACKUPS]
        if suffix == '.replaced':
            old = old[1:]
        for n in old:
            os.remove(os.path.join(directory, n))


def undo(cfg, change, nginx, systemctl, reload_needed):
    """True when the previous configuration is back, passes nginx -t and (when a reload had been asked for) is loaded again."""
    try:
        change.restore_files()
    except OSError as e:
        log(f'CRITICAL: the previous files could not be put back: {e}')
        return False
    if run(nginx + ['-t'])[0] != 0:
        log('CRITICAL: the previous configuration does not pass nginx -t')
        return False
    if reload_needed and run(systemctl + ['reload', 'nginx'])[0] != 0:
        log('CRITICAL: nginx could not be reloaded with the previous configuration')
        return False
    return True


def lock(path):
    for _ in range(2):
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            return
        except FileExistsError:
            try:
                if time.time() - os.path.getmtime(path) < LOCK_STALE_SECONDS:
                    raise Refused('another run is in progress')
                os.remove(path)
            except FileNotFoundError:
                pass
    raise Refused('the lock could not be taken')


def write_status(cfg, result, code, message, **extra):
    body = {'time': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'result': result, 'exit': code, 'message': message, **extra}
    try:
        write_atomically(os.path.join(cfg['G4D_STATE_DIR'], 'v3-vendor-hosts.status'), json.dumps(body, indent=1) + '\n')
    except OSError as e:
        log(f'the status file could not be written: {e}')


def recover(cfg, marker, nginx, systemctl):
    """A run that died between writing and checking leaves a marker. The present files are checked; if they are not fit, the saved ones come back."""
    text = read_text(marker)
    if text is None:
        return
    log('an earlier run did not finish: checking the present configuration')
    if run(nginx + ['-t'])[0] != 0:
        saved = json.loads(text)
        if not undo(cfg, Change(cfg, saved.get('conf'), saved.get('replaced')), nginx, systemctl, True):
            raise SystemExit(3)
        log('the configuration from before the unfinished run was put back')
    elif run(systemctl + ['reload', 'nginx'])[0] != 0:
        raise Refused('nginx could not be reloaded after an unfinished run')
    os.remove(marker)


def sync(cfg, dry_run=False, sleep=time.sleep):
    nginx, systemctl = command(cfg['G4D_NGINX']), command(cfg['G4D_SYSTEMCTL'])
    state = cfg['G4D_STATE_DIR']
    marker = os.path.join(state, 'v3-vendor-hosts.pending')
    force_flag = os.path.join(state, 'force-once')
    if not dry_run:
        recover(cfg, marker, nginx, systemctl)

    raw = fetch_list(cfg['G4D_API_URL'])
    reserved = set(BUILT_IN_RESERVED) | load_reserved(os.path.join(state, 'v2-reserved-names.txt'))
    hosts, dropped = valid_hosts(raw, cfg['G4D_BASE_DOMAIN'], reserved)
    taken = names_taken_elsewhere(nginx, [cfg['G4D_CONF'], cfg['G4D_REPLACES']])
    dropped += [(h, 'already declared in another nginx file') for h in hosts if h in taken]
    hosts = [h for h in hosts if h not in taken]
    for name, why in dropped[:20]:
        log(f'left out: {name!r} ({why})')
    if len(dropped) > 20:
        log(f'left out: {len(dropped) - 20} more')

    current = read_text(cfg['G4D_CONF'])
    handmade = read_text(cfg['G4D_REPLACES'])
    serving = server_names(current or '') | server_names(handmade or '')
    added, removed = sorted(set(hosts) - serving), sorted(serving - set(hosts))
    wanted = render(hosts, cfg['G4D_UPSTREAM'])

    if handmade is not None:
        missing = sorted(server_names(handmade) - set(hosts))
        if missing:
            raise Refused(f'the hand-made file serves {", ".join(missing[:5])}, which the new list lacks; it is not replaced')
    if not hosts and not serving:
        return 0, 'empty', 'there is no vendor host to serve', {'count': 0}
    if current == wanted and handmade is None:
        return 0, 'unchanged', 'the file already matches the list', {'count': len(hosts)}

    forced = os.path.exists(force_flag)
    if serving and (not hosts or len(removed) * 2 > len(serving)):
        if not forced:
            raise Refused(f'the new list removes {len(removed)} of {len(serving)} names; create {force_flag} to allow it once')
        log('a large removal is allowed once by the force flag')

    if dry_run:
        log('DRY RUN: nothing is written. The file would be:')
        log(wanted)
        log(f'added: {added or "none"}; removed: {removed or "none"}; the hand-made file would {"be moved aside" if handmade is not None else "not exist"}')
        return 0, 'dry-run', 'nothing was written', {'count': len(hosts)}

    before_v2 = probe(cfg['G4D_PROBE_URL'], cfg['G4D_V2_PROBE_HOST'])
    if before_v2 is None or before_v2 >= 500:
        raise Refused(f'the web server is not answering well for {cfg["G4D_V2_PROBE_HOST"]} before any change ({before_v2})')

    change = Change.save(cfg)
    reloaded = False
    problem = None
    try:
        write_atomically(marker, json.dumps(change.record()))
        if handmade is not None:
            os.remove(cfg['G4D_REPLACES'])
        write_atomically(cfg['G4D_CONF'], wanted)
        code, _, err = run(nginx + ['-t'])
        if code != 0:
            problem = f'nginx -t failed: {err.strip()[-400:]}'
        else:
            reloaded = True   # from here a reload has been asked for, so undoing must reload too
            code, _, err = run(systemctl + ['reload', 'nginx'])
            if code != 0:
                problem = f'the reload failed: {err.strip()[-400:]}'
            else:
                problem = check_after(cfg, hosts, added, before_v2, sleep)
    except BaseException as e:   # also a stop signal from systemd: never leave an unchecked file behind
        problem = f'interrupted: {type(e).__name__}: {e}'
    if problem:
        log(problem)
        if not undo(cfg, change, nginx, systemctl, reloaded):
            return 3, 'undo-failed', problem, {'count': len(serving)}
        os.remove(marker)
        return 2, 'rolled-back', problem, {'count': len(serving)}
    os.remove(marker)
    if forced:
        os.remove(force_flag)
    prune_backups(cfg['G4D_BACKUP_DIR'])
    return 0, 'updated', f'added {len(added)}, removed {len(removed)}', {'count': len(hosts), 'added': added[:50], 'removed': removed[:50]}


def check_after(cfg, hosts, added, before_v2, sleep):
    """After the reload: a new vendor host answers without a server error and the Version 2 front page answers exactly as before. A few tries, because a reload takes a moment."""
    problem = None
    for _ in range(3):
        sleep(1)
        problem = None
        after_v2 = probe(cfg['G4D_PROBE_URL'], cfg['G4D_V2_PROBE_HOST'])
        if after_v2 != before_v2:
            problem = f'the Version 2 check changed from {before_v2} to {after_v2}'
        elif hosts:
            name = (added or hosts)[0]
            status = probe(cfg['G4D_PROBE_URL'], name)
            if status is None or status >= 500:
                problem = f'{name} answers {status}'
        if problem is None:
            return None
    return problem


def main(argv=None, env=None, sleep=time.sleep):
    parser = argparse.ArgumentParser(description='Keep the Version 3 vendor host file equal to the API host list.')
    parser.add_argument('--dry-run', action='store_true', help='show what would change; write nothing')
    args = parser.parse_args(argv)
    env = os.environ if env is None else env
    cfg = {k: env.get(k) or v for k, v in DEFAULTS.items()}
    lock_path = os.path.join(cfg['G4D_STATE_DIR'], 'sync.lock')
    locked = False
    try:
        if not args.dry_run:
            os.makedirs(cfg['G4D_STATE_DIR'], exist_ok=True)
            lock(lock_path)
            locked = True
        code, result, message, extra = sync(cfg, args.dry_run, sleep)
    except Refused as e:
        code, result, message, extra = 1, 'refused', str(e), {}
    except SystemExit as e:
        code, result, message, extra = int(e.code or 3), 'undo-failed', 'an unfinished earlier change could not be undone', {}
    except Exception as e:   # an unexpected fault before any change (after a change, sync() itself undoes it)
        code, result, message, extra = 1, 'error', f'{type(e).__name__}: {e}', {}
    try:
        log(f'{result}: {message}')
        if not args.dry_run and (locked or result != 'refused'):
            write_status(cfg, result, code, message, **extra)
    finally:
        if locked:
            try:
                os.remove(lock_path)
            except FileNotFoundError:
                pass
    return code


def _stop(signum, frame):
    raise KeyboardInterrupt(f'signal {signum}')


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, _stop)
    sys.exit(main())
