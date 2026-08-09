import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { SmsModule } from '../sms/sms.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [SmsModule, WhatsappModule],
  providers: [CustomerService],
  controllers: [CustomerController],
  exports: [CustomerService],
})
export class CustomerModule {}
