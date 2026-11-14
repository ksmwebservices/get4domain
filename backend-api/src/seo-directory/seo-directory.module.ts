import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SeoAdminController } from './api/seo-admin.controller';
import { SeoKeywordService } from './keywords/seo-keyword.service';
import { PrismaSeoKeywordStore, SeoKeywordStore } from './keywords/seo-keyword.store';
import { PrismaSeoAudit, SeoAudit } from './seo-audit';
import { SeoSettingsService } from './settings/seo-settings.service';

/** Every provider and controller of the SEO block in one list: the module uses it and the staging integration tests assemble the same list into a slim app. */
export const SEO_PROVIDERS: Provider[] = [
  { provide: SeoKeywordStore, useClass: PrismaSeoKeywordStore },
  { provide: SeoAudit, useClass: PrismaSeoAudit },
  SeoSettingsService, SeoKeywordService,
];
export const SEO_CONTROLLERS: Type<unknown>[] = [SeoAdminController];
export const SEO_EXPORTS = [SeoKeywordStore, SeoAudit, SeoSettingsService, SeoKeywordService];

/**
 * The SEO block (docs/v3/V3_SEO_DIRECTORY.md): keyword sets per category, page templates as data, and (in later slices) directory page models, the click-out, sitemaps, keyword targets.
 * Its own module on purpose: nothing here writes a Vendor row. PlansModule is @Global, so the audit service is available.
 */
@Module({ imports: [PrismaModule], controllers: SEO_CONTROLLERS, providers: SEO_PROVIDERS, exports: SEO_EXPORTS })
export class SeoDirectoryModule {}
