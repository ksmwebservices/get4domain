import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { EmailModule } from '../email/email.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [EmailModule, WalletModule],
  providers: [VendorsService],
  controllers: [VendorsController],
  exports: [VendorsService],
})
export class VendorsModule {}
