import { Module } from '@nestjs/common';
import { WebsiteThemesController } from './website-themes.controller';
import { WebsiteThemesService } from './website-themes.service';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [PaymentsModule, InvoicesModule],
  controllers: [WebsiteThemesController],
  providers: [WebsiteThemesService],
})
export class WebsiteThemesModule {}
