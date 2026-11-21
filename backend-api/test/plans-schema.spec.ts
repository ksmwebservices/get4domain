import * as fs from 'fs';
import * as path from 'path';

/**
 * S51.2: the V3 plans / entitlements schema. Static checks on schema.prisma and the migration folder (no database): the tables exist with the
 * names the slice spec fixes, the migration is ADDITIVE only, every new table has row level security, and nothing points at a legacy
 * billing / BOS / commercial table (owner decision D1).
 */
const backend = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(backend, 'prisma/schema.prisma'), 'utf8');
const migrationsDir = path.join(backend, 'prisma/migrations');
const migrationName = fs.readdirSync(migrationsDir).find((d) => /_v3_plans_entitlements$/.test(d));
const sql = migrationName ? fs.readFileSync(path.join(migrationsDir, migrationName, 'migration.sql'), 'utf8') : '';
const sqlCode = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

const TABLES = [
  'g4d_plans', 'g4d_plan_prices', 'g4d_features', 'g4d_plan_features', 'g4d_tax_rates', 'g4d_discount_rules', 'g4d_plan_settings',
  'g4d_plan_subscriptions', 'g4d_subscription_events', 'g4d_entitlement_overrides', 'g4d_audit_logs', 'g4d_vendor_flags',
];
const VENDOR_SCOPED = ['g4d_plan_subscriptions', 'g4d_subscription_events', 'g4d_entitlement_overrides', 'g4d_vendor_flags'];
const LEGACY_MODELS = [
  'Subscription', 'Invoice', 'BillingTerm', 'BillingDeal', 'PlanOverride', 'PlanChangeRequest', 'PromoCode', 'ManualPaymentSubmission',
  'SpecialArrangement', 'CommercialAuditLog', 'PaymentRecord', 'VendorAddon', 'VendorModule',
];

function modelBlock(table: string): string {
  // a model block runs from "model X {" to the first line that is just "}" (a default such as @default("{}") contains a brace)
  for (const m of schema.matchAll(/^model\s+\w+\s*\{[\s\S]*?^\}/gm)) if (m[0].includes(`@@map("${table}")`)) return m[0];
  return '';
}

describe('V3 plans schema (S51.2)', () => {
  it.each(TABLES.map((t) => [t]))('%s is a model with the spec table name and a cuid id', (table) => {
    const block = modelBlock(table);
    expect(block).not.toBe('');
    expect(block).toMatch(/id\s+String\s+@id\s+@default\(cuid\(\)\)/);
  });

  it.each(VENDOR_SCOPED.map((t) => [t]))('%s carries vendorId (tenant guard and the cross-tenant tests cover it)', (table) => {
    expect(modelBlock(table)).toMatch(/\bvendorId\s+String\b/);
  });

  it('adds only the two nullable provenance columns to Vendor', () => {
    const vendor = /model Vendor \{[\s\S]*?\n\}/.exec(schema)![0];
    expect(vendor).toMatch(/\bsource\s+String\?/);
    expect(vendor).toMatch(/\bregisteredByStaffId\s+String\?/);
  });

  it('has no relation from a V3 model to a legacy billing, BOS, commercial or menu-gating model', () => {
    for (const t of TABLES) {
      const block = modelBlock(t);
      for (const legacy of LEGACY_MODELS) expect(block).not.toMatch(new RegExp(`\\b${legacy}\\b`));
    }
  });

  it('the subscription table enforces one current subscription per vendor in the database', () => {
    const block = modelBlock('g4d_plan_subscriptions');
    expect(block).toMatch(/currentVendorId\s+String\?\s+@unique/);
  });
});

describe('V3 plans migration (S51.2)', () => {
  it('exists as prisma/migrations/<timestamp>_v3_plans_entitlements', () => {
    expect(migrationName).toBeDefined();
    expect(sql.length).toBeGreaterThan(500);
  });

  it('is additive only: no drop, truncate, delete, rename, type change or NOT NULL on an existing column', () => {
    for (const [re, what] of [
      [/\bDROP\b/i, 'DROP'], [/\bTRUNCATE\b/i, 'TRUNCATE'], [/\bDELETE\s+FROM\b/i, 'DELETE FROM'], [/\bRENAME\b/i, 'RENAME'],
      [/\bALTER\s+COLUMN\b/i, 'ALTER COLUMN'], [/\bUPDATE\s+"/i, 'UPDATE'],
    ] as [RegExp, string][]) expect({ what, hit: re.test(sqlCode) }).toEqual({ what, hit: false });
  });

  it('only creates new tables, types and indexes, and adds nullable columns to Vendor', () => {
    const statements = sqlCode.split(';').map((s) => s.trim()).filter(Boolean);
    const allowed = /^(CREATE TYPE|CREATE TABLE|CREATE UNIQUE INDEX|CREATE INDEX|ALTER TABLE "g4d_[a-z_]+" (ADD CONSTRAINT|ENABLE ROW LEVEL SECURITY)|ALTER TABLE "Vendor" ADD COLUMN "(source|registeredByStaffId)" TEXT$)/;
    expect(statements.filter((s) => !allowed.test(s))).toEqual([]);
  });

  it.each(TABLES.map((t) => [t]))('enables row level security on %s', (table) => {
    expect(sqlCode).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it('creates every table of the spec', () => {
    for (const t of TABLES) expect(sqlCode).toContain(`CREATE TABLE "${t}"`);
  });

  it('has no foreign key to a legacy table (only to Vendor and to the new tables)', () => {
    const refs = [...sqlCode.matchAll(/REFERENCES\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const r of refs) expect(r === 'Vendor' || TABLES.includes(r)).toBe(true);
  });
});
