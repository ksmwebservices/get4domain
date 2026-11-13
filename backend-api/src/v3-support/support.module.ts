import { Module, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityBusModule } from '../common/activity-bus';
import { AdminTicketsController, MeTicketsController, PublicTicketsController } from './api/support.controllers';
import { PrismaSupportStore } from './prisma-support.store';
import { SupportSettingsService } from './settings/support-settings';
import { EmailTicketNotifier, SupportService, TicketNotifier } from './support.service';
import { SupportStore } from './support.store';

export const SUPPORT_CONTROLLERS: Type<unknown>[] = [MeTicketsController, PublicTicketsController, AdminTicketsController];

/** Support tickets (Block 4b). EmailPort comes from the global mail module; the notice is flag-gated there. */
@Module({
  imports: [PrismaModule, ActivityBusModule],
  controllers: SUPPORT_CONTROLLERS,
  providers: [{ provide: SupportStore, useClass: PrismaSupportStore }, SupportSettingsService, { provide: TicketNotifier, useClass: EmailTicketNotifier }, SupportService],
  exports: [SupportService],
})
export class V3SupportModule {}
