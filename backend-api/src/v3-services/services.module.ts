import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { V3PacksModule } from '../v3-packs/packs.module';
import { AdminPacksController, AdminPriceBookController, AdminServicesController, MeServicesController, PublicServicesController } from './api/services.controllers';
import { PriceBookService } from './price-book.service';
import { PrismaServicesStore } from './prisma-services.store';
import { ServicesCatalogService } from './services.service';
import { IncludedAllowancePort, IncludedAllowanceService } from './included/included-allowance.service';
import { IncludedServicesAdminController } from './included/included-services.controller';
import { DelegatingServiceUsage, ServicesStore, ServiceUsagePort } from './services.store';

/** Every provider and controller of slice 5.16b in one list: the module and the HTTP unit tests use it. */
export const SERVICES_PROVIDERS: Provider[] = [{ provide: ServicesStore, useClass: PrismaServicesStore }, { provide: ServiceUsagePort, useClass: DelegatingServiceUsage }, IncludedAllowanceService, { provide: IncludedAllowancePort, useExisting: IncludedAllowanceService }, ServicesCatalogService, PriceBookService];
export const SERVICES_CONTROLLERS: Type<unknown>[] = [PublicServicesController, MeServicesController, AdminServicesController, AdminPacksController, AdminPriceBookController, IncludedServicesAdminController];

/**
 * Services, the price book and add-on packs (slice 5.16b). The wallet module (global) supplies the wallet store and settings; PlansModule (global) supplies entitlements and audit.
 * Nothing here touches the legacy billing, wallet, add-on or module code (decision D1).
 */
@Module({ imports: [PrismaModule, V3PacksModule], controllers: SERVICES_CONTROLLERS, providers: SERVICES_PROVIDERS, exports: [ServicesStore, ServicesCatalogService, ServiceUsagePort, IncludedAllowancePort] })
export class V3ServicesModule {}
