import { Module } from '@nestjs/common';
import { GymService } from './gym.service';
import { GymController } from './gym.controller';

@Module({
  providers: [GymService],
  controllers: [GymController],
  exports: [GymService],
})
export class GymModule {}
