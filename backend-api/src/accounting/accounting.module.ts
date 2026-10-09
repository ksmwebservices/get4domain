import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { BosModule } from '../bos/bos.module';

@Module({
  imports: [BosModule],
  controllers: [AccountingController],
  providers: [AccountingService],
})
export class AccountingModule {}
