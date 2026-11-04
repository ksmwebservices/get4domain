import { Module } from '@nestjs/common';
import { DirectoryModule } from '../directory/directory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SiteDomainsModule } from '../site-domains/site-domains.module';
import { SitePublishModule } from '../site-publish/site-publish.module';
import { VendorLifecycleModule } from '../vendor-lifecycle/vendor-lifecycle.module';
import { REQUESTS_CONTROLLERS, REQUESTS_PROVIDERS } from './requests-orders.providers';
import { VendorRequestsService } from './vendor-requests.service';
import { RequestsStore } from './requests.store';

/**
 * Requests and orders bridge (slice 5.14). Get4Domain passes requests to the vendor; it never receives or holds a customer's money. PlansModule (entitlements, audit) and B3SettingsModule are global.
 * Messaging is SANDBOX only; the vendor gateway is a fake unless an owner flag allows live (none is wired); nothing here calls a real provider.
 */
@Module({
  imports: [PrismaModule, DirectoryModule, SiteDomainsModule, SitePublishModule, VendorLifecycleModule],
  controllers: REQUESTS_CONTROLLERS,
  providers: REQUESTS_PROVIDERS,
  exports: [RequestsStore, VendorRequestsService],
})
export class RequestsOrdersModule {}
