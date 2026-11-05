import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPacksController, AdminServicesController, MeServicesController, PublicServicesController } from './api/services.controllers';
import { PrismaServicesStore } from './prisma-services.store';
import { ServicesCatalogService } from './services.service';
import { DelegatingServiceUsage, ServicesStore, ServiceUsagePort } from './services.store';

/** Every provider and controller of slice 5.16b in one list: the module and the HTTP unit tests use it. */
export const SERVICES_PROVIDERS: Provider[] = [{ provide: ServicesStore, useClass: PrismaServicesStore }, { provide: ServiceUsagePort, useClass: DelegatingServiceUsage }, ServicesCatalogService];
export const SERVICES_CONTROLLERS: Type<unknown>[] = [PublicServicesController, MeServicesController, AdminServicesController, AdminPacksController];

/**
 * Services, the price book and add-on packs (slice 5.16b). The wallet module (global) supplies the wallet store and settings; PlansModule (global) supplies entitlements and audit.
 * Nothing here touches the legacy billing, wallet, add-on or module code (decision D1).
 */
@Module({ imports: [PrismaModule], controllers: SERVICES_CONTROLLERS, providers: SERVICES_PROVIDERS, exports: [ServicesStore, ServicesCatalogService, ServiceUsagePort] })
export class V3ServicesModule {}
