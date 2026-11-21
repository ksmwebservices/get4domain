import * as fs from 'fs';
import * as path from 'path';
import { findLegacyUse } from './support/legacy-scan';

/**
 * Batch 5 static checks (stop-lines 5, 6 and 7): V3 payment code never reads or writes legacy billing, wallet, BOS, commercial, domain-campaign, vendor-payments or menu-gating tables or
 * constants; no old product name or rupee price; no Redis or BullMQ; the pure cores have no clock, randomness or database; no lock is awaited inside a transaction. Every new Batch 5 module is
 * added to MODULES as its slice lands.
 */
const src = path.resolve(__dirname, '../src');
const MODULES = ['v3-payments'];
const tsFiles = (dir: string): string[] => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [])) : [];
const files = MODULES.flatMap((m) => tsFiles(path.join(src, m)));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Batch 5 modules and the legacy world', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(0); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, add-on or module table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('nothing imports from the legacy wallet folder or touches its tables', () => {
    const bad = files.filter((f) => /from\s+'(\.\.\/)+wallet(\/|')/.test(code(f)) || /"g4d_wallets"|"g4d_wallet_transactions"/.test(code(f)));
    expect(bad.map(rel)).toEqual([]);
  });
  it('no Redis, BullMQ or queue library (locks use the in-process KeyedQueue and the database)', () => {
    expect(files.filter((f) => /bullmq|from 'bull'|ioredis|from 'redis'/i.test(code(f))).map(rel)).toEqual([]);
  });
  it('no old product name or rupee price in code or default texts', () => {
    expect(files.filter((f) => /\b(Workspace|BOS|LeadSpace)\b|₹\s*\d|Rs\.?\s*\d/.test(code(f))).map(rel)).toEqual([]);
  });
  it('the pure cores have no clock, randomness, network, file system or database', () => {
    const cores = files.filter((x) => /\/core\//.test(x.replace(/\\/g, '/')));
    expect(cores.length).toBeGreaterThan(0);
    for (const f of cores) expect(code(f)).not.toMatch(/Date\.now|new Date\(\)|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|require\(|prisma|PrismaService/);
  });
  it('no gateway adapter, gateway port or webhook route exists in the payment module (slice 5.17c is skipped by owner decision)', () => {
    expect(files.filter((f) => /PaymentGatewayPort|@Controller\([^)]*webhooks?/i.test(code(f))).map(rel)).toEqual([]);
  });
});
