import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SiteRefreshService } from '../site-doc/site-refresh.service';
import { ThemesAdminController, ThemesPublicController } from './themes.controllers';
import { ThemeCatalogService } from './theme-catalog.service';
import { ThemesAdminService } from './themes-admin.service';
import { ThemePurchaseService } from './theme-purchase.service';
import { ThemeExpiryService } from './theme-expiry.service';

/** Theme packages (round 2): import, review, price, preview, sell for a year, and fall back safely when a licence ends. */
@Module({
  imports: [PaymentsModule, InvoicesModule, NotificationsModule],
  providers: [ThemeCatalogService, ThemesAdminService, ThemePurchaseService, ThemeExpiryService, SiteRefreshService],
  controllers: [ThemesAdminController, ThemesPublicController],
  exports: [ThemeCatalogService, ThemesAdminService, ThemePurchaseService, ThemeExpiryService],
})
export class ThemesModule {}
