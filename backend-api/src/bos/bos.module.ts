import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { StockModule } from '../stock/stock.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VendorPaymentsModule } from '../vendor-payments/vendor-payments.module';
import { BosSettingsService, ChartService, NumberingService, PostingService } from './core.services';
import { BosStockService } from './bos-stock.service';
import { BosDocumentsService } from './documents.service';
import { BosPaymentsService } from './payments.service';
import { BosCounterService, BosExpensesService, BosOrderBridge, BosStockPosting } from './flows.service';
import { BosJobsService, BosPartiesService, BosPayNowService, BosStockViewsService } from './more.services';
import { BosReportsService } from './reports.service';
import { BosCaPackService } from './export/ca-pack.service';
import { EntitlementGuard, EntitlementsService } from './entitlements.service';
import { BosBooksController, BosController, BosPublicController, BosPurchasesController, BosStockController } from './bos.controller';

/** Full BOS: one set of business records (parties, items, documents, payments, stock ledger, journal) for every plan. */
@Module({
  imports: [StockModule, NotificationsModule, VendorPaymentsModule],
  controllers: [BosController, BosPurchasesController, BosStockController, BosBooksController, BosPublicController],
  providers: [
    BosSettingsService, ChartService, NumberingService, PostingService, BosStockService, BosDocumentsService, BosPaymentsService,
    BosCounterService, BosExpensesService, BosOrderBridge, BosStockPosting, BosPartiesService, BosStockViewsService, BosPayNowService, BosJobsService,
    BosReportsService, BosCaPackService, EntitlementsService, EntitlementGuard,
    { provide: APP_GUARD, useClass: EntitlementGuard },
  ],
  exports: [BosOrderBridge, BosDocumentsService, BosPaymentsService, EntitlementsService, BosSettingsService, BosReportsService],
})
export class BosModule {}
