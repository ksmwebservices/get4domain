import { LEGACY_MODELS, migrationSql, missingColumns, modelBlock, schemaText } from './support/schema-checks';

/**
 * Batch 4B slice 5.21: proofs, the trust block list, reports, prohibited terms and takedowns. No database here: the migration text and the Prisma models are checked, and the staging suite
 * (trust.int.spec.ts, NOT RUN without a staging database) proves the trigger, the constraints and the takedown effect on the listing. The trust block list is g4d_trust_blocklist because
 * g4d_blocklist is the older do-not-contact register, which this slice never touches.
 */
const m = migrationSql('_v3_trust_safety');
const TABLES = ['g4d_business_proofs', 'g4d_trust_blocklist', 'g4d_business_reports', 'g4d_prohibited_terms', 'g4d_takedowns'];
const enumBody = (e: string): string[] => new RegExp(`^enum ${e} \\{([\\s\\S]*?)\\}`, 'm').exec(schemaText)![1].split('\n').map((l) => l.trim()).filter(Boolean);

describe('slice 5.21: migration folder', () => {
  it('is the folder right after the activity folder, and holds exactly the five tables with row-level rules on', () => {
    expect(m.name).toBe('20261124100000_v3_trust_safety');
    expect(m.code.match(/CREATE TABLE/g)).toHaveLength(5);
    for (const t of TABLES) { expect(m.code).toContain(`CREATE TABLE "${t}"`); expect(m.code).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`); }
  });
  it('is additive: no DROP, RENAME, TRUNCATE, DELETE FROM, UPDATE of a row or ALTER COLUMN', () => { expect(m.code).not.toMatch(/\bDROP\b|\bTRUNCATE\b|\bRENAME\b|\bDELETE\s+FROM\b|\bUPDATE\s+"|\bALTER COLUMN\b/i); });
  it('every statement outside the function body is a CREATE TYPE, TABLE, INDEX or TRIGGER, an ADD CONSTRAINT or ENABLE ROW LEVEL SECURITY', () => {
    const outside = m.code.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$ LANGUAGE plpgsql;/g, '');
    for (const stmt of outside.split(';').map((x) => x.trim()).filter(Boolean)) expect([stmt.slice(0, 70), /^(CREATE TYPE|CREATE TABLE|CREATE (UNIQUE )?INDEX|CREATE TRIGGER|ALTER TABLE "g4d_[a-z_0-9]+" (ADD CONSTRAINT|ENABLE ROW LEVEL SECURITY))/.test(stmt.replace(/^(--[^\n]*\n)+/g, '').trim())]).toEqual([stmt.slice(0, 70), true]);
  });
  it('has exactly one foreign key (proofs to the vendor); the takedown has none so it outlives the vendor row', () => {
    expect(m.code.match(/REFERENCES/g)).toHaveLength(1); expect(m.code).toContain('"g4d_business_proofs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id")');
  });
  it('never creates or alters the older do-not-contact register (g4d_blocklist) or its enum', () => { expect(m.code).not.toMatch(/"g4d_blocklist"|"V3BlockKind"/); });
  it('no model relates to a legacy model', () => { for (const t of TABLES) for (const l of LEGACY_MODELS) expect(modelBlock(t)).not.toMatch(new RegExp(`\\b${l}\\b`)); });
});

describe('slice 5.21: the models', () => {
  it('every table has a cuid id', () => { for (const t of TABLES) expect(modelBlock(t)).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/); });
  it('a proof: one per vendor and kind, starting SUBMITTED', () => {
    const b = modelBlock('g4d_business_proofs'); expect(missingColumns(b, ['vendorId', 'kind', 'number', 'documentRef', 'status', 'checkedBy'])).toEqual([]);
    expect(b).toMatch(/@@unique\(\[vendorId, kind\]\)/); expect(b).toMatch(/status\s+V3ProofStatus\s+@default\(SUBMITTED\)/);
  });
  it('the block list keeps a HASH, never the value, unique per kind', () => {
    const b = modelBlock('g4d_trust_blocklist'); expect(missingColumns(b, ['kind', 'valueHash', 'reason', 'at'])).toEqual([]); expect(b).toMatch(/@@unique\(\[kind, valueHash\]\)/); expect(b).not.toMatch(/\bvalue\s+String/);
  });
  it('a report needs no personal data: the contact is optional; it starts NEW', () => {
    const b = modelBlock('g4d_business_reports'); expect(b).toMatch(/reporterContact\s+String\?/); expect(b).toMatch(/status\s+V3BusinessReportStatus\s+@default\(NEW\)/); expect(missingColumns(b, ['subjectType', 'subject', 'reason'])).toEqual([]);
  });
  it('the prohibited-term table has a unique term and an on switch, and the migration seeds NO phrase', () => {
    const b = modelBlock('g4d_prohibited_terms'); expect(b).toMatch(/term\s+String\s+@unique/); expect(b).toMatch(/enabled\s+Boolean\s+@default\(true\)/); expect(m.code).not.toMatch(/INSERT INTO/i);
  });
  it('a takedown keeps target, reason, document, decider, time, status starting ACTIVE, and the reversal', () => {
    const b = modelBlock('g4d_takedowns'); expect(missingColumns(b, ['vendorId', 'listingId', 'reason', 'documentRef', 'decidedBy', 'at', 'status', 'reversedBy', 'reversedAt', 'reverseReason', 'priorListingStatus', 'priorIndexable'])).toEqual([]);
    expect(b).toMatch(/status\s+V3TakedownStatus\s+@default\(ACTIVE\)/); expect(b).toMatch(/vendorId\s+String\?/); expect(b).toMatch(/listingId\s+String\?/);
  });
  it('the enums are exactly the dispatch\'s words', () => {
    expect(enumBody('V3ProofKind')).toEqual(['GST', 'UDYAM', 'SHOP_LICENCE', 'PROFESSIONAL_REGISTRATION', 'OTHER']);
    expect(enumBody('V3ProofStatus')).toEqual(['SUBMITTED', 'CHECKED', 'MISMATCH']);
    expect(enumBody('V3TrustBlockKind')).toEqual(['PHONE', 'EMAIL', 'DOMAIN', 'UPI', 'NAME']);
    expect(enumBody('V3BusinessReportStatus')).toEqual(['NEW', 'LOOKING', 'CLOSED']);
    expect(enumBody('V3ReportSubject')).toEqual(['LISTING', 'SITE']);
    expect(enumBody('V3TakedownStatus')).toEqual(['ACTIVE', 'REVERSED']);
  });
});

describe('slice 5.21: rules the database enforces', () => {
  it('refuses a takedown with no target, with an empty reason, or reversed without who, when and why', () => {
    expect(m.code).toContain('"g4d_takedowns_target_chk" CHECK ("vendorId" IS NOT NULL OR "listingId" IS NOT NULL)');
    expect(m.code).toContain('"g4d_takedowns_reason_chk" CHECK (length(btrim("reason")) > 0)');
    expect(m.code).toMatch(/"g4d_takedowns_reversal_chk" CHECK \(\("status" = 'ACTIVE' AND "reversedAt" IS NULL AND "reversedBy" IS NULL AND "reverseReason" IS NULL\) OR \("status" = 'REVERSED' AND "reversedAt" IS NOT NULL AND "reversedBy" IS NOT NULL AND length\(btrim\(coalesce\("reverseReason", ''\)\)\) > 0\)\)/);
  });
  it('refuses a delete of a takedown, a change to its reason, decider, time or target, and any change once reversed', () => {
    expect(m.code).toContain('CREATE OR REPLACE FUNCTION g4d_takedown_guard()'); expect(m.code).toMatch(/BEFORE UPDATE OR DELETE ON "g4d_takedowns" FOR EACH ROW/);
    expect(m.code).toContain("RAISE EXCEPTION 'g4d_takedowns rows cannot be deleted'"); expect(m.code).toContain("RAISE EXCEPTION 'g4d_takedowns reason, decider, time and target cannot be changed'"); expect(m.code).toContain("RAISE EXCEPTION 'a reversed takedown cannot be changed'");
    for (const f of ['reason', 'decidedBy', 'at', 'vendorId', 'listingId', 'documentRef']) expect(m.code).toContain(`NEW."${f}" IS DISTINCT FROM OLD."${f}"`);
  });
  it('refuses a proof that is CHECKED or MISMATCH without a checker, or a SUBMITTED one with one', () => {
    expect(m.code).toMatch(/"g4d_business_proofs_checked_chk" CHECK \(\("status" = 'SUBMITTED' AND "checkedBy" IS NULL\) OR \("status" IN \('CHECKED', 'MISMATCH'\) AND "checkedBy" IS NOT NULL AND "checkedAt" IS NOT NULL\)\)/);
  });
});
