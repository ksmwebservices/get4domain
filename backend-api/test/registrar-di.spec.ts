import { Test } from '@nestjs/testing';
import { ActivityBus } from '../src/common/activity-bus';
import { AuditService } from '../src/plans/admin/audit.service';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CanonicalSwitchService } from '../src/site-domains/canonical-switch.service';
import { HostDirectory } from '../src/site-domains/host-directory';
import { DomainConnectionService } from '../src/v3-domain-automation/connection.service';
import { DOMAIN_AUTOMATION_PROVIDERS } from '../src/v3-domain-automation/domain-automation.module';
import { RegistrarService } from '../src/v3-registrar/registrar.service';
import { IdentityService } from '../src/v3-registrar/identity.service';
import { REGISTRAR_PROVIDERS, RegistrarCron, RegistrarStartupGuard } from '../src/v3-registrar/registrar.module';
import { RegistrarPort, GatedRegistrarPort } from '../src/v3-registrar/registrar.port';
import { WalletSettingsService } from '../src/v3-wallet/settings/wallet-settings.service';
import { V3WalletService } from '../src/v3-wallet/wallet.service';
import { IdentityOtpSender } from '../src/v3-registrar/identity.service';
import { WalletStore } from '../src/v3-wallet/wallet.store';

/**
 * A real Nest dependency resolution of this run's two provider lists, with only the services that live in OTHER modules (wallet, plans, domains, prisma) stubbed. It proves that nothing a provider
 * asks for is missing from the lists. (Booting the whole application needs a database: that is the staging integration tests' job.)
 */
describe('dependency injection of the Batch 11 providers', () => {
  const external = [PrismaService, WalletStore, V3WalletService, WalletSettingsService, EntitlementsService, CanonicalSwitchService, HostDirectory, AuditService, ActivityBus, IdentityOtpSender].map((provide) => ({ provide, useValue: {} }));

  it('every provider of the domain automation and the registrar modules resolves', async () => {
    const m = await Test.createTestingModule({ providers: [...external, ...DOMAIN_AUTOMATION_PROVIDERS, ...REGISTRAR_PROVIDERS.filter((p) => p !== RegistrarStartupGuard)] }).compile();
    expect(m.get(RegistrarService)).toBeInstanceOf(RegistrarService);
    expect(m.get(IdentityService)).toBeInstanceOf(IdentityService);
    expect(m.get(DomainConnectionService)).toBeInstanceOf(DomainConnectionService);
    expect(m.get(RegistrarPort)).toBeInstanceOf(GatedRegistrarPort);
    expect(m.get(RegistrarCron)).toBeDefined();
  });
});
