import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TrialSiteInput, TrialSitePort } from '../plans/registration/trial-site.port';
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
    const build = this.modules.get(SiteBuildService, { strict: false });
    const publish = this.modules.get(PublishService, { strict: false });
    const actor = { type: 'VENDOR' as const, id: i.vendorId, ip: null };
    const { publication } = await build.build(i.vendorId, { actor });
    if (publication.status !== 'PUBLISHED') await publish.publish(i.vendorId, publication.id, actor);
    return { siteId, published: true };
  }
}
