import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Actor } from '../plans/admin/audit.service';
import { PublishService } from '../site-publish/publish/publish.service';
import { SiteBuildService } from '../site-publish/publish/site-build.service';
import { SiteRepository } from '../site-publish/publish/site.repository';
import { SiteRebuild } from './canonical.store';

/**
 * Rebuilds and republishes through the site build and publish services, found lazily (strict: false) so this module does not import the site-publish module at start (that module
 * already depends on this one for the host rules). Only a vendor that HAS a published site is rebuilt; a build that changes nothing is reused by the build service, so this is safe to repeat.
 */
@Injectable()
export class ModuleSiteRebuild extends SiteRebuild {
  constructor(private readonly modules: ModuleRef) { super(); }

  async rebuildAndPublish(vendorId: string, actor: Actor): Promise<void> {
    const repo = this.modules.get(SiteRepository, { strict: false });
    if (!(await repo.currentPublication(vendorId))) return;   // never publish a site the vendor has not published
    const build = this.modules.get(SiteBuildService, { strict: false });
    const publish = this.modules.get(PublishService, { strict: false });
    const { publication, reused } = await build.build(vendorId, { actor });
    if (publication.status === 'PUBLISHED') return;   // nothing changed and it is already live
    if (reused && publication.status !== 'DRAFT_PREVIEW') return;
    await publish.publish(vendorId, publication.id, actor);
  }
}
