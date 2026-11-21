import { Global, Injectable, Logger, Module, Provider, Type } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlanBillingModule } from '../plan-billing/plan-billing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SiteDomainsModule } from '../site-domains/site-domains.module';
import { V3ServicesModule } from '../v3-services/services.module';
import { SERVICE_REQUESTS_USAGE, ServiceUsagePort } from '../v3-services/services.store';
import { AdminServiceRequestsController, AdminVendorServiceRequestsController, MeServiceRequestsController } from './api/requests.controllers';
import { CanonicalPromotionGrant, PromotionGrantPort } from './promotion-grant.port';
import { PrismaRequestsStore } from './prisma-requests.store';
import { RequestsStore } from './requests.store';
import { ServiceRequestsService } from './service-requests.service';

/** The real count of plan-allowance units used, for the catalogue. It reads the requests, so it lives here; the services module reaches it through an optional token. */
@Injectable()
export class RequestsServiceUsage extends ServiceUsagePort {
  constructor(private readonly store: RequestsStore) { super(); }
  allowanceUsed(vendorId: string, serviceKey: string): Promise<number> { return this.store.allowanceUsedFor(vendorId, serviceKey); }
}

/** The hourly tick: mark requests past their due time, and (only when staff switched it on and set the days) approve work that waited too long in review. One tick at a time per process. */
@Injectable()
export class ServiceRequestsCron {
  private readonly logger = new Logger(ServiceRequestsCron.name);
  private busy = false;
  constructor(private readonly requests: ServiceRequestsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const sla = await this.requests.slaSweep(); const auto = await this.requests.autoApproveTick();
      if (sla.marked || auto.approved || auto.failed) this.logger.log(`service requests: ${sla.marked} past due, ${auto.approved} auto-approved, ${auto.failed} failed`);
    } catch (e) {
      this.logger.error(`service requests tick failed: ${e instanceof Error ? e.name : 'error'}`);   // the message can echo a connection string; the name cannot
    } finally { this.busy = false; }
  }
}

/** Every provider and controller of slice 5.16c in one list: the module and the staging test app use it. */
export const SERVICE_REQUESTS_PROVIDERS: Provider[] = [
  { provide: RequestsStore, useClass: PrismaRequestsStore }, { provide: PromotionGrantPort, useClass: CanonicalPromotionGrant }, ServiceRequestsService, RequestsServiceUsage,
  { provide: SERVICE_REQUESTS_USAGE, useExisting: RequestsServiceUsage }, ServiceRequestsCron,
];
export const SERVICE_REQUESTS_CONTROLLERS: Type<unknown>[] = [MeServiceRequestsController, AdminServiceRequestsController, AdminVendorServiceRequestsController];

/**
 * Service requests (slice 5.16c). GLOBAL so the catalogue (slice 5.16b) can read the real allowance count without importing this module. The wallet store comes from its global module, the services
 * store and plan billing settings from the modules imported here; the custom-domain add-on is switched on through the existing canonical-host service (slice 5.6b). Nothing here touches the legacy billing, wallet, add-on or menu code (decision D1).
 */
@Global()
@Module({ imports: [PrismaModule, SiteDomainsModule, PlanBillingModule, V3ServicesModule], controllers: SERVICE_REQUESTS_CONTROLLERS, providers: SERVICE_REQUESTS_PROVIDERS, exports: [ServiceRequestsService, RequestsStore, SERVICE_REQUESTS_USAGE] })
export class V3ServiceRequestsModule {}

