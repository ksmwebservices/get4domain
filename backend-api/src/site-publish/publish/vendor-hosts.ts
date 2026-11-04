/**
 * What the site build needs to know about a vendor's hosts (slice 5.6), as a port so site-publish does not depend on the domain tables.
 * `primary` is the canonical host (the custom domain only while it is ACTIVE and the plan allows it); `hasVerifiedCustomDomain` feeds the render entitlement customDomain.
 */
export abstract class VendorHosts {
  abstract primary(vendorId: string): Promise<{ host: string | null; isCustom: boolean }>;
  abstract hasVerifiedCustomDomain(vendorId: string): Promise<boolean>;
}
