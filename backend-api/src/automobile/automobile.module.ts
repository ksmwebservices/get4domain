import { Module } from '@nestjs/common';
import { AutomobileService } from './automobile.service';
import { AutomobileController } from './automobile.controller';

@Module({
  providers: [AutomobileService],
  controllers: [AutomobileController],
  exports: [AutomobileService],
})
export class AutomobileModule {}
