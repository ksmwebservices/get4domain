import { LEGACY_MODELS, migrationSql, missingColumns, modelBlock, schemaText } from './support/schema-checks';

/** Batch 4 slice 5.16c: service requests, their append-only history, deliverables and tax invoices. */
const m = migrationSql('_v3_service_requests');
const TABLES = ['g4d_service_requests', 'g4d_service_request_events', 'g4d_service_deliverables', 'g4d_service_invoices'];

describe('slice 5.16c: migration', () => {
  it('exists, after the services folder', () => { expect(m.name).toBe('20261120100000_v3_service_requests'); expect(m.code.length).toBeGreaterThan(1500); });
  it('is additive: no DROP, RENAME, TRUNCATE, DELETE FROM, UPDATE of a row or ALTER COLUMN', () => { expect(m.code).not.toMatch(/\bDROP\b|\bTRUNCATE\b|\bRENAME\b|\bDELETE\s+FROM\b|\bUPDATE\s+"|\bALTER COLUMN\b/i); });
  it('creates each table with row level security on', () => { for (const t of TABLES) { expect(m.code).toContain(`CREATE TABLE "${t}"`); expect(m.code).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`); } });
  it('foreign keys point only at Vendor, the services table or this slice\'s tables', () => { for (const x of m.code.matchAll(/REFERENCES "([A-Za-z_0-9]+)"/g)) expect(['Vendor', 'g4d_services', ...TABLES]).toContain(x[1]); });
  it('the database refuses a wallet request without its amount and hold, a non-positive amount and a negative revision count', () => {
    expect(m.code).toMatch(/"g4d_service_requests_amounts_chk" CHECK \(\("priceSnapshotPaise" IS NULL OR "priceSnapshotPaise" > 0\) AND "revisionsUsed" >= 0\)/);
    expect(m.code).toMatch(/"g4d_service_requests_funding_chk" CHECK \(\("fundingKind" = 'WALLET' AND "priceSnapshotPaise" IS NOT NULL AND "holdLedgerId" IS NOT NULL\) OR \("fundingKind" <> 'WALLET' AND "holdLedgerId" IS NULL\)\)/);
  });
  it('the history and the invoices are append-only: triggers refuse every update and delete except the cascade of a request that is already gone', () => {
    for (const [fn, table] of [['g4d_service_request_events_immutable', 'g4d_service_request_events'], ['g4d_service_invoices_immutable', 'g4d_service_invoices']]) {
      expect(m.code).toContain(`CREATE OR REPLACE FUNCTION ${fn}()`); expect(m.code).toMatch(new RegExp(`BEFORE UPDATE OR DELETE ON "${table}" FOR EACH ROW`));
      expect(m.code).toMatch(new RegExp(`RAISE EXCEPTION '${table} rows cannot be changed'`)); expect(m.code).toMatch(new RegExp(`IF EXISTS \\(SELECT 1 FROM "g4d_service_requests" WHERE "id" = OLD\\."requestId"\\) THEN\\s+RAISE EXCEPTION '${table} rows cannot be deleted'`));
    }
    expect((m.code.match(/\$\$/g) ?? []).length % 2).toBe(0);
  });
});

describe('slice 5.16c models', () => {
  it('every model has a cuid id (the request id is chosen by the service so the hold can name it)', () => { for (const t of TABLES) expect(modelBlock(t)).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/); });
  it('requests: the money and the ledger links, one per vendor and key, a unique hold and charge', () => {
    const b = modelBlock('g4d_service_requests');
    expect(missingColumns(b, ['vendorId', 'serviceId', 'status', 'briefJson', 'attachmentRefs', 'priceSnapshotPaise', 'taxSnapshotJson', 'fundingKind', 'holdLedgerId', 'chargeLedgerId', 'packPurchaseId', 'assignedStaffId', 'slaDueAt', 'slaBreachedAt', 'readyAt', 'revisionsUsed', 'grantEndsAt', 'grantOverrideId', 'createdByType', 'createdById', 'idempotencyKey'])).toEqual([]);
    expect(b).toMatch(/@@unique\(\[vendorId, idempotencyKey\]\)/); expect(b).toMatch(/holdLedgerId\s+String\?\s+@unique/); expect(b).toMatch(/chargeLedgerId\s+String\?\s+@unique/); expect(b).toMatch(/priceSnapshotPaise\s+Int\?/);
  });
  it('the statuses are exactly the eight the owner named; funding is one of three', () => {
    expect(/^enum V3ServiceRequestStatus \{([\s\S]*?)\}/m.exec(schemaText)![1].split('\n').map((l: string) => l.trim()).filter(Boolean)).toEqual(['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED_BY_TEAM', 'CANCELLED']);
    expect(/^enum V3ServiceFunding \{([\s\S]*?)\}/m.exec(schemaText)![1].split('\n').map((l: string) => l.trim()).filter(Boolean)).toEqual(['INCLUDED_ALLOWANCE', 'PACK', 'WALLET']);
  });
  it('events and invoices have no updatedAt or deletedAt (nothing to change); an invoice is one per request and per ledger entry with a unique number', () => {
    expect(missingColumns(modelBlock('g4d_service_request_events'), ['updatedAt', 'deletedAt'])).toEqual(['updatedAt', 'deletedAt']);
    const i = modelBlock('g4d_service_invoices'); expect(i).toMatch(/requestId\s+String\s+@unique/); expect(i).toMatch(/invoiceNumber\s+String\s+@unique/); expect(i).toMatch(/ledgerEntryId\s+String\s+@unique/); expect(missingColumns(i, ['updatedAt', 'deletedAt'])).toEqual(['updatedAt', 'deletedAt']);
  });
  it('deliverables hold text, a file reference or a link, and who made them', () => { expect(missingColumns(modelBlock('g4d_service_deliverables'), ['requestId', 'vendorId', 'kind', 'text', 'fileRef', 'createdBy'])).toEqual([]); });
  it('a service that has requests cannot be deleted by accident (RESTRICT)', () => { expect(m.code).toMatch(/"g4d_service_requests_serviceId_fkey"[^;]*ON DELETE RESTRICT/); });
});

describe('slice 5.16c: the standard additive rules (checked directly, because the shared helper splits on ";" and the two trigger functions contain some)', () => {
  it('the enums exist and no model of the slice relates to a legacy billing, BOS, commercial, wallet or vendor-payments model', () => {
    for (const e of ['V3ServiceRequestStatus', 'V3ServiceFunding', 'V3ServiceRequestCreator', 'V3DeliverableKind']) expect(schemaText).toMatch(new RegExp(`^enum ${e} \\{`, 'm'));
    for (const t of TABLES) for (const l of [...LEGACY_MODELS, 'Wallet', 'WalletTransaction']) expect(modelBlock(t)).not.toMatch(new RegExp(`\\b${l}\\b`));
  });
  it('every statement outside the two function bodies is a CREATE TYPE, TABLE or INDEX, an ADD CONSTRAINT, a TRIGGER or ENABLE ROW LEVEL SECURITY', () => {
    const outside = m.code.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$ LANGUAGE plpgsql;/g, '');
    for (const stmt of outside.split(';').map((x) => x.trim()).filter(Boolean)) expect([stmt.slice(0, 70), /^(CREATE TYPE|CREATE TABLE|CREATE (UNIQUE )?INDEX|CREATE TRIGGER|ALTER TABLE "g4d_[a-z_]+" (ADD CONSTRAINT|ENABLE ROW LEVEL SECURITY))/.test(stmt)]).toEqual([stmt.slice(0, 70), true]);
  });
});
