import { Module } from '@nestjs/common';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { RetailModule } from '../retail/retail.module';
import { RealEstateModule } from '../realestate/realestate.module';
import { PaymentsModule } from '../payments/payments.module';
import { CmsModule } from '../cms/cms.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CrmModule } from '../crm/crm.module';
import { VendorPaymentsModule } from '../vendor-payments/vendor-payments.module';
import { ActionRegistry } from './action-registry';
import { EngineService } from './engine.service';
import { EngineController } from './engine.controller';
import { PublicCheckoutService } from './public-checkout.service';

/**
 * Business Action Engine.
 *
 * Imports the industry + capability modules so their EXPORTED services can be
 * injected in-process — the engine dispatches into the same service singletons the
 * industry controllers use, never a parallel booking/ordering/payment system.
 *  - RestaurantModule / RetailModule / RealEstateModule — industry Operations services
 *  - PaymentsModule — Razorpay order creation (real payments backend)
 *  - CmsModule — resolve a public site's vendorId from its subdomain
 *  - NotificationsModule — vendor lead-routing on public actions
 */
@Module({
  imports: [RestaurantModule, RetailModule, RealEstateModule, PaymentsModule, CmsModule, NotificationsModule, CrmModule, VendorPaymentsModule],
  providers: [ActionRegistry, EngineService, PublicCheckoutService],
  controllers: [EngineController],
  exports: [EngineService],
})
export class EngineModule {}
