import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RequestsOrdersModule } from '../requests-orders/requests-orders.module';
import { RequestsStore } from '../requests-orders/requests.store';
import { PrismaTaxRateSource, TaxRateSource } from '../v3-business/tax-rate-source';
import { MeStoreController } from './api/store.controllers';
import { PrismaStoreStore } from './prisma-store.store';
import { MethodSource, StoreService } from './store.service';
import { StoreStore } from './store.store';

/** The payment methods of a business, read through the Stage 9 store (kind and status only). Read only. */
export const methodSourceFor = (requests: Pick<RequestsStore, 'listMethods'>): MethodSource => ({
  async methods(vendorId) { return (await requests.listMethods(vendorId)).map((m) => ({ kind: m.kind, status: m.status })); },
});

export const STORE_PROVIDERS: Provider[] = [
  { provide: StoreStore, useClass: PrismaStoreStore }, { provide: TaxRateSource, useClass: PrismaTaxRateSource },
  { provide: MethodSource, useFactory: methodSourceFor, inject: [RequestsStore] }, StoreService,
];
export const STORE_CONTROLLERS: Type<unknown>[] = [MeStoreController];

/** The store (slice 5.24c). PlansModule (entitlements) and the tenant guard are global. */
@Module({ imports: [PrismaModule, RequestsOrdersModule], controllers: STORE_CONTROLLERS, providers: STORE_PROVIDERS, exports: [StoreService] })
export class V3StoreModule {}
