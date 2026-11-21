import { Module } from '@nestjs/common';
import { DirectoryModule } from '../directory/directory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LifecycleStore } from './lifecycle.store';
import { VendorLifecycleService } from './vendor-lifecycle.service';
import { VENDOR_LIFECYCLE_CONTROLLERS, VENDOR_LIFECYCLE_PROVIDERS } from './vendor-lifecycle.providers';

/**
 * Plan expiry, suspension and deletion rules (slice 5.1d, owner rule 9). PlansModule is @Global (subscriptions, entitlements, audit). B3SettingsModule is @Global.
 * The effective-plan rule itself lives in the entitlement engine; this module holds the staff actions and the two permanent-removal paths.
 */
@Module({
  imports: [PrismaModule, DirectoryModule],
  controllers: VENDOR_LIFECYCLE_CONTROLLERS,
  providers: VENDOR_LIFECYCLE_PROVIDERS,
  exports: [LifecycleStore, VendorLifecycleService],
})
export class VendorLifecycleModule {}
