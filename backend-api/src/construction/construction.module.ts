import { Module } from '@nestjs/common';
import { ConstructionService } from './construction.service';
import { ConstructionController } from './construction.controller';

@Module({
  providers: [ConstructionService],
  controllers: [ConstructionController],
  exports: [ConstructionService],
})
export class ConstructionModule {}
