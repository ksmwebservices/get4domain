import * as fs from 'fs';
import * as path from 'path';

/**
 * E1b: the deploy/v3live files (apps compose, Dockerfiles, env templates) keep their promises. Read as text: no Docker, no network, no database.
 * The repository root is two folders above this file's folder (backend-api/test).
 */
const repo = path.resolve(__dirname, '..', '..');
const read = (f: string): string => fs.readFileSync(path.join(repo, f), 'utf8').replace(/\r\n/g, '\n');
const strip = (s: string): string => s.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

const apiDocker = read('deploy/v3live/api/Dockerfile');
const spaDocker = read('deploy/v3live/spa/Dockerfile');
const siteDocker = read('deploy/v3live/site/Dockerfile');
const compose = read('deploy/v3live/docker-compose.apps.yml');
const SERVICES = ['api', 'site', 'vendor', 'admin', 'partner'];

/** The text of one service block of the compose file (from "  name:" to the next two-space key or a top-level key). */
function serviceBlock(name: string): string {
  const lines = compose.split('\n');
  const start = lines.findIndex((l) => l === `  ${name}:`);
  if (start < 0) throw new Error(`service ${name} not found`);
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {0,2}\S/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/** Active (not commented) NAME=value lines of an env template. */
function activeLines(file: string): Array<{ name: string; value: string }> {
  return read(file).split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=');
    return { name: l.slice(0, i), value: l.slice(i + 1) };
  });
}
/** Every NAME in a template, active or commented out as "# NAME=". */
function allNames(file: string): string[] {
  return read(file).split('\n').map((l) => /^#?\s*([A-Z][A-Z0-9_]+)=/.exec(l.trim())?.[1]).filter((n): n is string => !!n);
}

/** The only non-empty values a template may carry: fixed, harmless literals (never a secret, host or address). */
const LITERALS = new Set(['production', 'true', 'false', 'strict', 'sandbox', '3008', '3006', '0.0.0.0']);
const ENV_FILES = ['api.env.example', 'site.env.example', 'site.build.env.example', 'compose.env.example'].map((f) => `deploy/v3live/env/${f}`);

describe('deploy/v3live/api/Dockerfile', () => {
  it('builds from the repository root and copies the themes the renderer needs (the reason this file exists)', () => {
    expect(apiDocker).toMatch(/^COPY themes \.\/themes$/m);
    expect(apiDocker).toMatch(/^COPY backend-api \.\/backend-api$/m);
    expect(apiDocker).toContain('RUN npm run build');
    expect(read('backend-api/scripts/build-renderer.js')).toContain("path.resolve(BACKEND, '..', 'themes')");
  });
  it('has the runtime stage of the live image: non-root, tini, health check, live flag, production-only dependencies', () => {
    const runner = apiDocker.slice(apiDocker.indexOf('AS runner'));
    expect(runner).toMatch(/^USER nestjs$/m);
    expect(runner.indexOf('USER nestjs')).toBeLessThan(runner.indexOf('CMD ["node", "dist/src/main"]'));
    expect(runner).toContain('tini');
    expect(runner).toContain('HEALTHCHECK');
    expect(runner).toMatch(/^ENV V3_LIVE=true$/m);
    expect(runner).toMatch(/^ENV NODE_ENV=production$/m);
    expect(apiDocker).toContain('npm ci --omit=dev');
  });
  it('has an ops stage with the PostgreSQL client tools and does not run as root', () => {
    const ops = apiDocker.slice(apiDocker.indexOf('AS ops'), apiDocker.indexOf('AS prod-deps'));
    expect(ops).toContain('postgresql17-client');
    expect(ops).toContain('openssl');
    expect(ops).toMatch(/^USER node$/m);
  });
  it('bakes in no value, secret or real domain', () => {
    const code = strip(apiDocker);
    expect(code).not.toMatch(/(SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|API_KEY|TOKEN)\s*=/i);
    expect(code).not.toMatch(/get4domain\.(com|in)/i);
  });
  it('the build context is an allow-list: only backend-api and themes, never an env file or node_modules', () => {
    const ig = read('deploy/v3live/api/Dockerfile.dockerignore');
    expect(ig).toMatch(/^\*$/m);
    expect(ig).toMatch(/^!backend-api$/m);
    expect(ig).toMatch(/^!themes$/m);
    for (const p of ['**/node_modules', '**/.env', '**/.env.*', 'backend-api/live-baseline']) expect(ig.split('\n')).toContain(p);
    // the exclusions come AFTER the re-includes, because the last matching line wins
    expect(ig.indexOf('!themes')).toBeLessThan(ig.indexOf('**/.env'));
  });
});

describe('deploy/v3live/spa/Dockerfile and site/Dockerfile', () => {
  it('the SPA wrapper runs nginx as the nginx user on 8080, fails the build if its edits did not apply, and adds no address', () => {
    expect(spaDocker).toMatch(/^USER nginx$/m);
    expect(spaDocker).toContain('listen 8080 default_server;');
    expect(spaDocker).toMatch(/grep -q 'listen 8080 default_server;'/);
    expect(spaDocker).toContain('pid /tmp/nginx.pid;');
    expect(spaDocker).toContain('http://127.0.0.1:8080/healthz');
    expect(strip(spaDocker)).not.toMatch(/https?:\/\/(?!127\.0\.0\.1)/);
  });
  it('the site image declares every NEXT_PUBLIC build argument of the template, runs as nextjs, and has a health check', () => {
    for (const name of allNames('deploy/v3live/env/site.build.env.example')) expect(siteDocker).toMatch(new RegExp(`^ARG ${name}$`, 'm'));
    expect(siteDocker).toMatch(/^USER nextjs$/m);
    expect(siteDocker).toContain('HEALTHCHECK');
    expect(strip(siteDocker)).not.toMatch(/(SECRET|PASSWORD|API_KEY|TOKEN)\s*=/i);
    expect(read('deploy/v3live/site/Dockerfile.dockerignore')).toMatch(/^\.env\.\*$/m);
  });
});

describe('deploy/v3live/docker-compose.apps.yml', () => {
  it('has exactly the five services, and every one has a health check, a restart policy, no-new-privileges, dropped capabilities, log rotation and a fixed user', () => {
    const names = [...compose.matchAll(/^ {2}([a-z]+):$/gm)].map((m) => m[1]).filter((n) => SERVICES.includes(n));
    expect(names.sort()).toEqual([...SERVICES].sort());
    expect(compose).toMatch(/^x-common: &common$/m);
    const common = compose.slice(compose.indexOf('x-common'), compose.indexOf('services:'));
    expect(common).toContain('restart: unless-stopped');
    expect(common).toContain('no-new-privileges:true');
    expect(common).toMatch(/cap_drop:\n\s+- ALL/);
    expect(common).toContain('max-file');
    for (const s of SERVICES) {
      const b = serviceBlock(s);
      expect(b).toContain('<<: *common');
      expect(b).toContain('healthcheck:');
      expect(b).toMatch(/^ {4}user: "\d+:\d+"$/m);
      expect(b).not.toMatch(/user: "0|user: root/);
      expect(b).toMatch(/^ {4}mem_limit: /m);
    }
  });
  it('every published port is bound to V3_BIND_IP (never 0.0.0.0, never a bare port, never loopback only)', () => {
    const ports = [...compose.matchAll(/^\s+- "([^"]*:\d+:\d+)"$/gm)].map((m) => m[1]);
    expect(ports).toHaveLength(5);
    for (const p of ports) expect(p).toMatch(/^\$\{V3_BIND_IP:\?[^}]+\}:\d+:\d+$/);
    expect(strip(compose)).not.toMatch(/0\.0\.0\.0:\d|^\s+- "\d+:\d+"$/m);
    expect(ports.map((p) => p.split(':').slice(-2).join(':')).sort()).toEqual(['3006:3006', '3008:3008', '3101:8080', '3102:8080', '3103:8080']);
  });
  it('joins the existing external network, uses prebuilt images only, and holds no value, address or secret', () => {
    expect(compose).toMatch(/networks:\n {2}v3net:\n {4}external: true/);
    expect(compose).not.toMatch(/^\s+build:/m);
    expect(compose).not.toMatch(/image: [^$\n]*:latest/);
    const code = strip(compose);
    // addresses: only the loopback health checks
    expect([...code.matchAll(/https?:\/\/[^\s"'`)<>]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://127.0.0.1:'))).toEqual([]);
    expect(code).not.toMatch(/(SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|API_KEY|TOKEN)\s*:/i);
    expect(code).not.toMatch(/get4domain\.(com|in)/i);
  });
  it('the API and the site read their environment from files, the SPAs only an address from compose.env', () => {
    expect(serviceBlock('api')).toMatch(/env_file:\n\s+- \$\{V3_ENV_DIR:-\/opt\/v3live\/env\}\/api\.env/);
    expect(serviceBlock('site')).toMatch(/env_file:\n\s+- \$\{V3_ENV_DIR:-\/opt\/v3live\/env\}\/site\.env/);
    for (const s of ['vendor', 'admin', 'partner']) expect(serviceBlock(s)).toMatch(/API_BASE_URL: \$\{API_PUBLIC_URL:\?/);
    expect(serviceBlock('api')).toContain('V3_LIVE: "true"');
  });
});

describe('deploy/v3live/env/*.example', () => {
  it('hold no value: every active line is empty or one of a few fixed harmless literals', () => {
    for (const f of ENV_FILES) {
      for (const { name, value } of activeLines(f)) {
        expect(name).toMatch(/^[A-Z][A-Z0-9_]+$/);
        if (value !== '') expect([f, name, LITERALS.has(value)]).toEqual([f, name, true]);
      }
      const text = read(f);
      expect(text).not.toMatch(/[A-Za-z0-9+/]{32,}/);   // no key-like string (variable names contain underscores, so they never match)
      expect(text).not.toMatch(/postgres(ql)?:\/\/[^\s<]+:[^\s<@]+@/);       // no connection string with a password
      expect(text).not.toMatch(/rzp_(live|test)_|sk-[A-Za-z0-9]/);
    }
  });
  it('api.env.example has every name the live startup check requires, and only names the API example already knows', () => {
    const required = [...read('backend-api/src/common/startup-check.ts').match(/REQUIRED_LIVE_ENV = \[([\s\S]*?)\] as const/)![1].matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]);
    expect(required.length).toBeGreaterThan(8);
    const active = activeLines('deploy/v3live/env/api.env.example').map((l) => l.name);
    for (const r of required) expect(active).toContain(r);
    const known = new Set(allNames('backend-api/.env.live.example'));
    for (const n of active) expect([n, known.has(n)]).toEqual([n, true]);
  });
  it('api.env.example: every sending and money switch is false, development switches are absent, the live flag is on', () => {
    const v = Object.fromEntries(activeLines('deploy/v3live/env/api.env.example').map((l) => [l.name, l.value]));
    for (const n of ['EMAIL_LIVE_SEND', 'EMAIL_FORWARD_LIVE', 'SMS_LIVE_ENABLED', 'SMS_LIVE_SEND', 'MESSAGING_LIVE_ENABLED', 'PLAN_PAYMENTS_LIVE_ENABLED', 'VENDOR_GATEWAY_LIVE_ENABLED', 'VENDOR_GATEWAY_WEBHOOK_ENABLED', 'REGISTRAR_LIVE_SEARCH', 'REGISTRAR_LIVE_PURCHASE']) expect([n, v[n]]).toEqual([n, 'false']);
    expect(v.WHATSAPP_PROVIDER).toBe('sandbox');
    expect(v.V3_LIVE).toBe('true');
    expect(v.NODE_ENV).toBe('production');
    expect(v.CORS_MODE).toBe('strict');
    for (const n of ['OTP_DEV_ECHO', 'THROTTLE_DISABLED', 'EMAIL_MODE', 'RAZORPAY_TEST_KEY_ID', 'CASHFREE_TEST_APP_ID']) expect(Object.keys(v)).not.toContain(n);
    for (const n of ['STORAGE_PUBLIC_ACCESS_KEY_ID', 'STORAGE_PRIVATE_SECRET_ACCESS_KEY', 'DIRECTORY_PUBLIC_BASE_URL', 'TRUSTED_PROXIES', 'PLATFORM_SETTINGS_KEY']) expect(Object.keys(v)).toContain(n);
  });
  it('site.env.example: the public flag is off, mocks are off on purpose, the hosts and the firm-contact names are there', () => {
    const v = Object.fromEntries(activeLines('deploy/v3live/env/site.env.example').map((l) => [l.name, l.value]));
    expect(v.V3_PUBLIC_ENABLED).toBe('false');
    expect(v.V3_PUBLIC_USE_MOCKS).toBe('false');
    for (const n of ['MAIN_HOST', 'DIRECTORY_HOST', 'APP_HOST', 'ADMIN_HOST', 'API_HOST', 'MEDIA_HOST', 'REVALIDATE_SECRET', 'API_BASE_URL', 'V3_PUBLIC_SUPPORT_EMAIL', 'V3_PUBLIC_SUPPORT_PHONE', 'V3_PUBLIC_GRIEVANCE_OFFICER_NAME', 'V3_PUBLIC_GRIEVANCE_OFFICER_EMAIL', 'V3_PUBLIC_GRIEVANCE_OFFICER_PHONE', 'V3_PUBLIC_FIRM_CIN']) expect(Object.keys(v)).toContain(n);
  });
  it('compose.env.example has every variable the compose file requires', () => {
    const names = allNames('deploy/v3live/env/compose.env.example');
    for (const m of compose.matchAll(/\$\{([A-Z0-9_]+):\?/g)) expect(names).toContain(m[1]);
  });
  it('the real env files are ignored by git, so a filled copy can never be committed from the checkout', () => {
    const ig = read('.gitignore');
    expect(ig).toContain('deploy/v3live/env/*.env');
  });
});

describe('deploy/v3live/RUNBOOK.md', () => {
  const book = read('deploy/v3live/RUNBOOK.md');
  it('holds no secret: no key-like string, no password in a connection string, no echo of a secret file', () => {
    expect(book).not.toMatch(/[A-Za-z0-9]{40,}/);   // paths contain slashes, so only a real key-like run matches
    expect(book).not.toMatch(/postgres(ql)?:\/\/[^\s:]+:(?!\$\(cat )[^\s@{]+@/);
    expect(book).not.toMatch(/cat \/opt\/v3live\/secrets\/(pg_password|ops\/backup_passphrase|deploy_keys\/(backend|apps|site))\s*$/m);
    expect(book).not.toMatch(/-----BEGIN/);
  });
  it('names the window of every part, keeps the public flag off, never touches the wildcard, and says nothing was run', () => {
    for (const w of ['**PC**', '**HOST**', '**CONTAINER**']) expect(book).toContain(w);
    expect(book).toMatch(/Nothing in this runbook has been run/);
    expect(book).toMatch(/V3_PUBLIC_ENABLED=false/);
    expect(book).toContain('WILDCARD_SWITCH_LATER.md');
    expect(book).not.toMatch(/ssl_certificate\s+\//);
    expect(book).toMatch(/nginx -t[\s\S]*systemctl reload nginx/);
  });
  it('covers every job of the dispatch: build, env, Postgres reachability, nginx, baseline, seed, first admin, health, backup, restore test, off-server copy, flag, rollback', () => {
    for (const needle of ['docker build', 'check-live-env.js', 'baseline-live.js', 'dump-staging-schema.js', 'seed-live.js', 'bootstrap-super-admin.js', '/health/ready', 'backup-live-db.js', 'pg_restore', 'scp root@', 'V3_ADMIN_DAY_ONE_SETUP', 'Rollback table', 'nginx -t'])
      expect([needle, book.includes(needle)]).toEqual([needle, true]);
  });
});
