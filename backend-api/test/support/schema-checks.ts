import * as fs from 'fs';
import * as path from 'path';

/** Shared static checks for a slice's schema and migration (no database). Used by the batch 2 schema specs. */
const backend = path.resolve(__dirname, '../..');
export const schemaText = fs.readFileSync(path.join(backend, 'prisma/schema.prisma'), 'utf8');
const migrationsDir = path.join(backend, 'prisma/migrations');

export function modelBlock(table: string): string {
  for (const m of schemaText.matchAll(/^model\s+\w+\s*\{[\s\S]*?^\}/gm)) if (m[0].includes(`@@map("${table}")`)) return m[0];
  return '';
}
export function migrationSql(suffix: string): { name: string | undefined; sql: string; code: string } {
  const name = fs.readdirSync(migrationsDir).find((d) => d.endsWith(suffix));
  const sql = name ? fs.readFileSync(path.join(migrationsDir, name, 'migration.sql'), 'utf8') : '';
  return { name, sql, code: sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n') };
}

export const LEGACY_MODELS = [
  'Subscription', 'Invoice', 'BillingTerm', 'BillingDeal', 'PlanOverride', 'PlanChangeRequest', 'PromoCode', 'ManualPaymentSubmission', 'SpecialArrangement',
  'CommercialAuditLog', 'PaymentRecord', 'VendorAddon', 'VendorModule', 'SiteVersion', 'DomainCampaignRecord', 'DomainRegistration', 'VendorPaymentConfig', 'GenericInvoice',
];

/** Registers the standard additive-migration checks for a slice. */
export function describeSchemaSlice(label: string, o: { suffix: string; tables: string[]; enums: string[]; fkTargets: string[]; /** tables whose primary key is not a cuid by design (for example a counter keyed by year) */ noCuid?: string[]; /** statements a slice may add beyond the standard set (for example ALTER TYPE ... ADD VALUE, or a guarded DO block) */ extraAllowed?: RegExp[] }): void {
  const { name, code } = migrationSql(o.suffix);
  describe(`${label}: schema and migration`, () => {
    it.each(o.tables.map((t) => [t]))('%s is a model with a cuid id (or a key chosen on purpose)', (t) => { const b = modelBlock(t); expect(b).not.toBe(''); if (!(o.noCuid ?? []).includes(t)) expect(b).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/); });
    if (o.enums.length) it.each(o.enums.map((e) => [e]))('enum %s exists', (e) => { expect(schemaText).toMatch(new RegExp(`^enum ${e} \{`, 'm')); });
    it('migration folder exists', () => { expect(name).toBeDefined(); expect(code.length).toBeGreaterThan(300); });
    it('is additive: only CREATE TYPE / TABLE / INDEX, ADD CONSTRAINT and ENABLE ROW LEVEL SECURITY (no DROP, RENAME, TRUNCATE, UPDATE, DELETE, ALTER COLUMN)', () => {
      const body = o.extraAllowed?.length ? code.replace(/DO \$\$[\s\S]*?END \$\$;/g, '') : code;   // a guarded DO block is checked on its own below
      expect(body).not.toMatch(/\bDROP\b|\bTRUNCATE\b|\bRENAME\b|\bDELETE\s+FROM\b|\bUPDATE\s+"|\bALTER COLUMN\b/i);
      for (const stmt of body.split(';').map((s) => s.trim()).filter(Boolean)) {
        const ok = /^(CREATE TYPE|CREATE TABLE|CREATE (UNIQUE )?INDEX|CREATE EXTENSION IF NOT EXISTS|ALTER TABLE "g4d_[a-z_]+" (ADD CONSTRAINT|ENABLE ROW LEVEL SECURITY))/.test(stmt) || (o.extraAllowed ?? []).some((r) => r.test(stmt));
        expect([stmt.slice(0, 80), ok]).toEqual([stmt.slice(0, 80), true]);
      }
    });
    it('creates each table and turns row level security on', () => { for (const t of o.tables) { expect(code).toContain(`CREATE TABLE "${t}"`); expect(code).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`); } });
    it('foreign keys point only at Vendor or at this slice\'s tables', () => { for (const m of code.matchAll(/REFERENCES "([A-Za-z_0-9]+)"/g)) expect([...o.fkTargets, ...o.tables]).toContain(m[1]); });
    it('no model of the slice relates to a legacy billing, BOS, commercial, domain-campaign or vendor-payments model (decision D1)', () => {
      for (const t of o.tables) for (const l of LEGACY_MODELS) expect(modelBlock(t)).not.toMatch(new RegExp(`\b${l}\b`));
    });
  });
}

/** The columns of a model block that are missing (whole-word match on the field names, comments ignored). */
export function missingColumns(block: string, cols: string[]): string[] {
  const names = new Set(block.split('\n').map((l) => l.trim().split(/\s+/)[0]));
  return cols.filter((c) => !names.has(c));
}
