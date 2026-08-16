import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { SmsModule } from '../sms/sms.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    SmsModule,
    WhatsappModule,
    // 3A — stateless customer-portal sessions. Distinct secret from the vendor JWT so
    // a customer token can never be replayed against the vendor JwtAuthGuard.
    JwtModule.register({
      secret: `${process.env.JWT_SECRET ?? 'dev-secret'}_customer`,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [CustomerService],
  controllers: [CustomerController],
  exports: [CustomerService],
})
export class CustomerModule {}
