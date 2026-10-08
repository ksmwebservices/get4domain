import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { WalletModule } from '../wallet/wallet.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';
import {
  BillingGateModule, CommercialAdminGuard, CommercialAuditService, CommercialMessenger, MoneyAdminGuard, PayeeService,
} from './foundation.services';
import { InvoiceBuilderService } from './invoice-builder.service';
import { SettlementService } from './settlement.service';
import { DealsService } from './deals.service';
import { PayService } from './pay.service';
import { ManualPaymentsService } from './manual-payments.service';
import { TermsService, PlanChangeService } from './terms.service';
import { InvoiceAdminService, PromosService } from './promos-and-invoices.service';
import { RenewalService } from './renewal.service';
import { ArrangementsService } from './arrangements.service';
import { AdminCommerceController, PublicPayController, VendorBillingController } from './commercial.controllers';
import { AdminArrangementsController } from './arrangements.controller';

/** Commercial Engine v1 — see docs/v2/COMMERCIAL_ENGINE.md. */
@Module({
  imports: [PaymentsModule, InvoicesModule, WalletModule, EmailModule, NotificationsModule, WhatsappModule, AuthModule, BillingGateModule],
  controllers: [AdminCommerceController, PublicPayController, VendorBillingController, AdminArrangementsController],
  providers: [
    CommercialAdminGuard, MoneyAdminGuard, CommercialAuditService, CommercialMessenger, PayeeService,
    InvoiceBuilderService, SettlementService, DealsService, PayService, ManualPaymentsService,
    TermsService, PlanChangeService, InvoiceAdminService, PromosService, RenewalService, ArrangementsService,
  ],
  exports: [SettlementService, DealsService, TermsService, RenewalService, InvoiceBuilderService, CommercialAuditService, ArrangementsService],
})
export class CommercialModule {}
