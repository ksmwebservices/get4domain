import { Module } from '@nestjs/common';
import { AdminCrmService } from './admin-crm.service';
import { AdminCrmController } from './admin-crm.controller';

@Module({
  providers: [AdminCrmService],
  controllers: [AdminCrmController],
  exports: [AdminCrmService],
})
export class AdminCrmModule {}
