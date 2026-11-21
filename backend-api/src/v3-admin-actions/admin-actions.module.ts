import { Global, Injectable, Logger, Module, Type } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { SiteDomainsModule } from '../site-domains/site-domains.module';
import { HostDirectory } from '../site-domains/host-directory';
import { VisitCounterPort } from '../site-publish/publish/visit-counter.port';
import { AdminActionsController, AdminMergesController } from './api/admin-actions.controllers';
import { AdminActionsService } from './admin-actions.service';
import { AdminActionsStore } from './admin-actions.store';
import { HostVisitService } from './host-visits.service';
import { PrismaAdminActionsStore } from './prisma-admin-actions.store';
import { AdminActionsSettingsService } from './settings/admin-actions-settings';

/** The job that applies plan changes whose date has come (every 5 minutes). Safe to repeat. */
@Injectable()
export class PlanChangeCron {
  private readonly logger = new Logger(PlanChangeCron.name);
  private busy = false;
  constructor(private readonly actions: AdminActionsService) {}
  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try { await this.actions.applyDuePlanChanges(); } catch (e) { this.logger.error(`scheduled plan changes failed: ${e instanceof Error ? e.name : 'error'}`); } finally { this.busy = false; }
  }
}

export const ADMIN_ACTIONS_CONTROLLERS: Type<unknown>[] = [AdminActionsController, AdminMergesController];
export const ADMIN_ACTIONS_PROVIDERS = [
  { provide: AdminActionsStore, useClass: PrismaAdminActionsStore }, AdminActionsSettingsService, AdminActionsService, PlanChangeCron,
  { provide: HostVisitService, useFactory: (store: AdminActionsStore, hosts: HostDirectory) => new HostVisitService(store, hosts), inject: [AdminActionsStore, HostDirectory] },
  { provide: VisitCounterPort, useExisting: HostVisitService },
];

/** Staff actions and per-host visit counts (Block 4b slice 9). Global so the public page route can take the visit counter without importing this module. PlansModule (subscriptions) and the trust module are global. */
@Global()
@Module({ imports: [PrismaModule, SiteDomainsModule], controllers: ADMIN_ACTIONS_CONTROLLERS, providers: ADMIN_ACTIONS_PROVIDERS, exports: [VisitCounterPort, AdminActionsService] })
export class V3AdminActionsModule {}
