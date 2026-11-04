import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PLAN_BILLING_CONTROLLERS, PLAN_BILLING_PROVIDERS } from './plan-billing.providers';
import { PlanOrderService } from './plan-order.service';
import { PaymentSettlementService } from './settlement.service';

/**
 * Plan purchase and renewal (slice 5.1b). PlansModule is @Global, so SubscriptionsService, EntitlementsService and AuditService are available here. This module does not touch the legacy
 * billing, payments, commercial, wallet or vendor-payments code. Payments are OFF by default; with paymentsMode "test" and test keys in the environment the Razorpay TEST adapter is used;
 * live is refused. A plan is activated only by PaymentSettlementService.
 */
@Module({
  imports: [PrismaModule],
  controllers: PLAN_BILLING_CONTROLLERS,
  providers: PLAN_BILLING_PROVIDERS,
  exports: [PlanOrderService, PaymentSettlementService],
})
export class PlanBillingModule {}
