import * as fs from 'fs';
import * as path from 'path';

/**
 * S53.2: the provisioning schema. Static checks on schema.prisma and the migration folder (no database): the four tables exist with the names the
 * slice spec fixes, the migration is ADDITIVE only, every new table has row level security, and nothing points at a legacy table (decision D1).
 */
const backend = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(backend, 'prisma/schema.prisma'), 'utf8');
const migrationsDir = path.join(backend, 'prisma/migrations');
const migrationName = fs.readdirSync(migrationsDir).find((d) => /_v3_provisioning$/.test(d));
const sql = migrationName ? fs.readFileSync(path.join(migrationsDir, migrationName, 'migration.sql'), 'utf8') : '';
const sqlCode = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

const TABLES = ['g4d_provisioning_jobs', 'g4d_provisioning_steps', 'g4d_claim_tokens', 'g4d_invites'];
const ENUMS = ['V3JobKind', 'V3JobStatus', 'V3StepKey', 'V3StepStatus', 'V3ClaimPurpose', 'V3ClaimStatus', 'V3InviteChannel', 'V3InviteMode', 'V3InviteStatus'];
const LEGACY_MODELS = [
  'Subscription', 'Invoice', 'BillingTerm', 'BillingDeal', 'PlanOverride', 'PlanChangeRequest', 'PromoCode', 'ManualPaymentSubmission',
  'SpecialArrangement', 'CommercialAuditLog', 'PaymentRecord', 'VendorAddon', 'VendorModule',
];

function modelBlock(table: string): string {
  for (const m of schema.matchAll(/^model\s+\w+\s*\{[\s\S]*?^\}/gm)) if (m[0].includes(`@@map("${table}")`)) return m[0];
  return '';
}

describe('V3 provisioning schema (S53.2)', () => {
  it.each(TABLES.map((t) => [t]))('%s is a model with the spec table name and a cuid id', (table) => {
    const block = modelBlock(table);
    expect(block).not.toBe('');
    expect(block).toMatch(/id\s+String\s+@id\s+@default\(cuid\(\)\)/);
  });

  it.each(ENUMS.map((e) => [e]))('enum %s exists', (name) => {
    expect(schema).toMatch(new RegExp(`^enum ${name} \\{`, 'm'));
  });

  it('jobs: unique idempotency key, nullable vendor, lease columns, sanitised error columns', () => {
    const b = modelBlock('g4d_provisioning_jobs');
    expect(b).toMatch(/idempotencyKey\s+String\s+@unique/);
    expect(b).toMatch(/vendorId\s+String\?/);
    for (const col of ['currentStep', 'attempt', 'maxAttempts', 'nextRunAt', 'lockedBy', 'lockedUntil', 'lastErrorCode', 'lastErrorMessage', 'createdByType', 'createdById']) expect(b).toMatch(new RegExp(`\\b${col}\\b`));
  });

  it('steps: one row per job and step key', () => {
    expect(modelBlock('g4d_provisioning_steps')).toMatch(/@@unique\(\[jobId, stepKey\]\)/);
  });

  it('claim tokens: only the hash is stored, and the database allows one ACTIVE token per vendor and purpose', () => {
    const b = modelBlock('g4d_claim_tokens');
    expect(b).toMatch(/tokenHash\s+String\s+@unique/);
    expect(b).not.toMatch(/\b(token|rawToken)\s+String\b/);
    expect(b).toMatch(/activeKey\s+String\?\s+@unique/);
    expect(b).toMatch(/\bvendorId\s+String\b/);
  });

  it('invites carry vendorId and a masked-preview column; the full body exists only as the nullable sandbox column', () => {
    const b = modelBlock('g4d_invites');
    expect(b).toMatch(/\bvendorId\s+String\b/);
    expect(b).toMatch(/bodyPreview\s+String/);
    expect(b).toMatch(/sandboxBody\s+String\?/);
  });

  it('has no relation from a provisioning model to a legacy billing, BOS, commercial or menu-gating model', () => {
    for (const t of TABLES) for (const legacy of LEGACY_MODELS) expect(modelBlock(t)).not.toMatch(new RegExp(`\\b${legacy}\\b`));
  });

  describe('migration', () => {
    it('exists, named *_v3_provisioning', () => { expect(migrationName).toBeDefined(); expect(sql.length).toBeGreaterThan(500); });
    it('is additive: only CREATE TYPE, CREATE TABLE, CREATE INDEX, ADD FOREIGN KEY and ENABLE ROW LEVEL SECURITY', () => {
      expect(sqlCode).not.toMatch(/\bDROP\b|\bTRUNCATE\b|\bRENAME\b|\bDELETE\s+FROM\b|\bUPDATE\s+"/i);
      expect(sqlCode).not.toMatch(/ALTER TABLE "(?!g4d_)[A-Za-z]+"\s+(DROP|ALTER COLUMN|RENAME)/);
      for (const stmt of sqlCode.split(';').map((s) => s.trim()).filter(Boolean)) {
        expect(stmt).toMatch(/^(CREATE TYPE|CREATE TABLE|CREATE (UNIQUE )?INDEX|ALTER TABLE "g4d_[a-z_]+" (ADD CONSTRAINT|ENABLE ROW LEVEL SECURITY))/);
      }
    });
    it('creates each table and turns row level security on for it', () => {
      for (const t of TABLES) {
        expect(sqlCode).toContain(`CREATE TABLE "${t}"`);
        expect(sqlCode).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
      }
    });
    it('foreign keys point only at Vendor or at provisioning tables', () => {
      for (const m of sqlCode.matchAll(/REFERENCES "([A-Za-z_]+)"/g)) expect(['Vendor', ...TABLES]).toContain(m[1]);
    });
  });
});
