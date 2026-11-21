import * as fs from 'fs';
import * as path from 'path';

/**
 * S54.2: the site renderer / publish schema. Static checks on schema.prisma and the migration folder (no database): the tables exist with the names the
 * slice spec fixes, the migration is ADDITIVE only, every new table has row level security, and nothing points at a legacy table (decision D1).
 */
const backend = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(backend, 'prisma/schema.prisma'), 'utf8');
const migrationsDir = path.join(backend, 'prisma/migrations');
const migrationName = fs.readdirSync(migrationsDir).find((d) => /_v3_site_publish$/.test(d));
const sql = migrationName ? fs.readFileSync(path.join(migrationsDir, migrationName, 'migration.sql'), 'utf8') : '';
const sqlCode = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

const TABLES = ['g4d_site_settings', 'g4d_site_publications', 'g4d_site_publication_pages', 'g4d_site_events'];
const ENUMS = ['V3MotionIntensity', 'V3PublicationStatus'];
const LEGACY_MODELS = [
  'Subscription', 'Invoice', 'BillingTerm', 'BillingDeal', 'PlanOverride', 'PlanChangeRequest', 'PromoCode', 'ManualPaymentSubmission',
  'SpecialArrangement', 'CommercialAuditLog', 'PaymentRecord', 'VendorAddon', 'VendorModule', 'SiteVersion',
];

function modelBlock(table: string): string {
  for (const m of schema.matchAll(/^model\s+\w+\s*\{[\s\S]*?^\}/gm)) if (m[0].includes(`@@map("${table}")`)) return m[0];
  return '';
}

describe('V3 site publish schema (S54.2)', () => {
  it.each(TABLES.map((t) => [t]))('%s is a model with the spec table name, a cuid id and a vendorId', (table) => {
    const block = modelBlock(table);
    expect(block).not.toBe('');
    expect(block).toMatch(/id\s+String\s+@id\s+@default\(cuid\(\)\)/);
    expect(block).toMatch(/\bvendorId\s+String\b/);
  });

  it.each(ENUMS.map((e) => [e]))('enum %s exists', (name) => { expect(schema).toMatch(new RegExp(`^enum ${name} \\{`, 'm')); });

  it('settings: one row per vendor, theme, language, variant and motion intensity', () => {
    const b = modelBlock('g4d_site_settings');
    expect(b).toMatch(/vendorId\s+String\s+@unique/);
    for (const col of ['themeId', 'language', 'variant', 'motionIntensity', 'forceNoindex', 'updatedAt']) expect(b).toMatch(new RegExp(`\\b${col}\\b`));
  });

  it('publications: monotonic version per vendor, hashes, indexing and warnings, and a database rule of one PUBLISHED per vendor', () => {
    const b = modelBlock('g4d_site_publications');
    expect(b).toMatch(/@@unique\(\[vendorId, version\]\)/);
    for (const col of ['status', 'themeId', 'themeHash', 'contentHash', 'indexable', 'missingFieldsJson', 'warningsJson', 'createdByType', 'createdById', 'publishedAt', 'rolledBackFromVersion']) expect(b).toMatch(new RegExp(`\\b${col}\\b`));
    expect(b).toMatch(/currentVendorId\s+String\?\s+@unique/);
  });

  it('pages: unique per publication, path and language; html, seo, size and hash stored', () => {
    const b = modelBlock('g4d_site_publication_pages');
    expect(b).toMatch(/@@unique\(\[publicationId, path, lang\]\)/);
    for (const col of ['html', 'seoJson', 'bytes', 'sha256']) expect(b).toMatch(new RegExp(`\\b${col}\\b`));
  });

  it('has no relation from a site model to a legacy billing, BOS, commercial or site-version model', () => {
    for (const t of TABLES) for (const legacy of LEGACY_MODELS) expect(modelBlock(t)).not.toMatch(new RegExp(`\b${legacy}\b`));
  });

  describe('migration', () => {
    it('exists, named *_v3_site_publish', () => { expect(migrationName).toBeDefined(); expect(sql.length).toBeGreaterThan(500); });
    it('is additive: only CREATE TYPE, CREATE TABLE, CREATE INDEX, ADD FOREIGN KEY and ENABLE ROW LEVEL SECURITY', () => {
      expect(sqlCode).not.toMatch(/\bDROP\b|\bTRUNCATE\b|\bRENAME\b|\bDELETE\s+FROM\b|\bUPDATE\s+"/i);
      for (const stmt of sqlCode.split(';').map((s) => s.trim()).filter(Boolean)) {
        expect(stmt).toMatch(/^(CREATE TYPE|CREATE TABLE|CREATE (UNIQUE )?INDEX|ALTER TABLE "g4d_[a-z_]+" (ADD CONSTRAINT|ENABLE ROW LEVEL SECURITY))/);
      }
    });
    it('creates each table and turns row level security on for it', () => {
      for (const t of TABLES) { expect(sqlCode).toContain(`CREATE TABLE "${t}"`); expect(sqlCode).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`); }
    });
    it('foreign keys point only at Vendor or at site tables', () => {
      for (const m of sqlCode.matchAll(/REFERENCES "([A-Za-z_]+)"/g)) expect(['Vendor', ...TABLES]).toContain(m[1]);
    });
  });
});
