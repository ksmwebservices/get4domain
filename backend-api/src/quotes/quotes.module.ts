import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController, PublicQuotesController } from './quotes.controller';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [CommunicationModule],
  providers: [QuotesService],
  controllers: [QuotesController, PublicQuotesController],
  exports: [QuotesService],
})
export class QuotesModule {}
