import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [OtpModule],
  providers: [LeadsService],
  controllers: [LeadsController],
})
export class LeadsModule {}
