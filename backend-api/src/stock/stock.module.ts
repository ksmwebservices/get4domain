import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';

@Module({
  imports: [NotificationsModule],
  providers: [StockService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
