import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MeCustomersController } from './api/customers.controllers';
import { CustomersService } from './customers.service';
import { CustomersStore } from './customers.store';
import { PrismaCustomersStore } from './prisma-customers.store';

export const CUSTOMERS_PROVIDERS: Provider[] = [{ provide: CustomersStore, useClass: PrismaCustomersStore }, CustomersService];
export const CUSTOMERS_CONTROLLERS: Type<unknown>[] = [MeCustomersController];

/** The customer list (slice 5.23a). PlansModule (entitlements) and the tenant guard are global. The service is exported so the accounts, jobs, appointments and store modules can capture a customer. */
@Module({ imports: [PrismaModule], controllers: CUSTOMERS_CONTROLLERS, providers: CUSTOMERS_PROVIDERS, exports: [CustomersService, CustomersStore] })
export class V3CustomersModule {}
