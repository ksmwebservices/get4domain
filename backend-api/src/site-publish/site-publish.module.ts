import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublishService } from './publish/publish.service';
import { SiteBuildService } from './publish/site-build.service';
import { SiteSettingsService } from './publish/site-settings.service';
import { ThemeRenderService } from './renderer/theme-render.service';
import { SITE_PUBLISH_CONTROLLERS, SITE_PUBLISH_PROVIDERS } from './site-publish.providers';

/**
 * Theme renderer, SEO layer and publish (slice 5.4, docs/v3/V3_S4_RENDERER_PUBLISH.md). PlansModule is @Global, so the entitlement engine and the audit
 * service are available without importing it here. Nothing in this module exposes a page on a real host: the public route is an internal, read-only API.
 */
@Module({
  imports: [PrismaModule],
  controllers: SITE_PUBLISH_CONTROLLERS,
  providers: SITE_PUBLISH_PROVIDERS,
  exports: [SiteBuildService, SiteSettingsService, PublishService, ThemeRenderService],
})
export class SitePublishModule {}
