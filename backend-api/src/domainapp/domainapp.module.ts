import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { DomainAppInvoicesController } from './invoices.controller';
import { DomainAppInvoicesService } from './invoices.service';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  controllers: [
    ContactsController,
    CatalogController,
    RecordsController,
    DomainAppInvoicesController,
    SummaryController,
  ],
  providers: [
    ContactsService,
    CatalogService,
    RecordsService,
    DomainAppInvoicesService,
    SummaryService,
  ],
  exports: [ContactsService, CatalogService, RecordsService, DomainAppInvoicesService],
})
export class DomainAppModule {}
