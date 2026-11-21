import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { B3SettingsService } from './b3-settings.service';

/** The Batch 3 settings reader, available to every Batch 3 module without importing it again. */
@Global()
@Module({ imports: [PrismaModule], providers: [B3SettingsService], exports: [B3SettingsService] })
export class B3SettingsModule {}
