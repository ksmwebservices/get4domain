import { describeSchemaSlice, modelBlock, missingColumns } from './support/schema-checks';
import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';

describeSchemaSlice('Pack engine (Amendment 13 Part A)', {
  suffix: '_v3_pack_engine',
  tables: ['g4d_packs', 'g4d_pack_tabs', 'g4d_capabilities', 'g4d_tier_capabilities', 'g4d_pack_categories', 'g4d_vendor_packs', 'g4d_vendor_capabilities'],
  enums: [],
  fkTargets: ['Vendor'],
});

describe('Pack engine tables', () => {
  it('the two tenant tables carry vendorId (so the tenant guard scopes them) and the reference tables do not', () => {
    for (const m of ['V3VendorPack', 'V3VendorCapability']) expect([m, VENDOR_SCOPED_MODELS.has(m)]).toEqual([m, true]);
    for (const m of ['V3Pack', 'V3PackTab', 'V3Capability', 'V3TierCapability', 'V3PackCategory']) expect([m, VENDOR_SCOPED_MODELS.has(m)]).toEqual([m, false]);
  });
  it('a vendor has exactly one primary pack and one row per capability', () => {
    expect(modelBlock('g4d_vendor_packs')).toMatch(/vendorId\s+String\s+@unique/);
    expect(modelBlock('g4d_vendor_capabilities')).toMatch(/@@unique\(\[vendorId, capabilityKey\]\)/);
  });
  it('the tier matrix and the tabs are unique per key, so a loader can be run twice', () => {
    expect(modelBlock('g4d_tier_capabilities')).toMatch(/@@unique\(\[tier, capabilityKey\]\)/);
    expect(modelBlock('g4d_pack_tabs')).toMatch(/@@unique\(\[scope, ownerKey, key\]\)/);
  });
  it('no table holds a price column', () => {
    for (const t of ['g4d_packs', 'g4d_pack_tabs', 'g4d_capabilities', 'g4d_tier_capabilities', 'g4d_pack_categories', 'g4d_vendor_packs', 'g4d_vendor_capabilities']) expect(missingColumns(modelBlock(t), ['price', 'pricePaise', 'amount', 'amountPaise'])).toEqual(['price', 'pricePaise', 'amount', 'amountPaise']);
  });
});
