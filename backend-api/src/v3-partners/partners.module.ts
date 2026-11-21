import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPartnersController, PartnerPortalController } from './api/partners.controllers';
import { PartnerGuard } from './partner.guard';
import { PartnersService } from './partners.service';
import { PartnersStore } from './partners.store';
import { PrismaPartnersStore } from './prisma-partners.store';

export const PARTNERS_PROVIDERS: Provider[] = [{ provide: PartnersStore, useClass: PrismaPartnersStore }, PartnersService, PartnerGuard];
export const PARTNERS_CONTROLLERS: Type<unknown>[] = [AdminPartnersController, PartnerPortalController];

/** Referral partners (Wave 3 Parts A and I). The activity log is global, so ActivityService is available without importing its module. */
@Module({ imports: [PrismaModule], controllers: PARTNERS_CONTROLLERS, providers: PARTNERS_PROVIDERS, exports: [PartnersService, PartnersStore] })
export class V3PartnersModule {}
