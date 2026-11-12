import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaTaxRateSource, TaxRateSource } from '../v3-business/tax-rate-source';
import { CustomersService } from '../v3-customers/customers.service';
import { V3CustomersModule } from '../v3-customers/customers.module';
import { PaymentsStore } from '../v3-payments/payments.store';
import { PayRequestsModule } from '../v3-payments/payments.module';
import { MeJobsController, MeQuotesController } from './api/jobs.controllers';
import { CustomerCapture, JobsService, PaymentFacts } from './jobs.service';
import { JobsStore } from './jobs.store';
import { PrismaJobsStore } from './prisma-jobs.store';

/** A payment request of this business that is PAID (confirmed by the business or by its own gateway, Stage 9). Read only. */
export const paymentFactsFor = (payments: Pick<PaymentsStore, 'byId'>): PaymentFacts => ({
  async confirmed(vendorId, payRequestId) { const r = await payments.byId(payRequestId, vendorId); return r && r.status === 'PAID' ? { amountPaise: r.amountPaise } : null; },
});
/** A person met through a job goes on the customer list with the source MANUAL (the business entered them). */
export const customerCaptureFor = (customers: Pick<CustomersService, 'capture'>): CustomerCapture => ({
  async capture(vendorId, i) {
    try { return (await customers.capture(vendorId, { name: i.name, phone: i.phone, source: 'MANUAL', refType: i.refType, refId: i.refId })).customer.id; } catch { return null; }   // an unreadable phone leaves the job without a customer link; the job itself stands
  },
});

export const JOBS_PROVIDERS: Provider[] = [
  { provide: JobsStore, useClass: PrismaJobsStore }, { provide: TaxRateSource, useClass: PrismaTaxRateSource },
  { provide: PaymentFacts, useFactory: paymentFactsFor, inject: [PaymentsStore] }, { provide: CustomerCapture, useFactory: customerCaptureFor, inject: [CustomersService] },
  JobsService,
];
export const JOBS_CONTROLLERS: Type<unknown>[] = [MeJobsController, MeQuotesController];

/** Jobs and quotes (slice 5.24a). PlansModule (entitlements) and the tenant guard are global. */
@Module({ imports: [PrismaModule, PayRequestsModule, V3CustomersModule], controllers: JOBS_CONTROLLERS, providers: JOBS_PROVIDERS, exports: [JobsService] })
export class V3JobsModule {}
