import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { UploadsController } from './uploads.controller';

@Module({
  controllers: [UploadsController],
  providers: [MediaService],
  exports: [MediaService],
})
export class UploadsModule {}
