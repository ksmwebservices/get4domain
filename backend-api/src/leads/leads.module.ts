import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { OtpModule } from '../otp/otp.module';
import { DemoModule } from '../demo/demo.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [OtpModule, DemoModule, AuthModule],
  providers: [LeadsService],
  controllers: [LeadsController],
})
export class LeadsModule {}
