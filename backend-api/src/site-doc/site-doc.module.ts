import { Module } from '@nestjs/common';
import { CmsModule } from '../cms/cms.module';
import { SiteDocController } from './site-doc.controller';
import { SiteDocService } from './site-doc.service';
import { SiteRefreshService } from './site-refresh.service';

@Module({
  imports: [CmsModule],
  providers: [SiteDocService, SiteRefreshService],
  controllers: [SiteDocController],
  exports: [SiteDocService, SiteRefreshService],
})
export class SiteDocModule {}
