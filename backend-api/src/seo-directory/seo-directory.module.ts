import { Module, Provider, Type } from '@nestjs/common';
import { DirectoryModule } from '../directory/directory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClickOutController } from './api/click-out.controller';
import { DirectoryPagesController } from './api/directory-pages.controller';
import { ClickOutService } from './click-out/click-out.service';
import { PrismaSeoClickStore, SeoClickStore } from './click-out/click-store';
import { SeoAdminController } from './api/seo-admin.controller';
import { SeoKeywordService } from './keywords/seo-keyword.service';
import { PrismaSeoKeywordStore, SeoKeywordStore } from './keywords/seo-keyword.store';
import { PrismaSeoAudit, SeoAudit } from './seo-audit';
import { NoPageOverrides, SeoPageOverrides, SeoPageService } from './pages/seo-page.service';
import { PrismaSeoDirectoryData, SeoDirectoryData } from './pages/seo-directory.data';
import { SeoSettingsService } from './settings/seo-settings.service';

/** Every provider and controller of the SEO block in one list: the module uses it and the staging integration tests assemble the same list into a slim app. */
export const SEO_PROVIDERS: Provider[] = [
  { provide: SeoKeywordStore, useClass: PrismaSeoKeywordStore },
  { provide: SeoAudit, useClass: PrismaSeoAudit },
  { provide: SeoDirectoryData, useClass: PrismaSeoDirectoryData },
  { provide: SeoPageOverrides, useClass: NoPageOverrides },
  { provide: SeoClickStore, useClass: PrismaSeoClickStore },
  SeoSettingsService, SeoKeywordService, SeoPageService, ClickOutService,
];
export const SEO_CONTROLLERS: Type<unknown>[] = [SeoAdminController, DirectoryPagesController, ClickOutController];
export const SEO_EXPORTS = [SeoKeywordStore, SeoAudit, SeoSettingsService, SeoKeywordService, SeoPageService, SeoDirectoryData, SeoPageOverrides, SeoClickStore, ClickOutService];

/**
 * The SEO block (docs/v3/V3_SEO_DIRECTORY.md): keyword sets per category, page templates as data, and (in later slices) directory page models, the click-out, sitemaps, keyword targets.
 * Its own module on purpose: nothing here writes a Vendor row. PlansModule is @Global, so the audit service is available.
 */
@Module({ imports: [PrismaModule, DirectoryModule], controllers: SEO_CONTROLLERS, providers: SEO_PROVIDERS, exports: SEO_EXPORTS })
export class SeoDirectoryModule {}
