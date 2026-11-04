import { Prisma } from '@prisma/client';
import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';

/**
 * S53.2 Part A: a CI-level net under the tenant guard for the V3 tables. `VENDOR_SCOPED_MODELS` is derived from the Prisma data model, so a table
 * with a `vendorId` is scoped the moment it exists; what this test adds is that every V3 table that carries a `vendorId` has been CLASSIFIED by a
 * person: either tenant data (a vendor's own rows, reachable by vendor routes) or a platform table that only staff read. A new V3 table with a
 * vendorId that is in neither list fails here, so it cannot slip in unreviewed. The cross-tenant behaviour tests are in plans-tenant.int.spec.ts
 * and provisioning-tenant.int.spec.ts.
 */
const TENANT_V3 = [
  'V3PlanSubscription', 'V3SubscriptionEvent', 'V3EntitlementOverride', 'V3VendorFlag',   // slice 5.1
  'V3ClaimToken', 'V3Invite',                                                              // slice 5.3
  'V3SiteSettings', 'V3SitePublication', 'V3SitePublicationPage', 'V3SiteEvent',          // slice 5.4
  'V3Domain', 'V3DomainVerification', 'V3Redirect',
  'V3DirectoryBusiness',                                                                   // slice 5.7: vendor routes /v3/me/directory (vendorId is null while unclaimed)                                        // slice 5.6
  'V3PlanOrder', 'V3PlanInvoice',                                                           // slice 5.1b: vendor routes /v3/me/billing/orders and /invoices
  'V3AiUsage', 'V3AiCreditGrant',                                                          // slice 5.11: vendor routes /v3/me/ai/usage
];
/** carry a vendorId only as a back-reference for staff; no vendor route reads them */
const PLATFORM_ONLY_WITH_VENDOR_ID = ['V3ProvisioningJob', 'V3AccountSetupGrant'];   // the grant is consumed by the set-password endpoint, no vendor route reads it

const v3WithVendorId = Prisma.dmmf.datamodel.models.filter((m) => /^V3/.test(m.name) && m.fields.some((f) => f.name === 'vendorId' && f.kind === 'scalar')).map((m) => m.name);

describe('tenant model registry (V3 tables)', () => {
  it('every V3 model that carries a vendorId is classified as tenant data or platform-only', () => {
    const unclassified = v3WithVendorId.filter((n) => !TENANT_V3.includes(n) && !PLATFORM_ONLY_WITH_VENDOR_ID.includes(n));
    expect(unclassified).toEqual([]);
  });

  it('every classified tenant table exists in the schema and is in VENDOR_SCOPED_MODELS', () => {
    for (const n of TENANT_V3) {
      expect(v3WithVendorId).toContain(n);
      expect(VENDOR_SCOPED_MODELS.has(n)).toBe(true);
    }
  });

  it('every classified platform-only table exists in the schema (the list does not rot)', () => {
    for (const n of PLATFORM_ONLY_WITH_VENDOR_ID) expect(v3WithVendorId).toContain(n);
  });

  it('every model with a vendorId anywhere in the schema is in VENDOR_SCOPED_MODELS', () => {
    const all = Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === 'vendorId' && f.kind === 'scalar')).map((m) => m.name);
    expect(all.filter((n) => !VENDOR_SCOPED_MODELS.has(n))).toEqual([]);
  });

  it('the platform tables without a vendorId (steps) are NOT tenant data', () => {
    expect(VENDOR_SCOPED_MODELS.has('V3ProvisioningStep')).toBe(false);
  });
});
