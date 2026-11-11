import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { RequestsOrdersModule } from '../requests-orders/requests-orders.module';
import { VendorLifecycleModule } from '../vendor-lifecycle/vendor-lifecycle.module';
import { MePayRequestsController, PublicPayController } from './api/payments.controllers';
import { PaymentsService } from './payments.service';
import { PaymentsStore } from './payments.store';
import { PrismaPaymentsStore } from './prisma-payments.store';

/** The expiry job (every 5 minutes): AWAITING pay requests whose time has passed become EXPIRED. Safe to repeat. */
@Injectable()
export class PaymentsCron {
  private readonly logger = new Logger(PaymentsCron.name);
  private busy = false;
  constructor(private readonly pay: PaymentsService) {}
  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<number> {
    if (this.busy) return 0;
    this.busy = true;
    try { return await this.pay.expireDue(); } catch (e) { this.logger.error(`pay expiry failed: ${e instanceof Error ? e.name : 'error'}`); return 0; } finally { this.busy = false; }
  }
}

export const PAYMENTS_PROVIDERS = [
  { provide: PaymentsStore, useClass: PrismaPaymentsStore }, { provide: 'PUBLIC_PAY_URL', useFactory: () => `${process.env.PUBLIC_APP_URL || 'https://get4domain.com'}/pay` }, PaymentsService, PaymentsCron,
];
export const PAYMENTS_CONTROLLERS = [MePayRequestsController, PublicPayController];

/** Pay requests and the payments a vendor confirms (slice 5.17b, UPI only). PlansModule (entitlements, audit), B3SettingsModule, the activity and trust modules are global. */
@Module({ imports: [PrismaModule, RequestsOrdersModule, VendorLifecycleModule], controllers: PAYMENTS_CONTROLLERS, providers: PAYMENTS_PROVIDERS, exports: [PaymentsService, PaymentsStore] })
export class PayRequestsModule {}
