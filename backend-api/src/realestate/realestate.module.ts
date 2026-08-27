import { Module } from '@nestjs/common';
import { RealEstateService } from './realestate.service';
import { RealEstateController } from './realestate.controller';

@Module({
  providers: [RealEstateService],
  controllers: [RealEstateController],
  exports: [RealEstateService],
})
export class RealEstateModule {}
