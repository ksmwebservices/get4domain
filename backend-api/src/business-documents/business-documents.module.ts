import { Module } from '@nestjs/common';
import { BusinessDocumentsController } from './business-documents.controller';
import { BusinessDocumentsService } from './business-documents.service';

@Module({
  controllers: [BusinessDocumentsController],
  providers: [BusinessDocumentsService],
})
export class BusinessDocumentsModule {}
