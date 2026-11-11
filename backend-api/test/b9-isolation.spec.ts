import * as fs from 'fs';
import * as path from 'path';
import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';
import { findLegacyUse } from './support/legacy-scan';

/**
 * Batch 9 static checks (stop-lines 5, 6 and 7, and the Website manager rules): V3 website code never reads or writes legacy billing, wallet, BOS, commercial, domain-campaign, vendor-payments or
 * menu-gating tables or constants; the legacy site document is reached only through the content source; every table is tenant scoped and every store query names the vendor; no Redis or
 * BullMQ; the pure cores have no clock, randomness, network, file system or database; no retired product name, price or timeframe in any text this run writes. Each Batch 9 module is added to
 * MODULES as its slice lands.
 */
const src = path.resolve(__dirname, '../src');
const MODULES = ['v3-website'];
const NEW_MODELS = ['V3SiteDraft', 'V3SiteSnapshot', 'V3SitePicture', 'V3ContentSubmission', 'V3PageSeo', 'V3SiteLocation', 'V3ReviewLink', 'V3Testimonial', 'V3ActOnBehalfSession'];
const tsFiles = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [])) : []);
const files = MODULES.flatMap((m) => tsFiles(path.join(src, m)));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Batch 9 modules and the legacy world', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(5); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, add-on or module table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('nothing imports from the legacy wallet folder, the legacy site document code or the legacy theme code', () => {
    expect(files.filter((f) => /from\s+'(\.\.\/)+(wallet|site-doc|themes|cms|engine)(\/|')/.test(code(f))).map(rel)).toEqual([]);
  });
  it('the legacy site document (VendorCMS) and the vendor items are never touched here: they are reached only through the content source', () => {
    expect(files.filter((f) => /\.(vendorCMS|vendorProduct)\b/.test(code(f))).map(rel)).toEqual([]);
  });
  it('no Redis, BullMQ or queue library (locks use the in-process KeyedQueue)', () => {
    expect(files.filter((f) => /bullmq|from 'bull'|ioredis|from 'redis'/i.test(code(f))).map(rel)).toEqual([]);
  });
  it('no retired product name, rupee price or timeframe in any text this run writes', () => {
    const FRAME = /\b(?:within|in|every|after|for)\s+(?:\d+|a|one|two|three|seven|thirty)\s*(?:hours?|days?|weeks?|months?|minutes?|years?)\b/i;
    expect(files.filter((f) => /\b(Workspace|BOS|LeadSpace)\b|₹\s*\d|Rs\.?\s*\d/.test(code(f)) || FRAME.test(code(f))).map(rel)).toEqual([]);
  });
  it('the pure cores have no clock, randomness, network, file system or database', () => {
    const cores = files.filter((x) => /\/core\//.test(x.replace(/\\/g, '/')));
    expect(cores.length).toBeGreaterThan(2);
    for (const f of cores) expect(code(f)).not.toMatch(/Date\.now|new Date\(|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|require\(|prisma|PrismaService/);
  });
  it('no console output (the Logger is used) and no raw SQL', () => {
    expect(files.filter((f) => /console\.(log|warn|error)|\$executeRaw|\$queryRaw/.test(code(f))).map(rel)).toEqual([]);
  });
});

describe('tenant scoping of the Batch 9 tables', () => {
  it('every new table carries a vendorId scalar, so the tenant guard scopes it', () => { for (const m of NEW_MODELS) expect([m, VENDOR_SCOPED_MODELS.has(m)]).toEqual([m, true]); });
  it('every query in a Prisma store names the vendor (or the unique publication it belongs to)', () => {
    const stores = files.filter((f) => /prisma-.*store\.ts$|website\.store\.ts$/.test(f));
    expect(stores.length).toBeGreaterThan(0);
    for (const f of stores) {
      const c = code(f);
      const calls = [...c.matchAll(/this\.prisma\.(\w+)\.(findUnique|findFirst|findMany|updateMany|deleteMany|update|delete|count|createMany|create|upsert)\(([\s\S]*?)\)\s*[;,)\n]/g)];
      const bad = calls.filter((m) => NEW_MODELS.some((n) => `v3${n.slice(2)}`.toLowerCase() === m[1].toLowerCase()) && !/vendorId/.test(m[3]) && !/\bid\b\s*[:,}]/.test(m[3])).map((m) => `${rel(f)}: ${m[1]}.${m[2]}`);
      expect(bad).toEqual([]);
    }
  });
});
