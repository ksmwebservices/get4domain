import { describeSchemaSlice, migrationSql, missingColumns, modelBlock, schemaText } from './support/schema-checks';

/** Batch 4 slice 5.16d: the theme switch history. */
describeSchemaSlice('slice 5.16d', { suffix: '_v3_theme_switch', tables: ['g4d_theme_switches'], enums: ['V3ThemeSwitchKind', 'V3ThemeSwitchStatus'], fkTargets: ['Vendor'] });

describe('slice 5.16d columns and rules', () => {
  const m = migrationSql('_v3_theme_switch'); const b = modelBlock('g4d_theme_switches');
  it('keeps the vendor, the two themes, the kind, who did it, what carried the fee, the publication it made, the status, the key and the hidden-field record', () => {
    expect(missingColumns(b, ['vendorId', 'siteId', 'fromThemeKey', 'toThemeKey', 'kind', 'performedByType', 'performedById', 'serviceRequestId', 'ledgerEntryId', 'packPurchaseId', 'priceSnapshotPaise', 'taxSnapshotJson', 'publicationId', 'status', 'idempotencyKey', 'reason', 'failureReason', 'hiddenFieldsJson'])).toEqual([]);
  });
  it('one switch per vendor and key, one switch per charge, and a status that starts as PENDING', () => { expect(b).toMatch(/@@unique\(\[vendorId, idempotencyKey\]\)/); expect(b).toMatch(/ledgerEntryId\s+String\?\s+@unique/); expect(b).toMatch(/status\s+V3ThemeSwitchStatus\s+@default\(PENDING\)/); });
  it('the kinds are exactly the four the owner named', () => { expect(b).toMatch(/kind\s+V3ThemeSwitchKind/); expect(/^enum V3ThemeSwitchKind \{([\s\S]*?)\}/m.exec(schemaText)![1].split('\n').map((l: string) => l.trim()).filter(Boolean)).toEqual(['FREE_INCLUDED', 'PAID', 'COMPLIMENTARY_STAFF', 'RESTORE']); });
  it('the database refuses a PAID switch with nothing that paid, a free or restoring switch with a charge, a gift with no reason, and a non-positive amount', () => {
    expect(m.code).toMatch(/"g4d_theme_switches_paid_chk" CHECK \(\("kind" = 'PAID' AND \("ledgerEntryId" IS NOT NULL OR "packPurchaseId" IS NOT NULL OR "serviceRequestId" IS NOT NULL\)\) OR \("kind" <> 'PAID' AND "ledgerEntryId" IS NULL AND "packPurchaseId" IS NULL\)\)/);
    expect(m.code).toMatch(/"g4d_theme_switches_gift_reason_chk" CHECK \("kind" <> 'COMPLIMENTARY_STAFF' OR \("reason" IS NOT NULL AND length\("reason"\) >= 5\)\)/);
    expect(m.code).toMatch(/"g4d_theme_switches_amount_chk" CHECK \("priceSnapshotPaise" IS NULL OR "priceSnapshotPaise" > 0\)/);
  });
  it('it is the folder after the service requests folder, and nothing else is in it', () => { expect(m.name).toBe('20261121100000_v3_theme_switch'); expect(m.code.match(/CREATE TABLE/g)).toHaveLength(1); });
});
