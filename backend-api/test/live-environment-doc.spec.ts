import * as fs from 'fs';
import * as path from 'path';

/** Job L6: the live runbook names every switch that stays OFF, points only at files that exist, and holds no real value. */
const root = path.resolve(__dirname, '..');
const doc = fs.readFileSync(path.resolve(root, '..', 'docs', 'v3', 'V3_LIVE_ENVIRONMENT.md'), 'utf8').replace(/\r\n/g, '\n');
const example = fs.readFileSync(path.join(root, '.env.live.example'), 'utf8');

describe('docs/v3/V3_LIVE_ENVIRONMENT.md', () => {
  it('lists every sending, spending and indexing switch as OFF', () => {
    for (const n of ['EMAIL_LIVE_SEND', 'EMAIL_FORWARD_LIVE', 'SMS_LIVE_SEND', 'SMS_LIVE_ENABLED', 'smsAdapterMode', 'MESSAGING_LIVE_ENABLED', 'WHATSAPP_PROVIDER', 'VENDOR_GATEWAY_LIVE_ENABLED', 'VENDOR_GATEWAY_WEBHOOK_ENABLED', 'REGISTRAR_LIVE_SEARCH', 'REGISTRAR_LIVE_PURCHASE', 'directoryPagesIndexable', 'directoryIndexUnclaimed', 'indexing-mode', 'OTP_DEV_ECHO', 'THROTTLE_DISABLED']) expect([n, doc.includes(n)]).toEqual([n, true]);
  });
  it('every environment switch it names is a name in .env.live.example, and those switches are not active lines there', () => {
    for (const n of ['EMAIL_LIVE_SEND', 'EMAIL_FORWARD_LIVE', 'SMS_LIVE_SEND', 'SMS_LIVE_ENABLED', 'MESSAGING_LIVE_ENABLED', 'WHATSAPP_PROVIDER', 'VENDOR_GATEWAY_LIVE_ENABLED', 'VENDOR_GATEWAY_WEBHOOK_ENABLED', 'REGISTRAR_LIVE_SEARCH', 'REGISTRAR_LIVE_PURCHASE']) {
      expect([n, new RegExp(`^# ${n}=$`, 'm').test(example)]).toEqual([n, true]);
    }
  });
  it('every script and file it tells you to run exists', () => {
    const files = new Set([...doc.matchAll(/\b((?:scripts\/[a-z0-9/_-]+|Dockerfile|docker-compose|src\/[a-z0-9/_-]+)[A-Za-z0-9._/-]*\.(?:js|ts|yml))\b/g)].map((m) => m[1]));
    for (const f of ['Dockerfile.v3live', 'docker-compose.v3live.yml', 'scripts/bootstrap-super-admin.js', 'scripts/live/check-live-env.js', 'scripts/live/migrate-live.js', 'scripts/live/seed-live.js', 'scripts/live/backup-live-db.js', 'scripts/gen-catalogue-categories.js']) files.add(f);
    for (const f of files) expect([f, fs.existsSync(path.join(root, f))]).toEqual([f, true]);
    for (const s of doc.matchAll(/seed-v3-[a-z-]+/g)) expect([s[0], fs.existsSync(path.join(root, 'scripts', `${s[0]}.js`))]).toEqual([s[0], true]);
  });
  it('the seed list in the runbook is the live runner\'s list, in an order that loads the directory before the categories', () => {
    const order = [...doc.matchAll(/node scripts\/live\/seed-live\.js (seed-v3-[a-z-]+)\.js --apply/g)].map((m) => m[1]);
    expect(order.length).toBe(12);
    expect(order.indexOf('seed-v3-directory')).toBeLessThan(order.indexOf('seed-v3-catalogue-categories'));
    expect(order.indexOf('seed-v3-pack-engine')).toBeLessThan(order.indexOf('seed-v3-pack-tab-fields'));
  });
  it('holds no real domain, address, key or secret', () => {
    expect(doc).not.toMatch(/get4domain\.(com|in)|ksm|@gmail|sk_live|rzp_|AKIA[0-9A-Z]{8}|BEGIN (RSA|PRIVATE)/i);
    expect(doc).not.toMatch(/(password|secret|passphrase)\s*[:=]\s*['"]?[A-Za-z0-9+/]{16,}/i);
  });
  it('gives the order for a new live database and the baseline steps, with the guards, the extensions, the two drift items and how to verify', () => {
    const order = doc.slice(doc.indexOf('## 1a.'), doc.indexOf('## 2.'));
    const at = (w: string): number => order.indexOf(w);
    expect([at('new Supabase project'), at('Schema baseline'), at('Seeds in order'), at('bootstrap the first SUPER_ADMIN'), at('Health checks')].every((n) => n >= 0)).toBe(true);
    expect(at('new Supabase project')).toBeLessThan(at('Schema baseline')); expect(at('Schema baseline')).toBeLessThan(at('Seeds in order'));
    expect(at('Seeds in order')).toBeLessThan(at('bootstrap the first SUPER_ADMIN')); expect(at('bootstrap the first SUPER_ADMIN')).toBeLessThan(at('Health checks'));
    expect(order.indexOf('pack engine')).toBeLessThan(order.indexOf('pack tab fields')); expect(order.indexOf('pack tab fields')).toBeLessThan(order.indexOf('profile fields')); expect(order.indexOf('profile fields')).toBeLessThan(order.indexOf('catalogue categories'));
    const base = doc.slice(doc.indexOf('## 6a.'), doc.indexOf('## 7.'));
    for (const w of ['dump-staging-schema.js', 'baseline-live.js', '--schema-only --no-owner --no-privileges', 'pg_trgm', 'pgcrypto', 'uuid-ossp', 'g4d_directory_businesses_name_trgm_idx', 'searchVector', 'The database must be empty', 'LIVE', 'resolve --applied', 'rls', 'drift', 'never committed', 'Delete the Supabase project']) expect([w, base.includes(w)]).toEqual([w, true]);
    for (const f of ['scripts/live/dump-staging-schema.js', 'scripts/live/baseline-live.js']) expect(fs.existsSync(path.join(root, f))).toBe(true);
  });
  it('says what was not run', () => { expect(doc).toContain('Not run:'); expect(doc).toContain('Docker build'); });
});
