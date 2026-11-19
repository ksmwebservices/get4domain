import * as fs from 'fs';
import * as path from 'path';
import { checkDatabaseUrls } from '../src/common/startup-check';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { liveSeedEnv } = require('../scripts/live/live-env-lib');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseIdArgs, decideRebuild, dryRebuildLines, resultLines } = require('../scripts/live/rebuild-site-content-lib');

/** S1.4: the content rebuild is dry by default, names one vendor by id, refuses non-live databases, and prints no phone or e-mail. */
const v = { id: 'v1', role: 'VENDOR', status: 'PENDING', industry: 'Home repair and trades', subdomain: 'plumberboy' };
const state = { cms: { siteStatus: 'DRAFT', tagline: null, about: null, address: null }, products: 0, published: { version: 1 }, sub: { plan: { key: 'handyman_free', track: 'HANDYMAN', level: 'FREE' } } };

describe('S1.4 rebuild-site-content', () => {
  it('takes one vendor id; --apply and --staging are the only flags; anything else is refused', () => {
    expect(parseIdArgs(['--id', 'v1'])).toEqual({ ok: true, id: 'v1', apply: false, staging: false });
    expect(parseIdArgs(['--id', 'v1', '--apply', '--staging'])).toMatchObject({ apply: true, staging: true });
    for (const bad of [[], ['--id'], ['--id', 'a', '--id', 'b'], ['--email', 'a@b.test'], ['v1'], ['--apply'], ['--id', '--apply']]) expect(parseIdArgs(bad).ok).toBe(false);
  });
  it('refuses a missing, non-vendor or suspended account and a vendor with no V3 plan', () => {
    expect(decideRebuild(v, state).ok).toBe(true);
    expect(decideRebuild(null, state).ok).toBe(false);
    expect(decideRebuild({ ...v, role: 'ADMIN' }, state).problem).toMatch(/not a vendor/);
    expect(decideRebuild({ ...v, status: 'SUSPENDED' }, state).problem).toMatch(/suspended/);
    expect(decideRebuild(v, { ...state, sub: null }).problem).toMatch(/no V3 plan/);
  });
  it('the dry run says what would be filled, that the row is not LIVE, and that nothing is invented', () => {
    const t = dryRebuildLines(v, state).join('\n');
    expect(t).toContain('"Home repair and trades"'); expect(t).toContain('DRAFT'); expect(t).toContain('answers 404'); expect(t).toContain('tagline; about text; the generic services');
    expect(t).toContain('Address block: none (not invented)'); expect(t).toContain('not indexable until claimed and verified');
    const done = dryRebuildLines(v, { ...state, cms: { siteStatus: 'LIVE', tagline: 'x', about: 'y', address: '1 Road' }, products: 3 }).join('\n');
    expect(done).toContain('Nothing to fill'); expect(done).toContain('Address block: present');
  });
  it('the result lines hold counts and words only', () => {
    expect(resultLines({ status: 'LIVE', published: true }, { cms: { siteStatus: 'LIVE', tagline: 'a', about: 'b' }, products: 4, published: { version: 2 } }).join(' ')).toBe('Result: LIVE (published). Site row LIVE; tagline set; about set; 4 catalogue row(s); published V3 site v2.');
  });
  it('the script is dry by default: the prompt comes before any write and before the services start, and the live guard runs first', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../scripts/live/rebuild-site-content.js'), 'utf8');
    const at = (s: string) => src.indexOf(s);
    expect(at('liveSeedEnv(process.env')).toBeLessThan(at('new PrismaClient'));
    expect(at('if (!args.apply)')).toBeLessThan(at('applyConfirmed(await ask('));
    expect(at('applyConfirmed(await ask(')).toBeLessThan(at('makeProvidersInert('));
    expect(at('makeProvidersInert(')).toBeLessThan(at('createMySite('));
    expect(src).not.toMatch(/\.(create|update|upsert|delete|deleteMany|updateMany|createMany)\s*\(/);   // every write goes through the retry service
  });
  it('refuses a staging, test or local database and a placeholder (the live scripts\' own guard)', () => {
    for (const url of ['postgresql://u:p@localhost:5432/db', 'postgresql://u:p@db.example.test:5432/v3test', '', 'changeme']) expect(liveSeedEnv({ DATABASE_URL: url, DIRECT_URL: url }, checkDatabaseUrls).ok).toBe(false);
  });
});
