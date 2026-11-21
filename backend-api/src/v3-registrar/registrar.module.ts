import { V3PacksModule } from '../v3-packs/packs.module';
import { Injectable, Logger, Module, OnModuleInit, Optional, Provider, Type } from '@nestjs/common';
import { IntegrationSettingsService } from '../v3-integrations/integration-settings.service';
import { V3IntegrationsModule } from '../v3-integrations/integrations.module';
import { Cron } from '@nestjs/schedule';
import { OtpPepper } from '../directory/pepper';
import { PrismaModule } from '../prisma/prisma.module';
import { V3DomainAutomationModule } from '../v3-domain-automation/domain-automation.module';
import { AdminRegistrarController, MeDomainSalesController, MeIdentityController } from './api/registrar.controllers';
import { liveFlags, liveGuardProblems } from './core/registrar-core';
import { AesGcmDocCrypto, DocCrypto } from './doc-crypto';
import { IdentityService } from './identity.service';
import { PrismaRegistrarStore } from './prisma-registrar.store';
import { GatedRegistrarPort, RegistrarPort } from './registrar.port';
import { RegistrarService } from './registrar.service';
import { RegistrarStore } from './registrar.store';
import { FetchHttp, RegistrarHttp, ResellerClubAdapter } from './resellerclub.adapter';
import { RegistrarSettingsService } from './settings/registrar-settings';

/**
 * The startup guard (owner override 2): live mode is refused unless the keys exist in the server environment. It names the missing variables, never a value. With both flags OFF (the default)
 * it does nothing and the registrar port refuses every call.
 */
@Injectable()
export class RegistrarStartupGuard implements OnModuleInit {
  private readonly logger = new Logger(RegistrarStartupGuard.name);
  env: () => Record<string, string | undefined> = () => process.env;
  /** R1.1: the keys may also be the ones saved in the integration settings; when that service is present the check waits for it (a promise), otherwise it is the plain synchronous environment check. */
  constructor(@Optional() private readonly saved?: IntegrationSettingsService) {}
  onModuleInit(): void | Promise<void> {
    const missing = liveGuardProblems(this.env());
    const refuse = (): never => { throw new Error(`Registrar live mode refused: ${missing.join(' and ')} must be set in the server environment, or saved in the integration settings`); };
    if (missing.length && !this.saved) throw new Error(`Registrar live mode refused: ${missing.join(' and ')} must be set in the server environment`);
    const done = (): void => { const f = liveFlags(this.env()); this.logger.log(`registrar live search ${f.search ? 'ON' : 'off'}, live purchase ${f.purchase ? 'ON' : 'off'}`); };
    if (missing.length && this.saved) return this.saved.resolve('resellerclub').then((v) => { if (!v) refuse(); done(); });
    done();
  }
}

/** The background jobs. Each does nothing until its own staff setting allows it. */
@Injectable()
export class RegistrarCron {
  private readonly logger = new Logger(RegistrarCron.name);
  private busy = new Set<string>();
  constructor(private readonly svc: RegistrarService, private readonly identity: IdentityService, private readonly settings: RegistrarSettingsService) {}
  private async once(name: string, fn: () => Promise<unknown>): Promise<void> {
    if (this.busy.has(name)) return;
    this.busy.add(name);
    try { await fn(); } catch (e) { this.logger.warn(`${name} failed: ${e instanceof Error ? e.name : 'error'}`); } finally { this.busy.delete(name); }
  }
  @Cron('*/10 * * * *') recover(): Promise<void> { return this.once('recover', async () => { const m = (await this.settings.get()).registrarRecoverAfterMinutes; if (m !== null) await this.svc.recover(m); }); }
  @Cron('0 * * * *') transfers(): Promise<void> { return this.once('transfers', () => this.svc.settleTransfers()); }
  @Cron('0 3 * * *') reconcile(): Promise<void> { return this.once('reconcile', async () => { if ((await this.settings.get()).registrarReconcileEnabled) await this.svc.reconcile(); }); }
  @Cron('0 4 * * *') purge(): Promise<void> { return this.once('purge', () => this.identity.purgeDue()); }
  @Cron('0 6 * * *') expiry(): Promise<void> { return this.once('expiry', () => this.svc.expiryTick()); }
}

import { PublicDomainAvailabilityController } from './api/public-availability.controller';
import { PublicDomainAvailabilityService } from './public-availability.service';

export const REGISTRAR_PROVIDERS: Provider[] = [
  { provide: RegistrarStore, useClass: PrismaRegistrarStore },
  { provide: RegistrarHttp, useFactory: () => new FetchHttp() },
  // The product binding: the gated ResellerClub adapter. With both live flags OFF (the default) every call is refused before the adapter is reached. No fake exists in the product.
  // R1.2: the adapter reads the keys saved in the integration settings (mode demo or live) and falls back to the server environment; the settings service is optional so a module without it behaves as before
  { provide: RegistrarPort, useFactory: (http: RegistrarHttp, saved?: IntegrationSettingsService) => new GatedRegistrarPort(new ResellerClubAdapter(http, () => process.env, saved ? async () => { const v = await saved.resolve('resellerclub'); return v ? { userId: v.resellerId, apiKey: v.apiKey, mode: v.mode === 'live' ? ('live' as const) : ('demo' as const) } : null; } : undefined)), inject: [RegistrarHttp, { token: IntegrationSettingsService, optional: true }] },
  { provide: DocCrypto, useFactory: () => new AesGcmDocCrypto() },
  // IdentityOtpSender comes from the global V3MailModule (Block 4b): email on lane 1 behind EMAIL_LIVE_SEND (default OFF); the phone channel is bound with the SMS port
  OtpPepper, RegistrarSettingsService, IdentityService, RegistrarService, RegistrarCron, RegistrarStartupGuard, PublicDomainAvailabilityService,
];
export const REGISTRAR_CONTROLLERS: Type<unknown>[] = [MeDomainSalesController, MeIdentityController, AdminRegistrarController, PublicDomainAvailabilityController];

/** Domain sales (slice 5.6d). It spends through the V3 wallet (global) and reads the plan through the entitlements (global). Nothing here touches the old ResellerClub service or any legacy table. */
@Module({ imports: [PrismaModule, V3DomainAutomationModule, V3PacksModule, V3IntegrationsModule], controllers: REGISTRAR_CONTROLLERS, providers: REGISTRAR_PROVIDERS, exports: [RegistrarService, IdentityService, RegistrarStore] })
export class V3RegistrarModule {}
