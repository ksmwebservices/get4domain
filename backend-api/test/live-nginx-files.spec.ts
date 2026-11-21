import * as fs from 'fs';
import * as path from 'path';

/** E1c: the host nginx files in deploy/v3live/nginx keep their promises (read as text: no nginx, no network). */
const repo = path.resolve(__dirname, '..', '..');
const dir = path.join(repo, 'deploy', 'v3live', 'nginx');
const read = (rel: string): string => fs.readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n');
const strip = (s: string): string => s.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

function walk(d: string, base = ''): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), `${base}${e.name}/`) : [`${base}${e.name}`]));
}
const FILES = walk(dir);
const HOSTS: Array<{ file: string; name: string; port: number | null; kind: 'api' | 'spa' | 'site' | 'v2' }> = [
  { file: 'api.get4domain.com.conf', name: 'api.get4domain.com', port: 3008, kind: 'api' },
  { file: 'app.get4domain.com.conf', name: 'app.get4domain.com', port: 3101, kind: 'spa' },
  { file: 'admin.get4domain.com.conf', name: 'admin.get4domain.com', port: 3102, kind: 'spa' },
  { file: 'partner.get4domain.com.conf', name: 'partner.get4domain.com', port: 3103, kind: 'spa' },
  { file: 'directory.get4domain.com.conf', name: 'directory.get4domain.com', port: 3006, kind: 'site' },
  { file: 'mrtravels.get4domain.com.conf', name: 'mrtravels.get4domain.com', port: null, kind: 'v2' },
  { file: 's2travels.get4domain.com.conf', name: 's2travels.get4domain.com', port: null, kind: 'v2' },
];

describe('deploy/v3live/nginx: every file', () => {
  it('the expected files exist and nothing else is in the folder', () => {
    const expected = ['README.md', 'WILDCARD_SWITCH_LATER.md', 'update-cloudflare-ips.sh', ...HOSTS.map((h) => h.file),
      'snippets/g4d-proxy.conf', 'snippets/g4d-gzip.conf', 'snippets/g4d-headers-api.conf', 'snippets/g4d-headers-spa.conf', 'snippets/g4d-headers-site.conf'];
    expect([...FILES].sort()).toEqual([...expected].sort());
  });
  it.each(FILES)('%s holds no secret, no IP address and has balanced braces', (f) => {
    const text = read(f);
    expect((text.match(/\{/g) ?? []).length).toBe((text.match(/\}/g) ?? []).length);
    expect(text).not.toMatch(/\b[A-Za-z0-9+/_-]{40,}={0,2}\b/);
    expect(text).not.toMatch(/(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*[^\s<$_]/i);
    expect(text).not.toMatch(/-----BEGIN/);
    // no literal address: the container address is __V3_BIND_IP__, the upstreams are placeholders, Cloudflare's ranges are fetched at run time
    expect(strip(text).replace(/127\.0\.0\.1/g, '')).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  });
});

describe('deploy/v3live/nginx: one server block per host', () => {
  it.each(HOSTS)('$file: names its host, redirects 80, terminates TLS with placeholders, proxies with the shared snippets', (h) => {
    const c = read(h.file);
    const code = strip(c);
    expect(code).toContain(`server_name ${h.name};`);
    expect((code.match(/server_name /g) ?? []).length).toBe(2);        // the port 80 redirect and the 443 block
    expect(code).toMatch(/listen 80;[\s\S]*return 301 https:\/\/\$host\$request_uri;/);
    expect(code).toMatch(/listen 443 ssl http2;/);
    expect(code).toContain('ssl_certificate     __TLS_CERT__;');
    expect(code).toContain('ssl_certificate_key __TLS_KEY__;');
    expect(code).toMatch(/ssl_protocols TLSv1\.2 TLSv1\.3;/);
    expect(code).toContain('server_tokens off;');
    expect(code).toContain('include snippets/cloudflare-realip.conf;');
    expect(code).toContain('include snippets/g4d-gzip.conf;');
    expect(code).toContain('include snippets/g4d-proxy.conf;');
    expect(code).toMatch(/client_max_body_size \d+m;/);
    expect(code).not.toMatch(/server_name[^;]*\*/);                    // no wildcard in this lane
    expect(code).not.toMatch(/Content-Security-Policy/i);              // the SPA container owns the CSP
    expect((code.match(/location /g) ?? []).length).toBe(1);           // one location: add_header is not lost to inheritance
  });
  it.each(HOSTS.filter((h) => h.port !== null))('$file: proxies to the container address on port $port, never to another host', (h) => {
    expect(strip(read(h.file))).toContain(`proxy_pass http://__V3_BIND_IP__:${h.port};`);
  });
  it('mrtravels and s2travels proxy to a placeholder the owner fills, never a guessed address', () => {
    expect(strip(read('mrtravels.get4domain.com.conf'))).toContain('proxy_pass __MRTRAVELS_UPSTREAM__;');
    expect(strip(read('s2travels.get4domain.com.conf'))).toContain('proxy_pass __S2TRAVELS_UPSTREAM__;');
  });
  it('the API host passes the headers its callers need and sets the API security headers; the other kinds use their own header files', () => {
    for (const h of HOSTS) {
      const c = strip(read(h.file));
      const expected = { api: 'g4d-headers-api', spa: 'g4d-headers-spa', site: 'g4d-headers-site', v2: null }[h.kind];
      if (expected) expect(c).toContain(`include snippets/${expected}.conf;`);
      else expect(c).not.toMatch(/g4d-headers-/);
    }
    const api = strip(read('snippets/g4d-headers-api.conf'));
    expect(api).not.toMatch(/Access-Control|Content-Disposition/i);    // never hidden or replaced
    expect(api).toContain('add_header X-Content-Type-Options "nosniff" always;');
  });
});

describe('deploy/v3live/nginx: snippets', () => {
  it('the SPA hosts are noindex with one X-Robots-Tag, add no CSP, and hide only their own transport and robots headers', () => {
    const s = strip(read('snippets/g4d-headers-spa.conf'));
    expect(s).toContain('proxy_hide_header X-Robots-Tag;');
    expect(s).toContain('add_header X-Robots-Tag "noindex, nofollow" always;');
    expect(s).not.toMatch(/Content-Security-Policy|X-Frame-Options|Referrer-Policy/i);
  });
  it('the public site host never overrides the application robots rules', () => {
    expect(strip(read('snippets/g4d-headers-site.conf'))).not.toMatch(/X-Robots-Tag/);
  });
  it('proxy headers pass the real client address by SETTING (not appending) X-Forwarded-For, and keep Host', () => {
    const p = strip(read('snippets/g4d-proxy.conf'));
    expect(p).toContain('proxy_set_header X-Forwarded-For $remote_addr;');
    expect(p).not.toContain('$proxy_add_x_forwarded_for');
    expect(p).toContain('proxy_set_header Host $host;');
    expect(p).toContain('proxy_set_header X-Forwarded-Proto $scheme;');
  });
  it('the Cloudflare real address file is generated from Cloudflare\'s lists at run time and refuses a short or odd result', () => {
    const s = read('update-cloudflare-ips.sh');
    expect(s).toContain('https://www.cloudflare.com/ips-v4');
    expect(s).toContain('https://www.cloudflare.com/ips-v6');
    expect(s).toContain('real_ip_header CF-Connecting-IP;');
    expect(s).toContain('set_real_ip_from');
    expect(s).toMatch(/-ge 10/);
    expect(s).toMatch(/^set -eu$/m);
  });
  it('gzip is on for text types', () => {
    const g = strip(read('snippets/g4d-gzip.conf'));
    expect(g).toContain('gzip on;');
    expect(g).toContain('application/json');
  });
});

describe('deploy/v3live/nginx/WILDCARD_SWITCH_LATER.md', () => {
  const doc = read('WILDCARD_SWITCH_LATER.md');
  it('is a separate file with a backup first, nginx -t before reload, a restore rollback and the V2 name listing', () => {
    expect(doc.indexOf('cp -a /etc/nginx /etc/nginx.bak-')).toBeGreaterThan(0);
    expect(doc.indexOf('nginx -t')).toBeLessThan(doc.indexOf('systemctl reload nginx'));
    expect(doc.indexOf('/etc/nginx.bak-')).toBeLessThan(doc.indexOf('nginx -t'));
    expect(doc).toMatch(/Rollback[\s\S]*cp -a \/etc\/nginx\.bak-/);
    expect(doc).toContain('SELECT subdomain FROM "Vendor"');
    expect(doc).toMatch(/read only/i);
  });
  it('names every reserved host and V2 client name', () => {
    for (const n of ['www', 'app', 'admin', 'api', 'gapi', 'directory', 'media', 'partner', 'mail', 'send', 'allwintours', 'deebiphotography', 'indianambulance', 'ksmquantum', 'stepnrock', 'jscomputersmobiles', 'unicatherapy', 'mrtravels', 's2travels']) expect(doc).toMatch(new RegExp(`\\b${n}\\b`));
  });
  it('no server file changes the wildcard', () => {
    for (const h of HOSTS) expect(read(h.file)).not.toMatch(/server_name[^;\n]*\*\./);
  });
});
