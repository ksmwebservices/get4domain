import { Provider, Type } from '@nestjs/common';
import { MeSiteController } from './api/me-site.controller';
import { PublicSiteController } from './api/public-site.controller';
import { SitesAdminController } from './api/sites-admin.controller';
import { CmsContentSource, ContentSource } from './content/content-source';
import { ManagedContentSource, ManagedLayerPort, PrismaManagedLayer } from './content/managed-content-source';
import { PrismaSnapshotSink, SnapshotSink } from './content/snapshot-sink';
import { PrismaSiteAudit, SiteAudit } from './publish/site-audit';
import { PrismaSiteRepository } from './publish/prisma-site.repository';
import { PublishService } from './publish/publish.service';
import { SiteBuildService } from './publish/site-build.service';
import { HostResolver, SitePublicService } from './publish/site-public.service';
import { SitePreviewService } from './publish/site-preview.service';
import { SiteSettingsService } from './publish/site-settings.service';
import { SiteRepository } from './publish/site.repository';
import { VendorHosts } from './publish/vendor-hosts';
import { DomainHostResolver, DomainVendorHosts } from '../site-domains/site-publish-adapters';
import { ThemeRenderService } from './renderer/theme-render.service';

/**
 * Every provider and controller of the site publish slice, in one list. SitePublishModule uses it; the staging integration tests assemble the same list into a
 * slim app. Ports are bound to their real implementations here (the content source is replaced in slice 5.5, the host resolver in slice 5.6).
 */
export const SITE_PUBLISH_PROVIDERS: Provider[] = [
  { provide: SiteRepository, useClass: PrismaSiteRepository },
  { provide: HostResolver, useClass: DomainHostResolver },   // slice 5.6: the domain tables (the slice 5.4 SubdomainHostResolver is no longer bound)
  { provide: VendorHosts, useClass: DomainVendorHosts },
  CmsContentSource,
  { provide: ManagedLayerPort, useClass: PrismaManagedLayer },   // slice 5.5a: the live managed document is the snapshot of the current publication
  { provide: ContentSource, useClass: ManagedContentSource },
  { provide: SnapshotSink, useClass: PrismaSnapshotSink },
  { provide: SiteAudit, useClass: PrismaSiteAudit },
  ThemeRenderService, SiteBuildService, PublishService, SiteSettingsService, SitePreviewService, SitePublicService,
];
export const SITE_PUBLISH_CONTROLLERS: Type<unknown>[] = [MeSiteController, SitesAdminController, PublicSiteController];
