import { Global, Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFirmController, PublicFirmController } from './api/firm.controllers';
import { FirmService } from './firm.service';
import { FirmStore } from './firm.store';
import { PrismaFirmStore } from './prisma-firm.store';

export const FIRM_PROVIDERS: Provider[] = [{ provide: FirmStore, useClass: PrismaFirmStore }, FirmService];
export const FIRM_CONTROLLERS: Type<unknown>[] = [PublicFirmController, AdminFirmController];

/** The firm profile (Wave 2 Part H3). Global, so the invoices, the quotes, the billing settings and the terms read it without importing this module. The activity log is global too. */
@Global()
@Module({ imports: [PrismaModule], controllers: FIRM_CONTROLLERS, providers: FIRM_PROVIDERS, exports: [FirmService] })
export class V3FirmModule {}
