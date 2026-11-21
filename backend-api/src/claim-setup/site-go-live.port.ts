import { Injectable } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { PublishService } from '../site-publish/publish/publish.service';
import { SiteBuildService } from '../site-publish/publish/site-build.service';
import { SiteRepository } from '../site-publish/publish/site.repository';

/** What "go live" needs from the site engine, behind a port so the claim rules are tested without a renderer. The real adapter reuses the build and publish services of the site slice. */
export abstract class SiteGoLivePort {
  /** The published version now, or null when nothing is published yet. */
  abstract current(vendorId: string): Promise<{ publicationId: string; version: number } | null>;
  abstract buildAndPublish(vendorId: string, actor: Actor): Promise<{ publicationId: string; version: number }>;
}

@Injectable()
export class RealSiteGoLive extends SiteGoLivePort {
  constructor(private readonly repo: SiteRepository, private readonly build: SiteBuildService, private readonly publisher: PublishService) { super(); }
  async current(vendorId: string): Promise<{ publicationId: string; version: number } | null> {
    const p = await this.repo.currentPublication(vendorId);
    return p ? { publicationId: p.id, version: p.version } : null;
  }
  async buildAndPublish(vendorId: string, actor: Actor): Promise<{ publicationId: string; version: number }> {
    const built = await this.build.build(vendorId, { actor });
    const row = await this.publisher.publish(vendorId, built.publication.id, actor);
    return { publicationId: row.id, version: row.version };
  }
}
