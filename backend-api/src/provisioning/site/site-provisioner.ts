/**
 * The seam between provisioning and the website. CREATE_FREE_SITE_DRAFT calls this port and nothing else.
 *
 * TODO (slice 5.4): replace the CmsDraftSiteProvisioner adapter with one that builds the Free site from the theme kit (themes/CONTRACT.md). Nothing in the
 * step, the runner or the API changes when that happens; only the provider bound to SITE_PROVISIONER in ProvisioningModule.
 *
 * Contract: idempotent for a vendor (a second call returns the same site and creates no second one); creates the site in DRAFT state; NEVER publishes
 * (publishing is a vendor or staff action after the claim).
 */
export interface CreateDraftSiteInput {
  vendorId: string;
  track: string;
  category: string;
  businessName: string;
  language: string;
  city?: string;
  phone?: string;
  /** The mode the runner already read for this job (slice 5.4). When absent the adapter reads the setting itself. */
  siteDraftBuilderMode?: 'legacy' | 'renderer';
}

export abstract class SiteProvisioner {
  abstract createDraftSite(input: CreateDraftSiteInput): Promise<{ siteId: string }>;
}
