import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TrialSiteInput, TrialSitePort } from '../plans/registration/trial-site.port';
import { PrismaService } from '../prisma/prisma.service';
import { SiteProvisioner } from '../provisioning/site/site-provisioner';
import { PublishService } from '../site-publish/publish/publish.service';
import { SiteBuildService } from '../site-publish/publish/site-build.service';
import { FreeHomeContentService } from './free-home-content.service';

/**
 * The Free trial site of a self-service vendor (Wave 3 Part G): the draft is built from the industry pack and the business details through the existing site provisioner, then built and published through the
 * existing site-publish services, on the subdomain the vendor registered. The services are looked up through ModuleRef (like the seeded-site publisher does), so this module imports neither the provisioning
 * nor the publishing module and no cycle exists. A Free site is informational: this makes no shop and no paid feature. Idempotent for a vendor: the provisioner returns the same site, and a site that is already
 * published is not published twice. Every failure is raised to the caller (RegistrationHook), which logs it without the error text and never lets it block the signup.
 */
@Injectable()
export class ModuleTrialSite extends TrialSitePort {
  constructor(private readonly modules: ModuleRef) { super(); }

  async createLiveTrialSite(i: TrialSiteInput): Promise<{ siteId: string; published: boolean }> {
    const provisioner = this.modules.get(SiteProvisioner, { strict: false });
    const { siteId } = await this.stage('draft', () => provisioner.createDraftSite({ vendorId: i.vendorId, track: i.track, category: i.category, businessName: i.businessName, language: 'en', ...(i.city ? { city: i.city } : {}), ...(i.phone ? { phone: i.phone } : {}) }));
    await this.stage('content', () => this.modules.get(FreeHomeContentService, { strict: false }).ensure(i.vendorId, { track: i.track, city: i.city, area: i.area, pincode: i.pincode }));   // S1.2: renderable home content from the registration details
    const build = this.modules.get(SiteBuildService, { strict: false });
    const publish = this.modules.get(PublishService, { strict: false });
    const actor = { type: 'VENDOR' as const, id: i.vendorId, ip: null };
    const before = await this.stage('publish', () => this.goLive(i.vendorId));
    try {
      const { publication } = await this.stage('build', () => build.build(i.vendorId, { actor }));
      if (publication.status !== 'PUBLISHED') await this.stage('publish', () => publish.publish(i.vendorId, publication.id, actor));
    } catch (e) { await this.restoreStatus(i.vendorId, before); throw e; }
    return { siteId, published: true };
  }

  /**
   * S1.1: the public site app reads the legacy route GET /cms/site/<subdomain>, which answers 404 for any VendorCMS row whose siteStatus is not LIVE. The V3 publish never touched that column, so a
   * published Free site stayed DRAFT there and its address showed the bare 404. The row is set to LIVE BEFORE the build (the build hashes the row, so setting it afterwards would make the next retry a
   * second version) and put back if the build or publish fails, so an unpublished site is never shown. Returns the status it replaced, or null when nothing changed.
   */
  private async goLive(vendorId: string): Promise<string | null> {
    const prisma = this.modules.get(PrismaService, { strict: false });
    const row = await prisma.vendorCMS.findUnique({ where: { vendorId }, select: { siteStatus: true } });
    if (!row || row.siteStatus === 'LIVE') return null;
    await prisma.vendorCMS.update({ where: { vendorId }, data: { siteStatus: 'LIVE' } });
    return row.siteStatus;
  }

  private async restoreStatus(vendorId: string, previous: string | null): Promise<void> {
    if (previous === null) return;
    try { await this.modules.get(PrismaService, { strict: false }).vendorCMS.update({ where: { vendorId }, data: { siteStatus: previous } }); } catch { /* the failure being raised is the one that matters */ }
  }

  /** B6.1: marks a failure with the stage that raised it (draft, build or publish) so the registration log and the failure record can say where it stopped. The error itself is re-thrown unchanged. */
  private async stage<T>(name: 'draft' | 'content' | 'build' | 'publish', run: () => Promise<T>): Promise<T> {
    try { return await run(); } catch (e) { if (e && typeof e === 'object') (e as { siteStage?: string }).siteStage = name; throw e; }
  }
}

