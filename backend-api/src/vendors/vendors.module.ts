import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { EmailModule } from '../email/email.module';
import { WalletModule } from '../wallet/wallet.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [EmailModule, WalletModule, AiModule],
  providers: [VendorsService],
  controllers: [VendorsController],
  exports: [VendorsService],
})
export class VendorsModule {}
