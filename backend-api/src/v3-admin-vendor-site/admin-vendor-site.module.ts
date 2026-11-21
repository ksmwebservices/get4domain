import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SeededSitesModule } from '../seeded-sites/seeded-sites.module';
import { VendorsModule } from '../vendors/vendors.module';
import { AdminVendorSiteController } from './admin-vendor-site.controller';
import { AdminVendorSiteService } from './admin-vendor-site.service';

/** B2.2: staff create a business with its site (PlansModule and V3TrialModule are global). */
@Module({ imports: [PrismaModule, VendorsModule, SeededSitesModule], controllers: [AdminVendorSiteController], providers: [AdminVendorSiteService] })
export class AdminVendorSiteModule {}
