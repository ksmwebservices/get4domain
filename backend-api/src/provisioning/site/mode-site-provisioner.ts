import { Injectable } from '@nestjs/common';
import { ProvisioningSettingsService } from '../settings/provisioning-settings.service';
import { CmsDraftSiteProvisioner } from './cms-draft-site-provisioner';
import { DraftSiteBuilder } from './draft-site-builder';
import { CreateDraftSiteInput, SiteProvisioner } from './site-provisioner';

/**
 * What CREATE_FREE_SITE_DRAFT binds to (slice 5.4). The plan setting siteDraftBuilderMode decides:
 *  - legacy (the default): exactly the slice 5.3 adapter.
 *  - renderer: the same adapter FIRST (so the VendorCMS draft exists and the step still records its site id), then the site settings and a DRAFT_PREVIEW publication.
 * Switching back to legacy is one setting change; nothing is deleted. Neither mode publishes.
 */
@Injectable()
export class ModeSiteProvisioner extends SiteProvisioner {
  constructor(private readonly legacy: CmsDraftSiteProvisioner, private readonly settings: ProvisioningSettingsService, private readonly builder: DraftSiteBuilder) { super(); }

  async createDraftSite(i: CreateDraftSiteInput): Promise<{ siteId: string }> {
    const { siteDraftBuilderMode: carried, ...legacyInput } = i;
    const site = await this.legacy.createDraftSite(legacyInput);
    // the runner read the settings once for the whole job; only a direct caller without the mode pays for a second read
    const mode = carried ?? (await this.settings.get()).siteDraftBuilderMode;
    if (mode === 'renderer') {
      await this.builder.prepare({ vendorId: i.vendorId, category: i.category, track: i.track, language: i.language, city: i.city });
    }
    return site;
  }
}
