import { Global, Module, Provider, Type } from '@nestjs/common';
import { OtpPepper } from '../directory/pepper';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTrustController, MeTrustController, PublicReportController } from './api/trust.controllers';
import { PrismaTrustStore } from './prisma-trust.store';
import { PayeeNameCheckPort, ProhibitedScanPort, TakedownPort } from './trust.ports';
import { BlocklistService, FakePayeeNameCheck, ProofsService, ReportsService, TakedownService, TermsService, TrustScanService } from './trust.service';
import { TrustStore } from './trust.store';

/** Every provider and controller of slice 5.21 in one list: the module and the staging test app use it. */
export const TRUST_PROVIDERS: Provider[] = [
  { provide: TrustStore, useClass: PrismaTrustStore }, OtpPepper, ProofsService, BlocklistService, ReportsService, TermsService, TakedownService, TrustScanService, FakePayeeNameCheck,
  { provide: ProhibitedScanPort, useExisting: TrustScanService }, { provide: TakedownPort, useExisting: TakedownService }, { provide: PayeeNameCheckPort, useExisting: FakePayeeNameCheck },
];
export const TRUST_CONTROLLERS: Type<unknown>[] = [PublicReportController, MeTrustController, AdminTrustController];

/**
 * Trust and safety (slice 5.21). Global, so the site publisher, the public requests service and the payment slice reach the ports (`ProhibitedScanPort`, `TakedownPort`, `PayeeNameCheckPort`)
 * without importing this module. Nothing here touches the legacy blocklist, audit, notification, billing or wallet code (decision D1).
 */
@Global()
@Module({ imports: [PrismaModule], controllers: TRUST_CONTROLLERS, providers: TRUST_PROVIDERS, exports: [ProhibitedScanPort, TakedownPort, PayeeNameCheckPort, TrustStore, TakedownService, BlocklistService] })
export class V3TrustModule {}
