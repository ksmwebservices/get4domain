import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { V3PacksModule } from '../v3-packs/packs.module';
import { WebsiteModule } from '../v3-website/website.module';
import { AdminProfileController, MeProfileController } from './api/profile.controllers';
import { PrismaProfileFieldStore, PrismaProfileValueStore } from './prisma-profile.store';
import { ProfileFieldsService } from './profile.service';
import { ProfileFieldStore, ProfileValueStore } from './profile.store';

/** Wave 2 Part E: the industry profile fields of the 16 packs, the map into the site content and the values a business gave. The activity log is global. */
@Module({
  imports: [PrismaModule, V3PacksModule, WebsiteModule],
  controllers: [MeProfileController, AdminProfileController],
  providers: [{ provide: ProfileFieldStore, useClass: PrismaProfileFieldStore }, { provide: ProfileValueStore, useClass: PrismaProfileValueStore }, ProfileFieldsService],
  exports: [ProfileFieldsService],
})
export class V3ProfileFieldsModule {}
