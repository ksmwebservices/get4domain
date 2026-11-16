/**
 * The seam between self-registration and the website (Wave 3 Part G). After a vendor registers, the Free trial site is built and published on the subdomain chosen. The real implementation lives in the
 * trial module (it needs the provisioning and publishing services); the plans module only knows this port, so no import cycle exists. Absent port = no site is made (a build without the trial module).
 * Contract: idempotent for a vendor (a second call makes nothing new); the Free site is informational; it may throw, and the caller (RegistrationHook) never lets that block a signup.
 */
export interface TrialSiteInput { vendorId: string; track: string; category: string; businessName: string; phone?: string | null; city?: string | null }
export abstract class TrialSitePort {
  abstract createLiveTrialSite(input: TrialSiteInput): Promise<{ siteId: string; published: boolean }>;
}
