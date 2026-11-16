import { Provider, Type } from '@nestjs/common';
import { AdminInvoicesController, AdminPaymentGatewayController, BillingAdminController } from './api/billing-admin.controller';
import { MeBillingController } from './api/me-billing.controller';
import { CashfreeWebhookController, PaymentsWebhookController } from './api/payments-webhook.controller';
import { PaymentGatewaySettingsService } from './gateway/gateway-settings.service';
import { PlanOrderService } from './plan-order.service';
import { PlanBillingRepository } from './plan-billing.repository';
import { PrismaPlanBillingRepository } from './prisma-plan-billing.repository';
import { PaymentsGate } from './razorpay/payments-gate';
import { PlanBillingCron } from './plan-billing.cron';
import { RenewalReminderService, ReminderMailer, SandboxReminderMailer } from './renewal-reminder.service';
import { BillingSettingsService } from './settings/billing-settings.service';
import { PaymentSettlementService } from './settlement.service';

/** Every provider and controller of the plan billing slice in one list: PlanBillingModule uses it and the staging integration tests assemble the same list into a slim app. */
export const PLAN_BILLING_PROVIDERS: Provider[] = [
  { provide: PlanBillingRepository, useClass: PrismaPlanBillingRepository },
  { provide: ReminderMailer, useClass: SandboxReminderMailer },
  BillingSettingsService, PaymentGatewaySettingsService, PaymentsGate, PaymentSettlementService, PlanOrderService, RenewalReminderService, PlanBillingCron,
];
export const PLAN_BILLING_CONTROLLERS: Type<unknown>[] = [MeBillingController, PaymentsWebhookController, CashfreeWebhookController, BillingAdminController, AdminInvoicesController, AdminPaymentGatewayController];
