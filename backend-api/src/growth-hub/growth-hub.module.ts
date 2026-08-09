import { Module } from '@nestjs/common';
import { GrowthHubService } from './growth-hub.service';
import { GrowthHubController } from './growth-hub.controller';
import { MetaModule } from '../meta/meta.module';
import { GoogleAdsModule } from '../google-ads/google-ads.module';

@Module({
  imports: [MetaModule, GoogleAdsModule],
  providers: [GrowthHubService],
  controllers: [GrowthHubController],
  exports: [GrowthHubService],
})
export class GrowthHubModule {}
