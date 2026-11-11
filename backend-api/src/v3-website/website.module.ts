import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SitePublishModule } from '../site-publish/site-publish.module';
import { MeWebsiteController } from './api/website.controllers';
import { NoopSiteCache, SiteCachePort } from './website.ports';
import { WebsiteService } from './website.service';
import { PrismaWebsiteStore, WebsiteStore } from './website.store';

/** Every provider and controller of the Website manager, in one list (the staging integration tests assemble the same list into a slim app). */
export const WEBSITE_PROVIDERS = [{ provide: WebsiteStore, useClass: PrismaWebsiteStore }, { provide: SiteCachePort, useClass: NoopSiteCache }, WebsiteService];
export const WEBSITE_CONTROLLERS = [MeWebsiteController];

/**
 * The Website manager (slice 5.5): drafts, preview, publish, revisions. It builds and publishes only through the site publish module (SitePublishModule) and reads
 * the legacy site document only through that module's content source. PlansModule (entitlements, audit) and the trust module (prohibited-term scan) are global.
 */
@Module({ imports: [PrismaModule, SitePublishModule], controllers: WEBSITE_CONTROLLERS, providers: WEBSITE_PROVIDERS, exports: [WebsiteService, WebsiteStore] })
export class WebsiteModule {}
