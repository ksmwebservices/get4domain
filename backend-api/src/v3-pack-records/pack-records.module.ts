import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { V3PacksModule } from '../v3-packs/packs.module';
import { MePackRecordsController } from './api/pack-records.controller';
import { AdminPackTabFieldsController } from './api/pack-tab-fields-admin.controller';
import { PackTabFieldsAdminService } from './pack-tab-fields-admin.service';
import { PackRecordsTabGuard } from './pack-records.guard';
import { PackRecordsService } from './pack-records.service';
import { PackRecordStore, PackTabFieldStore } from './pack-records.store';
import { PrismaPackRecordStore, PrismaPackTabFieldStore } from './prisma-pack-records.store';

/** The generic record store of a pack tab (Wave 2 Part A). Reads the tab state from the pack engine; the tenant guard and the global throttler apply as everywhere. */
@Module({
  imports: [PrismaModule, V3PacksModule],
  controllers: [MePackRecordsController, AdminPackTabFieldsController],
  providers: [
    { provide: PackTabFieldStore, useClass: PrismaPackTabFieldStore }, { provide: PackRecordStore, useClass: PrismaPackRecordStore }, PackRecordsService, PackRecordsTabGuard, PackTabFieldsAdminService,
  ],
  exports: [PackRecordsService],
})
export class V3PackRecordsModule {}
