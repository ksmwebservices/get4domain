import { Injectable, Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerCapture, customerCaptureFor } from '../v3-business/customer-capture';
import { V3CustomersModule } from '../v3-customers/customers.module';
import { CustomersService } from '../v3-customers/customers.service';
import { MeAppointmentsController } from './api/appointments.controllers';
import { AppointmentsService, ReminderPort } from './appointments.service';
import { AppointmentsStore } from './appointments.store';
import { PrismaAppointmentsStore } from './prisma-appointments.store';

/** FAKE: the automations engine that sends reminders arrives in Stage 17B. This keeps the call in place and sends nothing. */
@Injectable()
export class FakeReminderPort extends ReminderPort {
  readonly mode = 'FAKE' as const;
  async schedule(): Promise<void> { /* nothing is scheduled or sent in this build */ }
}

export const APPOINTMENTS_PROVIDERS: Provider[] = [
  { provide: AppointmentsStore, useClass: PrismaAppointmentsStore }, { provide: ReminderPort, useClass: FakeReminderPort },
  { provide: CustomerCapture, useFactory: customerCaptureFor, inject: [CustomersService] }, AppointmentsService,
];
export const APPOINTMENTS_CONTROLLERS: Type<unknown>[] = [MeAppointmentsController];

/** Appointments (slice 5.24b). PlansModule (entitlements) and the tenant guard are global. */
@Module({ imports: [PrismaModule, V3CustomersModule], controllers: APPOINTMENTS_CONTROLLERS, providers: APPOINTMENTS_PROVIDERS, exports: [AppointmentsService] })
export class V3AppointmentsModule {}
