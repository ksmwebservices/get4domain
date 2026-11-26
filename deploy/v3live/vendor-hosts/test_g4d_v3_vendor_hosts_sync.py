"""Tests of g4d-v3-vendor-hosts-sync in a temporary folder, with a fake nginx, a fake systemctl and a local HTTP server standing in for the API and the web server.
Nothing outside the temporary folder is read or written. Run:  python -m unittest -v   (in this folder)
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import StringIO
from pathlib import Path

import g4d_v3_vendor_hosts_sync as sync

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / 'g4d_v3_vendor_hosts_sync.py'

# The fake nginx. `-T` prints every .conf file like nginx does. `-t` fails when told to, or when a file holds the word BADCONF.
FAKE_NGINX = r'''
import sys
from pathlib import Path
control, root, flag = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
def times(name):
    f = control / name
    if not f.exists(): return False
    n = int(f.read_text() or '1')
    if n <= 0: return False
    f.write_text(str(n - 1)); return True
files = sorted(list((root / 'conf.d').glob('*.conf')) + list((root / 'sites-enabled').glob('*')))
with open(control / 'calls.log', 'a') as log: log.write('nginx ' + flag + '\n')
if flag == '-T':
    if times('fail_big_t'): sys.exit(1)
    for f in files:
        print('# configuration file %s:' % f); print(f.read_text())
    sys.exit(0)
skip = control / 'skip_t'
if skip.exists() and int(skip.read_text()) > 0:
    skip.write_text(str(int(skip.read_text()) - 1)); sys.exit(0)
if times('fail_t') or any('BADCONF' in f.read_text() for f in files):
    print('nginx: [emerg] fake failure', file=sys.stderr); sys.exit(1)
sys.exit(0)
'''
FAKE_SYSTEMCTL = r'''
import sys
from pathlib import Path
control = Path(sys.argv[1])
with open(control / 'calls.log', 'a') as log: log.write('systemctl ' + ' '.join(sys.argv[2:]) + '\n')
f = control / 'fail_reload'
if f.exists() and int(f.read_text() or '1') > 0:
    f.write_text(str(int(f.read_text() or '1') - 1)); print('reload failed', file=sys.stderr); sys.exit(1)
sys.exit(0)
'''

HANDMADE = '# hand made\nserver {\n    listen 80;\n    server_name plumberboy.get4domain.com;\n    location / { proxy_pass http://10.77.0.50:3006; }\n}\n'
V2 = ('server { listen 80; server_name get4domain.com www.get4domain.com *.get4domain.com; location / { proxy_pass http://10.77.0.167:3006; } }\n'
      'server {\n  listen 80;\n  server_name stepnrock.get4domain.com\n              v2shop.get4domain.com; # a V2 client\n}\n')


class Web:
    """The API and the web server in one: the list route, and a status per Host header (which may change once a reload has happened)."""

    def __init__(self, control):
        self.control = control
        self.list_status, self.list_body, self.delay = 200, None, 0
        self.status, self.after_reload = {}, {}
        web = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                if self.path.startswith('/v3/public/site/hosts'):
                    if web.delay:
                        time.sleep(web.delay)
                    code, body = web.list_status, web.list_body
                else:
                    host = self.headers.get('Host', '')
                    reloaded = 'systemctl reload' in (web.control / 'calls.log').read_text() if (web.control / 'calls.log').exists() else False
                    code = web.after_reload[host] if reloaded and host in web.after_reload else web.status.get(host, 200)
                    body = b'ok'
                try:
                    self.send_response(code)
                    self.send_header('Content-Length', str(len(body or b'')))
                    self.end_headers()
                    self.wfile.write(body or b'')
                except ConnectionError:
                    pass   # the slow-API test: the script has already given up

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = 'http://127.0.0.1:%d' % self.server.server_address[1]

    def hosts(self, *names):
        self.list_body = json.dumps({'success': True, 'data': {'hosts': [n if '.' in n or ' ' in n else n + '.get4domain.com' for n in names], 'generatedAt': 'x'}}).encode()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


class Case(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='g4d-hosts-'))
        self.nginx = self.root / 'nginx'
        self.control = self.root / 'control'
        self.backups = self.root / 'backups'
        self.state = self.root / 'state'
        for d in (self.nginx / 'conf.d', self.nginx / 'sites-enabled', self.control, self.state):
            d.mkdir(parents=True)
        (self.root / 'fake_nginx.py').write_text(FAKE_NGINX)
        (self.root / 'fake_systemctl.py').write_text(FAKE_SYSTEMCTL)
        self.v2 = self.nginx / 'conf.d' / 'get4domain.conf'
        self.v2.write_text(V2)
        self.conf = self.nginx / 'conf.d' / 'v3-vendor-hosts.conf'
        self.handmade = self.nginx / 'sites-enabled' / 'v3-vendor-sites.get4domain.com.conf'
        (self.state / 'v2-reserved-names.txt').write_text('# V2 export\nstepnrock\nv2shop.get4domain.com\noldclient\n')
        self.web = Web(self.control)
        self.web.hosts('plumberboy', 'alpha', 'beta')
        self.env = {
            'G4D_API_URL': self.web.url + '/v3/public/site/hosts', 'G4D_CONF': str(self.conf), 'G4D_REPLACES': str(self.handmade),
            'G4D_BACKUP_DIR': str(self.backups), 'G4D_STATE_DIR': str(self.state), 'G4D_PROBE_URL': self.web.url + '/',
            'G4D_NGINX': json.dumps([sys.executable, str(self.root / 'fake_nginx.py'), str(self.control), str(self.nginx)]),
            'G4D_SYSTEMCTL': json.dumps([sys.executable, str(self.root / 'fake_systemctl.py'), str(self.control)]),
        }

    def tearDown(self):
        self.web.close()
        shutil.rmtree(self.root, ignore_errors=True)

    # helpers
    def run_sync(self, *argv):
        out = StringIO()
        with redirect_stdout(out):
            code = sync.main(list(argv), self.env, sleep=lambda s: None)
        self.out = out.getvalue()
        return code

    def names(self):
        return sorted(sync.server_names(self.conf.read_text())) if self.conf.exists() else []

    def calls(self):
        f = self.control / 'calls.log'
        return f.read_text().splitlines() if f.exists() else []

    def reloads(self):
        return sum(1 for c in self.calls() if c == 'systemctl reload nginx')

    def status(self):
        return json.loads((self.state / 'v3-vendor-hosts.status').read_text())

    def inject(self, what, times=1):
        (self.control / what).write_text(str(times))

    def established(self, *names):
        """A server where the generated file already serves these names."""
        self.web.hosts(*names)
        self.assertEqual(self.run_sync(), 0, self.out)
        (self.control / 'calls.log').unlink()

    def snapshot(self):
        return {str(p.relative_to(self.nginx)): p.read_bytes() for p in sorted(self.nginx.rglob('*')) if p.is_file()}

    def assert_untouched(self, before):
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.reloads(), 0)


class FirstInstall(Case):
    def test_writes_the_file_moves_the_hand_made_one_aside_and_reloads_once(self):
        self.handmade.write_text(HANDMADE)
        v2 = self.v2.read_bytes()
        self.assertEqual(self.run_sync(), 0, self.out)
        self.assertEqual(self.names(), ['alpha.get4domain.com', 'beta.get4domain.com', 'plumberboy.get4domain.com'])
        self.assertIn('server_name alpha.get4domain.com beta.get4domain.com plumberboy.get4domain.com;', self.conf.read_text())
        self.assertIn('proxy_pass http://10.77.0.50:3006;', self.conf.read_text())
        self.assertFalse(self.handmade.exists())
        self.assertEqual(self.v2.read_bytes(), v2)
        self.assertEqual(self.reloads(), 1)
        self.assertEqual([p.read_text() for p in self.backups.glob('*.replaced')], [HANDMADE])
        self.assertEqual((self.status()['result'], self.status()['count']), ('updated', 3))
        self.assertFalse((self.state / 'v3-vendor-hosts.pending').exists())
        self.assertFalse((self.state / 'sync.lock').exists())
        self.assertEqual(list(self.nginx.rglob('*.tmp')), [])

    def test_never_replaces_the_hand_made_file_when_the_list_lacks_a_name_it_serves(self):
        self.handmade.write_text(HANDMADE)
        self.web.hosts('alpha', 'beta')
        before = self.snapshot()
        self.assertEqual(self.run_sync(), 1)
        self.assertIn('plumberboy.get4domain.com', self.status()['message'])
        self.assert_untouched(before)

    def test_a_failed_test_on_first_install_puts_the_hand_made_file_back_and_leaves_no_generated_file(self):
        self.handmade.write_text(HANDMADE)
        before = self.snapshot()
        self.inject('fail_t')
        self.assertEqual(self.run_sync(), 2, self.out)
        self.assert_untouched(before)
        self.assertFalse(self.conf.exists())


class Nothing(Case):
    def test_the_same_list_changes_nothing_and_does_not_reload(self):
        self.established('alpha', 'beta')
        before, stamp = self.snapshot(), self.conf.stat().st_mtime_ns
        self.assertEqual(self.run_sync(), 0)
        self.assertEqual(self.status()['result'], 'unchanged')
        self.assert_untouched(before)
        self.assertEqual(self.conf.stat().st_mtime_ns, stamp)

    def test_an_empty_list_on_a_server_with_no_vendor_host_is_nothing_to_do(self):
        self.web.hosts()
        before = self.snapshot()
        self.assertEqual(self.run_sync(), 0)
        self.assert_untouched(before)

    def test_dry_run_writes_nothing_at_all(self):
        self.handmade.write_text(HANDMADE)
        before = self.snapshot()
        state = sorted(os.listdir(self.state))
        self.assertEqual(self.run_sync('--dry-run'), 0, self.out)
        self.assertIn('server_name alpha.get4domain.com', self.out)
        self.assert_untouched(before)
        self.assertEqual(sorted(os.listdir(self.state)), state)
        self.assertFalse(self.backups.exists())


class BadInput(Case):
    def refused(self, expect):
        before = self.snapshot()
        self.assertEqual(self.run_sync(), 1, self.out)
        self.assertIn(expect, self.status()['message'])
        self.assert_untouched(before)

    def test_api_unreachable(self):
        self.established('alpha')
        self.env['G4D_API_URL'] = 'http://127.0.0.1:1/v3/public/site/hosts'
        self.refused('could not be read')

    def test_api_errors_and_wrong_answers(self):
        self.established('alpha')
        for status, body in ((500, b'{}'), (404, b''), (200, b'<html>'), (200, b'[]'), (200, b'{"success":true,"data":{}}'), (200, b'{"data":{"hosts":"alpha.get4domain.com"}}'), (200, b'{"data":{"hosts":[1]}}'), (200, b'{"success":false,"data":{"hosts":[]}}')):
            self.web.list_status, self.web.list_body = status, body
            before = self.snapshot()
            self.assertEqual(self.run_sync(), 1, (status, body, self.out))
            self.assert_untouched(before)

    def test_a_slow_api_is_given_up_on(self):
        self.web.delay = 1.5
        original = sync.fetch_list.__defaults__
        sync.fetch_list.__defaults__ = (0.3,)
        try:
            self.refused('could not be read')
        finally:
            sync.fetch_list.__defaults__ = original

    def test_names_that_are_not_plain_addresses_never_reach_the_file(self):
        evil = ['x.get4domain.com; include /etc/passwd', 'y.get4domain.com\n}', 'z.get4domain.com }', 'UPPER.get4domain.com', 'a.b.get4domain.com',
                'shop.example.in', '*.get4domain.com', '~^.+$', '-edge.get4domain.com', 'edge-.get4domain.com', '', 'get4domain.com', 'tail.get4domain.com\n', 'b' * 41 + '.get4domain.com']
        self.web.list_body = json.dumps({'data': {'hosts': evil + ['good.get4domain.com', 'a' * 40 + '.get4domain.com', 'good.get4domain.com']}}).encode()
        self.assertEqual(self.run_sync(), 0, self.out)
        self.assertEqual(self.names(), sorted(['good.get4domain.com', 'a' * 40 + '.get4domain.com']))
        self.assertNotIn('passwd', self.conf.read_text())
        self.assertEqual(self.conf.read_text().count('server {'), 1)

    def test_reserved_names_look_alikes_prefixes_and_the_v2_export_are_left_out(self):
        self.web.hosts('good', 'admin', 'adm1n', 'mr-travels', 's2travels', 'allwintours', 'v3site', 'v3admin', 't3-shop', 'oldclient', 'old-cl1ent', 'v2shop')
        self.assertEqual(self.run_sync(), 0, self.out)
        self.assertEqual(self.names(), ['good.get4domain.com'])

    def test_a_name_another_nginx_file_declares_is_left_out(self):
        (self.nginx / 'sites-enabled' / 'v3site.conf').write_text('server { server_name v9portal.get4domain.com .dotted.get4domain.com; }\n')
        self.web.hosts('good', 'v9portal', 'dotted')
        self.assertEqual(self.run_sync(), 0, self.out)
        self.assertEqual(self.names(), ['good.get4domain.com'])

    def test_no_reserved_file_or_an_empty_one_refuses(self):
        (self.state / 'v2-reserved-names.txt').write_text('# nothing yet\n\n')
        self.refused('holds no name')
        (self.state / 'v2-reserved-names.txt').unlink()
        self.refused('missing')

    def test_a_broken_present_configuration_refuses(self):
        self.inject('fail_big_t')
        self.refused('nginx -T failed')

    def test_a_web_server_that_is_not_answering_before_the_change_refuses(self):
        self.web.status['get4domain.com'] = 502
        self.refused('before any change')


class Guards(Case):
    def test_an_empty_list_never_empties_a_serving_file(self):
        self.established('alpha', 'beta')
        self.web.hosts()
        before = self.snapshot()
        self.assertEqual(self.run_sync(), 1)
        self.assert_untouched(before)

    def test_removing_more_than_half_is_refused_and_exactly_half_is_allowed(self):
        self.established('a1', 'a2', 'a3', 'a4')
        self.web.hosts('a1')
        before = self.snapshot()
        self.assertEqual(self.run_sync(), 1)
        self.assertIn('removes 3 of 4', self.status()['message'])
        self.assert_untouched(before)
        self.web.hosts('a1', 'a2')
        self.assertEqual(self.run_sync(), 0, self.out)
        self.assertEqual(self.names(), ['a1.get4domain.com', 'a2.get4domain.com'])

    def test_the_force_flag_allows_a_large_removal_once(self):
        self.established('a1', 'a2', 'a3', 'a4')
        (self.state / 'force-once').write_text('')
        self.web.hosts()
        self.assertEqual(self.run_sync(), 0, self.out)
        self.assertEqual(self.names(), [])
        self.assertNotIn('server {', self.conf.read_text())
        self.assertFalse((self.state / 'force-once').exists())

    def test_the_force_flag_stays_when_the_forced_change_fails(self):
        self.established('a1', 'a2', 'a3', 'a4')
        (self.state / 'force-once').write_text('')
        self.web.hosts('a1')
        self.inject('fail_t')
        self.assertEqual(self.run_sync(), 2)
        self.assertTrue((self.state / 'force-once').exists())


class Failures(Case):
    def setUp(self):
        super().setUp()
        self.established('alpha', 'beta')
        self.web.hosts('alpha', 'beta', 'gamma')
        self.before = self.snapshot()

    def assert_rolled_back(self, code, reloads):
        self.assertEqual(code, 2, self.out)
        self.assertEqual(self.snapshot(), self.before)
        self.assertEqual(self.reloads(), reloads)
        self.assertEqual(self.status()['result'], 'rolled-back')
        self.assertFalse((self.state / 'v3-vendor-hosts.pending').exists())

    def test_nginx_test_fails_no_reload_at_all(self):
        self.inject('fail_t')
        self.assert_rolled_back(self.run_sync(), 0)

    def test_reload_fails_previous_file_is_loaded_again(self):
        self.inject('fail_reload')
        self.assert_rolled_back(self.run_sync(), 2)

    def test_new_host_answers_a_server_error_after_the_reload(self):
        self.web.after_reload['gamma.get4domain.com'] = 502
        self.assert_rolled_back(self.run_sync(), 2)

    def test_the_version_2_front_page_changes_after_the_reload(self):
        self.web.after_reload['get4domain.com'] = 404
        self.assert_rolled_back(self.run_sync(), 2)

    def test_a_stop_in_the_middle_is_undone(self):
        original = sync.check_after

        def stop(*a):
            raise KeyboardInterrupt('signal 15')

        sync.check_after = stop
        try:
            self.assert_rolled_back(self.run_sync(), 2)
        finally:
            sync.check_after = original

    def test_undo_that_fails_the_test_is_exit_3_and_keeps_the_marker(self):
        self.inject('fail_t', 5)
        self.assertEqual(self.run_sync(), 3, self.out)
        self.assertEqual(self.snapshot(), self.before)   # the files are back even though nginx will not accept them
        self.assertEqual(self.status()['result'], 'undo-failed')
        self.assertTrue((self.state / 'v3-vendor-hosts.pending').exists())

    def test_undo_that_cannot_reload_is_exit_3(self):
        self.inject('fail_reload', 5)
        self.assertEqual(self.run_sync(), 3, self.out)
        self.assertEqual(self.snapshot(), self.before)

    def test_a_missing_systemctl_is_a_failure_not_a_silent_success(self):
        self.env['G4D_SYSTEMCTL'] = json.dumps([str(self.root / 'no-such-program')])
        self.assertEqual(self.run_sync(), 3, self.out)
        self.assertEqual(self.snapshot(), self.before)


class Unfinished(Case):
    def die_after_writing(self, text):
        """The state a killed run leaves: the new file in place, the copy of the old one saved, the marker present."""
        self.established('alpha')
        good = self.conf.read_text()
        self.backups.mkdir(exist_ok=True)
        saved = self.backups / '00000000-000000-000000.conf'
        saved.write_text(good)
        self.conf.write_text(text)
        (self.state / 'v3-vendor-hosts.pending').write_text(json.dumps({'conf': str(saved), 'replaced': None}))
        return good

    def test_an_unchecked_bad_file_is_replaced_by_the_saved_one_on_the_next_run(self):
        good = self.die_after_writing('BADCONF\n')
        self.web.hosts('alpha')
        self.assertEqual(self.run_sync(), 0, self.out)
        self.assertEqual(self.conf.read_text(), good)
        self.assertGreaterEqual(self.reloads(), 1)
        self.assertFalse((self.state / 'v3-vendor-hosts.pending').exists())

    def test_an_unchecked_good_file_is_reloaded_even_though_the_list_matches(self):
        self.established('alpha')
        (self.state / 'v3-vendor-hosts.pending').write_text(json.dumps({'conf': None, 'replaced': None}))
        self.assertEqual(self.run_sync(), 0)
        self.assertEqual(self.reloads(), 1)

    def test_a_dry_run_does_not_touch_an_unfinished_state(self):
        self.die_after_writing('BADCONF\n')
        before = self.snapshot()
        self.run_sync('--dry-run')
        self.assertEqual(self.snapshot(), before)


class Housekeeping(Case):
    def test_a_second_run_at_the_same_time_is_refused_and_a_stale_lock_is_taken_over(self):
        held = self.state / 'sync.lock'
        held.write_text('999999')
        before = self.snapshot()
        self.assertEqual(self.run_sync(), 1)
        self.assertIn('in progress', self.out)
        self.assert_untouched(before)
        self.assertTrue(held.exists(), 'the other run keeps its lock')
        old = time.time() - sync.LOCK_STALE_SECONDS - 60
        os.utime(held, (old, old))
        self.assertEqual(self.run_sync(), 0, self.out)
        self.assertFalse(held.exists())

    def test_keeps_twenty_backups_and_always_the_first_hand_made_copy(self):
        self.handmade.write_text(HANDMADE)
        for i in range(27):
            self.web.hosts('plumberboy', 'a', 'b', 'n%d' % i)
            self.assertEqual(self.run_sync(), 0, self.out)
        self.assertEqual(len(list(self.backups.glob('*.conf'))), sync.KEEP_BACKUPS)
        self.assertEqual([p.read_text() for p in self.backups.glob('*.replaced')], [HANDMADE])

    def test_runs_as_a_program(self):
        p = subprocess.run([sys.executable, str(SCRIPT)], env={**os.environ, **self.env}, capture_output=True, text=True, timeout=60, cwd=str(self.root))
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertEqual(len(self.names()), 3)

    def test_the_defaults_are_the_server_paths_of_the_design(self):
        self.assertEqual(sync.DEFAULTS['G4D_CONF'], '/etc/nginx/conf.d/v3-vendor-hosts.conf')
        self.assertEqual(sync.DEFAULTS['G4D_REPLACES'], '/etc/nginx/sites-enabled/v3-vendor-sites.get4domain.com.conf')
        self.assertEqual(sync.DEFAULTS['G4D_API_URL'], 'http://10.77.0.50:3008/v3/public/site/hosts')


if __name__ == '__main__':
    unittest.main()
