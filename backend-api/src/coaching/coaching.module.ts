import { Module } from '@nestjs/common';
import { CoachingService } from './coaching.service';
import { CoachingController } from './coaching.controller';

@Module({
  providers: [CoachingService],
  controllers: [CoachingController],
  exports: [CoachingService],
})
export class CoachingModule {}
