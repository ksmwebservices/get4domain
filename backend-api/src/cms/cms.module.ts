import { Module } from '@nestjs/common';
import { CmsService } from './cms.service';
import { CmsController } from './cms.controller';
import { StockModule } from '../stock/stock.module';
import { ThemesModule } from '../themes/themes.module';

@Module({
  imports: [StockModule, ThemesModule],
  providers: [CmsService],
  controllers: [CmsController],
  exports: [CmsService],
})
export class CmsModule {}
