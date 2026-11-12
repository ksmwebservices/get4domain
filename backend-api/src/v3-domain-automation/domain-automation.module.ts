import { Injectable, Logger, Module, Provider, Type } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { SiteDomainsModule } from '../site-domains/site-domains.module';
import { DomainSettingsService } from '../site-domains/settings/domain-settings.service';
import { AdminConnectionController, MeConnectionController } from './api/connection.controllers';
import { CloudflarePort, UnavailableCloudflarePort } from './cloudflare.port';
import { DomainConnectionService } from './connection.service';
import { ConnectionStore, PrismaConnectionStore } from './connection.store';
import { DomainLogService, DomainLogStore, PrismaDomainLogStore } from './domain-log';
import { AutomationSettingsService } from './settings/automation-settings';

/** The background watcher: certificate state, plan lapse and restore for every connection. It does nothing until staff turn connectionWatcherEnabled on. */
@Injectable()
export class ConnectionWatcherCron {
  private readonly logger = new Logger(ConnectionWatcherCron.name);
  private busy = false;
  constructor(private readonly svc: DomainConnectionService) {}
  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try { await this.svc.watchTick(); } catch (e) { this.logger.warn(`connection watcher failed: ${e instanceof Error ? e.name : 'error'}`); } finally { this.busy = false; }
  }
}

export const DOMAIN_AUTOMATION_PROVIDERS: Provider[] = [
  { provide: ConnectionStore, useClass: PrismaConnectionStore },
  { provide: CloudflarePort, useClass: UnavailableCloudflarePort },   // never live in this run; the owner's live step binds a real adapter
  { provide: DomainLogStore, useClass: PrismaDomainLogStore },
  AutomationSettingsService, DomainSettingsService, DomainConnectionService, DomainLogService, ConnectionWatcherCron,
];
export const DOMAIN_AUTOMATION_CONTROLLERS: Type<unknown>[] = [MeConnectionController, AdminConnectionController];

/** Own-domain automation (slice 5.6c). Fake Cloudflare in tests only; production binds the unavailable port. */
@Module({ imports: [PrismaModule, SiteDomainsModule], controllers: DOMAIN_AUTOMATION_CONTROLLERS, providers: DOMAIN_AUTOMATION_PROVIDERS, exports: [DomainConnectionService, DomainLogService] })
export class V3DomainAutomationModule {}
