import { Provider, Type } from '@nestjs/common';
import { AdminRequestsController } from './api/admin-requests.controller';
import { MeOffersController, MePaymentsController, MeRequestsController } from './api/me-requests.controller';
import { PublicRequestsController, VendorWebhookController } from './api/public-requests.controller';
import { MessagingService } from './messaging.service';
import { PrismaRequestsStore } from './prisma-requests.store';
import { PublicRequestsService } from './public-requests.service';
import { RequestsCron } from './requests.cron';
import { Catalogue, ContentCatalogue, OwnGatewayGate } from './requests-ports';
import { RequestsStore } from './requests.store';
import { StaffRequestsService } from './staff-requests.service';
import { VendorRequestsService } from './vendor-requests.service';
import { VendorWebhookService } from './vendor-webhook.service';

/** Every provider and controller of the bridge in one list: RequestsOrdersModule uses it and the staging integration tests assemble the same list into a slim app. */
export const REQUESTS_PROVIDERS: Provider[] = [
  { provide: RequestsStore, useClass: PrismaRequestsStore }, { provide: Catalogue, useClass: ContentCatalogue }, { provide: 'PUBLIC_APP_URL', useFactory: () => process.env.PUBLIC_APP_URL || 'https://get4domain.com' },
  OwnGatewayGate, MessagingService, PublicRequestsService, VendorRequestsService, VendorWebhookService, StaffRequestsService, RequestsCron,
];
export const REQUESTS_CONTROLLERS: Type<unknown>[] = [PublicRequestsController, VendorWebhookController, MeRequestsController, MeOffersController, MePaymentsController, AdminRequestsController];
