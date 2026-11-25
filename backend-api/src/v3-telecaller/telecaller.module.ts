import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTelecallerController, TelecallerSelfController } from './telecaller.controllers';
import { TelecallerService } from './telecaller.service';

/** Telecaller backend (E6). The services it joins (admin team, partners, referrals, vendor site creation, plan orders, password reset) are found lazily, so it imports none of their modules. */
@Module({ imports: [PrismaModule], controllers: [AdminTelecallerController, TelecallerSelfController], providers: [TelecallerService] })
export class TelecallerModule {}
