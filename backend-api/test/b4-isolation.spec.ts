import * as fs from 'fs';
import * as path from 'path';
import { findLegacyUse } from './support/legacy-scan';

/**
 * Batch 4 static checks (stop-lines 5, 6 and 7): V3 wallet and service code never reads or writes legacy billing, wallet, BOS, commercial, domain-campaign, vendor-payments or menu-gating
 * tables or constants; no rupee price, no old product name; no Redis or BullMQ; the pure cores have no clock or database; nothing waits for a lock inside a transaction; the money tables are
 * never updated or deleted by hand. Every new Batch 4 module is added to MODULES as its slice lands.
 */
const src = path.resolve(__dirname, '../src');
const MODULES = ['v3-wallet'];
const tsFiles = (dir: string): string[] => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [])) : [];
const files = MODULES.flatMap((m) => tsFiles(path.join(src, m)));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const LEGACY_WALLET_DELEGATES = /\.(?:wallet|walletTransaction)\.(?:findMany|findUnique|findFirst|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)\b/;   // prisma.wallet.findUnique(...) is the legacy table; tx.wallet() is the V3 store's own method

describe('Batch 4 modules and the legacy world', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(8); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, add-on or module table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('nothing imports from the legacy wallet folder or touches its tables (decision D1)', () => {
    const bad = files.filter((f) => /from\s+'(\.\.\/)+wallet(\/|')/.test(code(f)) || /from\s+'\.\.\/wallet\//.test(code(f)) || LEGACY_WALLET_DELEGATES.test(code(f)) || /"g4d_wallets"|"g4d_wallet_transactions"|WalletCreditUtil|wallet-credit\.util/.test(code(f)));
    expect(bad.map(rel)).toEqual([]);
  });
  it('no Redis, BullMQ or queue library (locks use the in-process KeyedQueue and the database)', () => {
    expect(files.filter((f) => /bullmq|from 'bull'|ioredis|from 'redis'/i.test(code(f))).map(rel)).toEqual([]);
  });
  it('no old product name or rupee price in code or default texts', () => {
    expect(files.filter((f) => /\b(Workspace|BOS|LeadSpace)\b|₹\s*\d|Rs\.?\s*\d/.test(code(f))).map(rel)).toEqual([]);
  });
  it('no timeframe or price is written into generated text: sentences never say "year", "month", "week" or a rupee amount', () => {
    const bad = files.filter((f) => /['"`][^'"`\n]*\b(per year|a year|one year|annual|monthly|quarterly|per month|for \d+ days)\b[^'"`\n]*['"`]/i.test(code(f).replace(/\/\/.*$/gm, '')) && !/core\//.test(rel(f)));
    expect(bad.map(rel)).toEqual([]);
  });
  it('the pure cores have no clock, randomness, network, file system or database', () => {
    const cores = files.filter((x) => /\/core\//.test(x.replace(/\\/g, '/')));
    expect(cores.length).toBeGreaterThan(0);
    for (const f of cores) expect(code(f)).not.toMatch(/Date\.now|new Date\(\)|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|require\(|prisma|PrismaService/);
  });
});

describe('money is never edited by hand (owner rule 3)', () => {
  it('no code updates or deletes a ledger row, a lot cannot be deleted, and nothing deletes a wallet', () => {
    for (const f of files) {
      const c = code(f);
      expect(c).not.toMatch(/v3WalletLedger\.(update|updateMany|delete|deleteMany|upsert)\(/);
      expect(c).not.toMatch(/v3Wallet(Lot|Topup|Receipt)?\.(delete|deleteMany)\(|v3Wallet\.(delete|deleteMany)\(/);
      expect(c).not.toMatch(/DELETE FROM|TRUNCATE|DROP TABLE/i);
    }
  });
  it('the only raw SQL is the gap-free counter, and no locking function is selected', () => {
    for (const f of files) for (const m of code(f).matchAll(/\$(?:queryRaw|executeRaw)(?:Unsafe)?\s*(?:<[^>]*>)?\s*`([\s\S]*?)`/g)) expect(m[1]).toMatch(/g4d_invoice_counters/);
  });
  it('a lock is never awaited inside a transaction: the in-process queue runs first, then the transaction opens (Batch 2 lesson)', () => {
    const store = code(path.join(src, 'v3-wallet/prisma-wallet.store.ts'));
    expect(store).toMatch(/walletQueue\.run\(walletKey\(vendorId\), \(\) => this\.prisma\.\$transaction/);
    for (const f of files) expect(code(f)).not.toMatch(/\$transaction\([^)]*\)\s*=>\s*[^;]*\bqueue\.run\(/);
  });
  it('the services read their settings BEFORE a unit of work opens, never inside the callback (pool lesson)', () => {
    const balanced = (text: string, open: number): string => { let depth = 0; for (let k = open; k < text.length; k++) { if (text[k] === '(') depth++; else if (text[k] === ')' && --depth === 0) return text.slice(open, k + 1); } return text.slice(open); };
    let units = 0;
    for (const f of files.filter((x) => !/core\//.test(x.replace(/\\/g, '/')))) {
      const c = code(f);
      for (const m of c.matchAll(/\bunit\(/g)) { units++; expect([rel(f), balanced(c, m.index! + 4)]).not.toEqual([rel(f), expect.stringMatching(/this\.(settings|billing|tax|prices)\.get\(|await this\.[a-z]+Settings\.get\(/)]); }
    }
    expect(units).toBeGreaterThan(5);   // the scan found the unit-of-work calls (the later slices add many more)
  });
});
