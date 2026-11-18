import { Global, Module } from '@nestjs/common';
import { PAYMENTS_OPEN } from '../plans/public/payments-open.port';
import { PlanBillingModule } from './plan-billing.module';
import { PaymentsGate } from './razorpay/payments-gate';

/** B5.6: hands the payments gate to the public pricing page by token (global, so PlansModule needs no import of PlanBillingModule). */
@Global()
@Module({ imports: [PlanBillingModule], providers: [{ provide: PAYMENTS_OPEN, useExisting: PaymentsGate }], exports: [PAYMENTS_OPEN] })
export class PaymentsOpenModule {}
