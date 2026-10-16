import { Module } from '@nestjs/common';
import { CmsModule } from '../cms/cms.module';
import { ThemesModule } from '../themes/themes.module';
import { SiteDocController } from './site-doc.controller';
import { PacksAdminController, PacksVendorController } from './packs.controller';
import { PacksService } from './packs.service';
import { SiteDocService } from './site-doc.service';
import { StarterService } from './starter.service';
import { ThemeVendorService } from './theme-vendor.service';
import { SiteRefreshService } from './site-refresh.service';

@Module({
  imports: [CmsModule, ThemesModule],
  providers: [SiteDocService, SiteRefreshService, PacksService, StarterService, ThemeVendorService],
  controllers: [SiteDocController, PacksVendorController, PacksAdminController],
  exports: [SiteDocService, SiteRefreshService, PacksService, StarterService],
})
export class SiteDocModule {}
