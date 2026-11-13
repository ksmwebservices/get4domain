import * as fs from 'fs';
import * as path from 'path';
import { BLOCK4B_MODULES } from './block4b-modules';
import { findLegacyUse } from './support/legacy-scan';

/**
 * The Block 4b version of the Batch 13 isolation guards (b13-isolation.spec.ts), over the Block 4b folders. Differences, on purpose: the adapters that talk to a provider may read their keys from the
 * environment, and only they (ENV_ALLOWED); nothing may call fetch or hold a provider URL in code (a provider URL comes from settings).
 */
const src = path.resolve(__dirname, '../src');
const tsFiles = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [])) : []);
const files = BLOCK4B_MODULES.flatMap((m) => tsFiles(path.join(src, m)));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** The only files that may read process.env: the provider adapters and the places that read a feature flag or a signing secret by name. */
const ENV_ALLOWED = new Set(['v3-storage/s3.adapters.ts', 'v3-mail/email.port.ts', 'v3-mail/inbox.service.ts', 'v3-mail/sms.port.ts', 'v3-mail/held-enquiries.service.ts', 'v3-mail/mail-rules.service.ts']);
const LEGACY_DELEGATES = ['contact', 'lead', 'leadCallLog', 'campaignLead', 'callLog', 'vendorProduct', 'catalogItem', 'retailProduct', 'posSale', 'posTable', 'bosDocument', 'bosDocumentLine', 'bosExpense', 'bosPayment', 'expense', 'stockMovement', 'serviceJob', 'appointment', 'supportTicket', 'notification'];

describe('Block 4b modules', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(5); });
  it('no legacy billing, BOS, commercial, add-on or module table or constant is used', () => { expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]); });
  it('no legacy people, work or support table is read or written', () => {
    const re = new RegExp(`\\b(?:prisma|tx|db|this\\.prisma)\\.(${LEGACY_DELEGATES.join('|')})\\b`);
    expect(files.filter((f) => re.test(code(f))).map(rel)).toEqual([]);
  });
  it('no fetch call and no provider URL in code; process.env is read only by the allowed adapter files', () => {
    expect(files.filter((f) => /\bfetch\(|https?:\/\/(?!get4domain|[a-z.]*example\.test)/.test(code(f))).map(rel)).toEqual([]);
    expect(files.filter((f) => /process\.env/.test(code(f)) && !ENV_ALLOWED.has(rel(f))).map(rel)).toEqual([]);
  });
  it('no retired product name, rupee price or timeframe in any text', () => {
    const FRAME = /\b(?:within|in|every|after|for)\s+(?:\d+|a|one|two|three|seven|thirty)\s*(?:hours?|days?|weeks?|months?|minutes?|years?)\b/i;
    expect(files.filter((f) => /\b(Workspace|BOS|LeadSpace)\b|₹\s*\d|Rs\.?\s*\d/.test(code(f)) || FRAME.test(code(f))).map(rel)).toEqual([]);
  });
  it('the pure cores have no clock, randomness, network, file system, database or environment read', () => {
    const cores = files.filter((x) => /\/core\//.test(x.replace(/\\/g, '/')));
    expect(cores.length).toBeGreaterThan(0);
    for (const f of cores) expect([rel(f), /Date\.now|new Date\(|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|require\(|prisma|PrismaService|process\.env/.test(code(f))]).toEqual([rel(f), false]);
  });
  it('no console output (the Logger is used) and no raw SQL', () => { expect(files.filter((f) => /console\.(log|warn|error)|\$executeRaw|\$queryRaw/.test(code(f))).map(rel)).toEqual([]); });
});
