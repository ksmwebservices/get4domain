import { Module, Provider, Type } from '@nestjs/common';
import { DirectoryModule } from '../directory/directory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClickOutController } from './api/click-out.controller';
import { DirectoryPagesController } from './api/directory-pages.controller';
import { SitemapController } from './api/sitemap.controller';
import { ClickOutService } from './click-out/click-out.service';
import { PrismaSeoClickStore, SeoClickStore } from './click-out/click-store';
import { SeoAdminController } from './api/seo-admin.controller';
import { SeoPublicController } from './api/seo-public.controller';
import { SeoTargetsAdminController } from './api/seo-targets-admin.controller';
import { SeoBacklinkService } from './backlinks/seo-backlink.service';
import { PrismaSeoUtmStore, SeoUtmStore } from './campaigns/seo-utm.store';
import { SeoUtmService } from './campaigns/seo-utm.service';
import { DbPageOverrides, SeoKeywordTargetService } from './keywords/seo-keyword-target.service';
import { PrismaSeoKeywordTargetStore, SeoKeywordTargetStore } from './keywords/seo-keyword-target.store';
import { SeoKeywordService } from './keywords/seo-keyword.service';
import { PrismaSeoKeywordStore, SeoKeywordStore } from './keywords/seo-keyword.store';
import { PrismaSeoAudit, SeoAudit } from './seo-audit';
import { SeoPageOverrides, SeoPageService } from './pages/seo-page.service';
import { PrismaSeoDirectoryData, SeoDirectoryData } from './pages/seo-directory.data';
import { SeoSettingsService } from './settings/seo-settings.service';
import { SeoSitemapService } from './sitemaps/seo-sitemap.service';

/** Every provider and controller of the SEO block in one list: the module uses it and the staging integration tests assemble the same list into a slim app. */
export const SEO_PROVIDERS: Provider[] = [
  { provide: SeoKeywordStore, useClass: PrismaSeoKeywordStore },
  { provide: SeoAudit, useClass: PrismaSeoAudit },
  { provide: SeoDirectoryData, useClass: PrismaSeoDirectoryData },
  { provide: SeoKeywordTargetStore, useClass: PrismaSeoKeywordTargetStore },
  { provide: SeoUtmStore, useClass: PrismaSeoUtmStore },
  DbPageOverrides,
  { provide: SeoPageOverrides, useExisting: DbPageOverrides },   // slice 5: staff overrides of ACTIVE keyword targets
  { provide: SeoClickStore, useClass: PrismaSeoClickStore },
  SeoSettingsService, SeoKeywordService, SeoPageService, ClickOutService, SeoSitemapService, SeoKeywordTargetService, SeoUtmService, SeoBacklinkService,
];
export const SEO_CONTROLLERS: Type<unknown>[] = [SeoAdminController, SeoTargetsAdminController, DirectoryPagesController, ClickOutController, SitemapController, SeoPublicController];
export const SEO_EXPORTS = [SeoKeywordStore, SeoAudit, SeoSettingsService, SeoKeywordService, SeoPageService, SeoDirectoryData, SeoPageOverrides, SeoClickStore, ClickOutService, SeoSitemapService, SeoKeywordTargetStore, SeoKeywordTargetService, SeoUtmStore, SeoUtmService, SeoBacklinkService, DbPageOverrides];

/**
 * The SEO block (docs/v3/V3_SEO_DIRECTORY.md): keyword sets per category, page templates as data, directory page models, the click-out, sitemaps, keyword targets, the keyword plan, UTM capture, the backlink block and the badge.
 * Its own module on purpose: nothing here writes a Vendor row. PlansModule is @Global, so the audit service is available.
 */
@Module({ imports: [PrismaModule, DirectoryModule], controllers: SEO_CONTROLLERS, providers: SEO_PROVIDERS, exports: SEO_EXPORTS })
export class SeoDirectoryModule {}
