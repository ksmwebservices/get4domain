import { describeSchemaSlice, migrationSql, missingColumns, modelBlock } from './support/schema-checks';

/** Batch 4 slice 5.16b: the catalogue, the price book, packs and pack purchases. */
describeSchemaSlice('slice 5.16b', {
  suffix: '_v3_services', tables: ['g4d_services', 'g4d_service_prices', 'g4d_addon_packs', 'g4d_addon_pack_prices', 'g4d_pack_purchases'],
  enums: ['V3ServiceDoneBy', 'V3ServiceDelivery', 'V3ServicePlanRule', 'V3CatalogStatus', 'V3ServicePriceStatus'], fkTargets: ['Vendor'],
});

describe('slice 5.16b columns and rules', () => {
  const m = migrationSql('_v3_services');
  it('services: a unique key, plain-word texts, who does it, how it is delivered, an editable plan-state rule, a track scope, visibility, order and status', () => {
    const b = modelBlock('g4d_services');
    expect(missingColumns(b, ['key', 'name', 'shortDescription', 'includesText', 'approvalText', 'kind', 'doneBy', 'deliveryKind', 'planStateRule', 'trackScope', 'publicVisible', 'sortOrder', 'status'])).toEqual([]);
    expect(b).toMatch(/key\s+String\s+@unique/); expect(b).toMatch(/publicVisible\s+Boolean\s+@default\(false\)/); expect(b).toMatch(/planStateRule\s+V3ServicePlanRule\s+@default\(PRO_ACTIVE_OR_GRACE\)/);
  });
  it('prices: integer paise, a status, an optional start date (required to approve), one row per service and start date, and no default that could be a price', () => {
    for (const t of ['g4d_service_prices', 'g4d_addon_pack_prices']) {
      const b = modelBlock(t);
      expect(missingColumns(b, ['amountPaise', 'currency', 'taxCategory', 'taxInclusive', 'effectiveFrom', 'status', 'approvedBy', 'approvedAt', 'createdBy'])).toEqual([]);
      expect(b).toMatch(/amountPaise\s+Int\b(?!\s+@default)/); expect(b).toMatch(/effectiveFrom\s+DateTime\?/); expect(b).toMatch(/status\s+V3ServicePriceStatus\s+@default\(PROPOSED\)/);
      expect(b).toMatch(/@@unique\(\[(serviceId|packId), effectiveFrom\]\)/);
    }
  });
  it('the database refuses a price that is not positive, an approved price with no date or approver, a pack that lasts less than a day', () => {
    expect(m.code).toMatch(/"g4d_service_prices_amount_chk" CHECK \("amountPaise" > 0\)/); expect(m.code).toMatch(/"g4d_addon_pack_prices_amount_chk" CHECK \("amountPaise" > 0\)/);
    expect(m.code).toMatch(/"g4d_service_prices_approved_dated_chk" CHECK \("status" <> 'APPROVED' OR \("effectiveFrom" IS NOT NULL AND "approvedBy" IS NOT NULL\)\)/);
    expect(m.code).toMatch(/"g4d_addon_packs_validity_chk" CHECK \("validityDays" IS NULL OR "validityDays" > 0\)/);
  });
  it('packs: a unique key, the items as data, a validity that staff set (null by default: it never expires until staff decide), a status that starts as DRAFT', () => {
    const b = modelBlock('g4d_addon_packs');
    expect(b).toMatch(/key\s+String\s+@unique/); expect(b).toMatch(/validityDays\s+Int\?/); expect(b).toMatch(/status\s+V3CatalogStatus\s+@default\(DRAFT\)/); expect(missingColumns(b, ['itemsJson'])).toEqual([]);
  });
  it('a pack purchase: one per vendor and key, one per ledger entry, a copy of the price and tax, counts that run down', () => {
    const b = modelBlock('g4d_pack_purchases');
    expect(missingColumns(b, ['vendorId', 'packId', 'idempotencyKey', 'remainingJson', 'priceSnapshotPaise', 'taxSnapshotJson', 'purchasedAt', 'expiresAt', 'ledgerEntryId'])).toEqual([]);
    expect(b).toMatch(/@@unique\(\[vendorId, idempotencyKey\]\)/); expect(b).toMatch(/ledgerEntryId\s+String\s+@unique/);
  });
  it('a service or pack that has prices cannot be deleted by accident (RESTRICT)', () => { expect(m.code).toMatch(/"g4d_service_prices_serviceId_fkey"[^;]*ON DELETE RESTRICT/); expect(m.code).toMatch(/"g4d_addon_pack_prices_packId_fkey"[^;]*ON DELETE RESTRICT/); });
});
