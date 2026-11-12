import * as fs from 'fs';
import * as path from 'path';
import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';
import { findLegacyUse } from './support/legacy-scan';

/**
 * Batch 13 static checks (stop-lines 5, 6 and 7, and owner override 2): V3 business code never reads or writes a legacy billing, BOS, commercial, domain-campaign, vendor-payments or menu-gating
 * table, NOR a legacy contact, lead, call, catalogue, stock, job, booking or appointment table ("V3 code never reads legacy contact tables"); every table is tenant scoped and every store query names
 * the vendor; no Redis or BullMQ; the pure cores have no clock, randomness, network, file system or database; no console output or raw SQL; no timeframe, rupee price or retired product name in any
 * text. Each Batch 13 module is added to MODULES as its slice lands.
 */
const src = path.resolve(__dirname, '../src');
export const MODULES = ['v3-business', 'v3-customers', 'v3-accounts', 'v3-jobs', 'v3-appointments'];
const NEW_MODELS = ['V3Customer', 'V3CustomerSource', 'V3SaleRecord', 'V3Expense', 'V3Item', 'V3Job', 'V3Quote', 'V3ApptService', 'V3ApptProvider', 'V3ApptBooking'];
const LEGACY_PEOPLE_AND_WORK_DELEGATES = [
  'contact', 'lead', 'leadCallLog', 'campaignLead', 'callLog', 'vendorProduct', 'catalogItem', 'retailProduct', 'posSale', 'posTable', 'bosDocument', 'bosDocumentLine', 'bosExpense', 'bosPayment', 'expense',
  'stockMovement', 'partStock', 'produceStock', 'serviceJob', 'jobLine', 'appointment', 'clinicAppointment', 'salonAppointment', 'roomBooking', 'eventBooking', 'testOrder', 'produceOrder', 'restaurantOrder', 'vendorTask', 'quote',
];
const tsFiles = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [])) : []);
const files = MODULES.flatMap((m) => tsFiles(path.join(src, m)));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Batch 13 modules and the legacy world', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(5); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, add-on or module table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('no file reads or writes a legacy contact, lead, call, catalogue, stock, job, booking or appointment table', () => {
    const re = new RegExp(`\\b(?:prisma|tx|db|this\\.prisma)\\.(${LEGACY_PEOPLE_AND_WORK_DELEGATES.join('|')})\\b`);
    expect(files.filter((f) => re.test(code(f))).map(rel)).toEqual([]);
  });
  it('nothing imports a legacy module folder (the old contacts, CRM, accounts, catalogue, industry modules, wallet, domains, site document, themes, engine)', () => {
    const LEGACY = 'crm|customer|domainapp|accounting|retail|restaurant|agriculture|diagnostics|hotel|clinic|salon|gym|events|travel|bos|wallet|domains|site-doc|themes|cms|engine|domain-campaign|leadspace|leads|admin-crm|demo|widget|quotes|campaigns|campaign-pages';
    expect(files.filter((f) => new RegExp(`from\\s+'(\\.\\./)+(${LEGACY})(/|')`).test(code(f))).map(rel)).toEqual([]);
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
    expect(cores.length).toBeGreaterThan(0);
    for (const f of cores) expect(code(f)).not.toMatch(/Date\.now|new Date\(|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|require\(|prisma|PrismaService|process\.env/);
  });
  it('no console output (the Logger is used) and no raw SQL', () => {
    expect(files.filter((f) => /console\.(log|warn|error)|\$executeRaw|\$queryRaw/.test(code(f))).map(rel)).toEqual([]);
  });
  it('no live provider call and no key read in this run\'s modules', () => {
    expect(files.filter((f) => /\bfetch\(|process\.env|https?:\/\/(?!get4domain)/.test(code(f))).map(rel)).toEqual([]);
  });
});

describe('tenant scoping of the Batch 13 tables', () => {
  it('every new table carries a vendorId scalar, so the tenant guard scopes it', () => { for (const m of NEW_MODELS) expect([m, VENDOR_SCOPED_MODELS.has(m)]).toEqual([m, true]); });
  it('every query in a Prisma store names the vendor', () => {
    const stores = files.filter((f) => /prisma-[\w-]+\.store\.ts$/.test(f));
    expect(stores.length).toBeGreaterThan(0);
    const names = new Set(NEW_MODELS.map((n) => `v3${n.slice(2)}`.toLowerCase()));
    for (const f of stores) {
      const c = code(f);
      const calls = [...c.matchAll(/this\.prisma\.(\w+)\.(findUnique|findFirst|findMany|updateMany|deleteMany|update|delete|count|createMany|create|upsert)\(([\s\S]*?)\)\s*[;,)\n]/g)];
      const bad = calls.filter((m) => names.has(m[1].toLowerCase()) && !/vendorId/.test(m[3])).map((m) => `${rel(f)}: ${m[1]}.${m[2]}`);
      expect(bad).toEqual([]);
    }
  });
});
