import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { V3PacksModule } from '../v3-packs/packs.module';
import { MeMigrationController, MePromotionDraftsController, MeSocialDraftsController, MeTeamController } from './api/vendor-gaps.controllers';
import { PrismaVendorGapsStore } from './prisma-vendor-gaps.store';
import { VendorGapsService } from './vendor-gaps.service';
import { VendorGapsStore } from './vendor-gaps.store';

/** The Wave 2 Part B vendor routes that have no home in an existing module: the move request, promotion and social drafts, and the team on the v3 contract. */
@Module({
  imports: [PrismaModule, V3PacksModule],
  controllers: [MeMigrationController, MePromotionDraftsController, MeSocialDraftsController, MeTeamController],
  providers: [{ provide: VendorGapsStore, useClass: PrismaVendorGapsStore }, VendorGapsService],
  exports: [VendorGapsService],
})
export class V3VendorGapsModule {}
