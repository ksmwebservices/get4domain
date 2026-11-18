import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TrialSiteInput, TrialSitePort } from '../plans/registration/trial-site.port';
import { PrismaService } from '../prisma/prisma.service';
import { SiteProvisioner } from '../provisioning/site/site-provisioner';
import { PublishService } from '../site-publish/publish/publish.service';
import { SiteBuildService } from '../site-publish/publish/site-build.service';

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
    const { siteId } = await provisioner.createDraftSite({ vendorId: i.vendorId, track: i.track, category: i.category, businessName: i.businessName, language: 'en', ...(i.city ? { city: i.city } : {}), ...(i.phone ? { phone: i.phone } : {}) });
    await this.ensureBanner(i.vendorId);
    const build = this.modules.get(SiteBuildService, { strict: false });
    const publish = this.modules.get(PublishService, { strict: false });
    const actor = { type: 'VENDOR' as const, id: i.vendorId, ip: null };
    const { publication } = await build.build(i.vendorId, { actor });
    if (publication.status !== 'PUBLISHED') await publish.publish(i.vendorId, publication.id, actor);
    return { siteId, published: true };
  }

  /**
   * B2.2: every trial site has a banner. The industry pack's own starter pictures (original artwork under /starter/<pack>/, no photographs) are used when the pack has them; a business whose
   * category has no pack, or a pack without pictures, gets one plain generated banner (a gradient SVG file, no stock photo). It is marked as a sample like any starter picture, so the vendor
   * replaces it in the website manager (hero.image) and it is never counted as their own. Only an EMPTY banner is touched; a failure here never stops the site.
   */
  private async ensureBanner(vendorId: string): Promise<void> {
    try {
      const prisma = this.modules.get(PrismaService, { strict: false });
      const row = await prisma.vendorCMS.findUnique({ where: { vendorId }, select: { banner: true, draft: true } });
      if (!row) return;
      const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
      const draft = obj(row.draft);
      if (String(('banner' in draft ? draft.banner : row.banner) ?? '').trim()) return;
      const extras = obj(draft.extras);
      await prisma.vendorCMS.update({ where: { vendorId }, data: { banner: GENERATED_BANNER, draft: { ...draft, banner: GENERATED_BANNER, extras: { ...extras, sample: { ...obj(extras.sample), banner: true } } } as never } });
    } catch { /* a banner is a nicety: the site is made without it */ }
  }
}

/** The plain generated banner (a file in the website's public folder, drawn from gradients and circles). */
export const GENERATED_BANNER = '/starter/generic/hero.svg';
