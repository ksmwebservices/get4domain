import * as fs from 'fs';
import * as path from 'path';
import { findLegacyUse } from './support/legacy-scan';

/**
 * Batch 3 static checks (stop-line 5, 6 and 8): V3 code never reads or writes legacy billing, BOS, commercial, domain-campaign, vendor-payments or menu-gating tables or constants;
 * no rupee price or old product name in generated text; no Redis or BullMQ. Every new Batch 3 module is added to MODULES as its slice lands.
 */
const src = path.resolve(__dirname, '../src');
const MODULES = ['b3-settings', 'vendor-lifecycle'];
const tsFiles = (dir: string): string[] => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [])) : [];
const files = MODULES.flatMap((m) => tsFiles(path.join(src, m)));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Batch 3 modules and the legacy world', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(8); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, add-on or module table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('no Redis, BullMQ or queue library (jobs use the database and @nestjs/schedule)', () => {
    expect(files.filter((f) => /bullmq|from 'bull'|ioredis|from 'redis'/i.test(code(f))).map(rel)).toEqual([]);
  });
  it('no old product name or rupee price in code or default texts', () => {
    const bad = files.filter((f) => /\b(Workspace|BOS|LeadSpace)\b|₹\s*\d|Rs\.?\s*\d/.test(code(f)));
    expect(bad.map(rel)).toEqual([]);
  });
  it('the pure cores have no clock, randomness, network, file system or database', () => {
    for (const f of files.filter((x) => /\/core\//.test(x.replace(/\\/g, '/')))) {
      expect(code(f)).not.toMatch(/Date\.now|new Date\(\)|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|require\(|prisma|PrismaService/);
    }
  });
});

describe('nothing is hard-deleted (owner rule 9)', () => {
  it('the lifecycle code never deletes a row: no delete call on any model, no raw DELETE or TRUNCATE', () => {
    for (const f of files.filter((x) => rel(x).startsWith('vendor-lifecycle/'))) {
      expect(code(f)).not.toMatch(/\.delete(Many)?\(|DELETE FROM|TRUNCATE|DROP TABLE|\$executeRaw/i);
    }
  });
  it('the do-not-contact register is append-only: no code anywhere in src deletes from it', () => {
    const all = tsFiles(src).filter((f) => /v3DncRegister/.test(code(f)));
    expect(all.length).toBeGreaterThan(0);
    for (const f of all) expect(code(f)).not.toMatch(/v3DncRegister\.(delete|deleteMany|update|updateMany)\(/);
  });
});
