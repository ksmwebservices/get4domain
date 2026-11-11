import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SitePublishModule } from '../site-publish/site-publish.module';
import { AdminMediaController, MeMediaController } from './api/media.controllers';
import { AdminReviewController } from './api/review.controllers';
import { AdminSeoController } from './api/seo.controllers';
import { LIVE_PROJECTORS } from './projection/live-projector';
import { LocationProjector, LocationService } from './location/location.service';
import { PrismaSiteLocationStore, SiteLocationStore } from './location/site-location.store';
import { PrismaTestimonialStore, TestimonialProjector, TestimonialsService, TestimonialStore } from './testimonials/testimonials.service';
import { PrismaReviewLinkStore, ReviewLinkProjector, ReviewLinkService, ReviewLinkStore } from './review-link/review-link.service';
import { PageSeoStore, PrismaPageSeoStore } from './seo/page-seo.store';
import { SeoProjector, SeoService } from './seo/seo.service';
import { ActivityReviewNotifier, ReviewNotifier, ReviewService } from './review/review.service';
import { PrismaReviewStore, ReviewStore } from './review/review.store';
import { MeWebsiteController } from './api/website.controllers';
import { FakeMediaStorage, ImagePort, MediaStoragePort, SharpImagePort, UnconfiguredMediaStorage } from './media/media.ports';
import { BannerLibraryService, MediaService } from './media/media.service';
import { MediaStore, PrismaMediaStore } from './media/media.store';
import { WebsiteSettingsService } from './settings/website-settings.service';
import { NoopSiteCache, SiteCachePort } from './website.ports';
import { WebsiteService } from './website.service';
import { PrismaWebsiteStore, WebsiteStore } from './website.store';

/** Every provider and controller of the Website manager, in one list (the staging integration tests assemble the same list into a slim app). */
/** Picture storage: only MEDIA_STORAGE_MODE=fake binds the fake (staging tests); otherwise uploads are refused (STORAGE_NOT_CONFIGURED) until a real adapter is bound in a later release. */
const storageProvider = { provide: MediaStoragePort, useFactory: () => (process.env.MEDIA_STORAGE_MODE === 'fake' ? new FakeMediaStorage() : new UnconfiguredMediaStorage()) };
export const WEBSITE_PROVIDERS = [
  { provide: WebsiteStore, useClass: PrismaWebsiteStore }, { provide: SiteCachePort, useClass: NoopSiteCache }, WebsiteService,
  { provide: MediaStore, useClass: PrismaMediaStore }, storageProvider, { provide: ImagePort, useClass: SharpImagePort }, WebsiteSettingsService, MediaService, BannerLibraryService,
  { provide: ReviewStore, useClass: PrismaReviewStore }, { provide: ReviewNotifier, useClass: ActivityReviewNotifier }, ReviewService,
  // projections of the live document (one per slice that needs staff to query something): B1 per-page SEO
  { provide: PageSeoStore, useClass: PrismaPageSeoStore }, SeoProjector, SeoService,
  // B2 location
  { provide: SiteLocationStore, useClass: PrismaSiteLocationStore }, LocationProjector, LocationService,
  // B3 review link
  { provide: ReviewLinkStore, useClass: PrismaReviewLinkStore }, ReviewLinkProjector, ReviewLinkService,
  // B4 testimonials
  { provide: TestimonialStore, useClass: PrismaTestimonialStore }, TestimonialProjector, TestimonialsService,
  { provide: LIVE_PROJECTORS, useFactory: (seo: SeoProjector, loc: LocationProjector, rl: ReviewLinkProjector, tm: TestimonialProjector) => [seo, loc, rl, tm], inject: [SeoProjector, LocationProjector, ReviewLinkProjector, TestimonialProjector] },
];
export const WEBSITE_CONTROLLERS = [MeWebsiteController, MeMediaController, AdminMediaController, AdminReviewController, AdminSeoController];

/**
 * The Website manager (slice 5.5): drafts, preview, publish, revisions. It builds and publishes only through the site publish module (SitePublishModule) and reads
 * the legacy site document only through that module's content source. PlansModule (entitlements, audit) and the trust module (prohibited-term scan) are global.
 */
@Module({ imports: [PrismaModule, SitePublishModule], controllers: WEBSITE_CONTROLLERS, providers: WEBSITE_PROVIDERS, exports: [WebsiteService, WebsiteStore] })
export class WebsiteModule {}
