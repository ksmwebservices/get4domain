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
const PLATFORM_ONLY_WITH_VENDOR_ID = ['V3ProvisioningJob', 'V3AccountSetupGrant', 'V3SiteRemoval', 'V3AccountDeletionRequest', 'V3SeededSite',
  // slice 5.14: reached ONLY through RequestsStore, which carries the vendor id in the WHERE of every vendor read and write (tested: vendor B cannot read, change or invoice vendor A's rows);
  // the public routes find the vendor from the HOST, where no signed-in tenant exists. Moving them to the tenant-scoped client is an OPEN QUESTION in docs/v3/B3_LOG.md.
  'V3Request', 'V3VendorPaymentMethod', 'V3Order', 'V3VendorPaymentEvent', 'V3VendorInvoice', 'V3VendorCounter', 'V3StockLevel', 'V3StockReservation', 'V3Offer', 'V3MessageOutbox',
  // slice 5.15: acceptances are written and read only through TermsStore, which carries the vendor id in the WHERE of every read and write; no tenant-scoped route reads another vendor's rows
  'V3TermsAcceptance',
  // slice 5.17b (Batch 5): pay requests and payments are reached ONLY through PaymentsStore, which carries the vendor id in the WHERE of every vendor read and write; the public pay page finds the row by its unguessable code (cross-tenant tested)
  'V3PaymentRequest', 'V3Payment',
  // slice 5.17d: documents, the series and the tax profile are reached ONLY through DocumentsStore (vendor id in every WHERE; the public page finds a document by its unguessable code); the outbox is read by the sender only
  'V3VendorTaxProfile', 'V3InvoiceSeries', 'V3VendorDocument', 'V3Outbox',
  // slice 5.16a (Batch 4): the wallet, its append-only ledger, lots, top-ups and receipts are reached ONLY through WalletStore / prismaWalletTx, which carry the vendor id in the WHERE of every read and
  // write (tested: vendor B cannot read, confirm or spend vendor A's wallet). Moving them to the tenant-scoped client is an OPEN QUESTION in docs/v3/B4_LOG.md.
  'V3Wallet', 'V3WalletLedger', 'V3WalletTopup', 'V3WalletReceipt', 'V3WalletLot',
  // slice 5.16b: a pack purchase is written and read only through ServicesStore, which carries the vendor id in the WHERE of every read and write (tested: vendor B cannot see or use vendor A's pack)
  'V3PackPurchase',
  // slice 5.16c: requests, their history, deliverables and invoices are reached only through RequestsStore, which carries the vendor id in the WHERE of every read and write (tested: vendor B cannot see, cancel or approve vendor A's request)
  'V3ServiceRequest', 'V3ServiceRequestEvent', 'V3ServiceDeliverable', 'V3ServiceInvoice',
  // slice 5.16d: theme switches are reached only through ThemeSwitchStore, which carries the vendor id in the WHERE of every read and write (tested: vendor B cannot see or repeat vendor A's switch)
  'V3ThemeSwitch',
  // slice 5.20 (Batch 4B): the activity log and the alerts are written through ActivityService and read through ActivityStore, which carries the vendor id in the WHERE of every vendor read (tested: vendor B cannot see vendor A's rows); staff read across vendors
  'V3ActivityLog', 'V3Alert',
  // slice 5.21 (Batch 4B): proofs and takedowns are reached only through TrustStore, which carries the vendor id in the WHERE of every vendor read (tested: vendor B cannot see vendor A's proofs or takedown); staff read across vendors; a takedown has no foreign key because it outlives the vendor row
  'V3BusinessProof', 'V3Takedown',
  // slice 5.5a (Batch 9): drafts and snapshots are reached only through WebsiteStore (and the snapshot sink / live layer in site-publish), which carry the vendor id in the WHERE of every read and write (tested: vendor B cannot see or change vendor A's draft)
  'V3SiteDraft', 'V3SiteSnapshot'];   // the grant is consumed by the set-password endpoint, no vendor route reads it; a removal row is written by staff and the removal flow and read only by the public host lookup (a removed business must look unknown); the deletion request is created for the signed-in owner by the service and read by staff across vendors

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
