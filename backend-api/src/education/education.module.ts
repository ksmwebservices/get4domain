import { Module } from '@nestjs/common';
import { EducationService } from './education.service';
import { EducationController } from './education.controller';

@Module({
  providers: [EducationService],
  controllers: [EducationController],
  exports: [EducationService],
})
export class EducationModule {}
