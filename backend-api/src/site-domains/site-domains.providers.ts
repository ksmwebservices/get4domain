import { Provider, Type } from '@nestjs/common';
import { DomainsAdminController } from './api/domains-admin.controller';
import { MeDomainsController } from './api/me-domains.controller';
import { DnsGate } from './dns-gate';
import { DomainRepository } from './domain.repository';
import { HostDirectory } from './host-directory';
import { PrismaDomainRepository } from './prisma-domain.repository';
import { DomainSettingsService } from './settings/domain-settings.service';
import { DomainHostResolver, DomainVendorHosts } from './site-publish-adapters';
import { CanonicalAdminController } from './api/canonical-admin.controller';
import { CanonicalStore, SiteRebuild } from './canonical.store';
import { CanonicalSwitchService } from './canonical-switch.service';
import { ModuleSiteRebuild } from './module-site-rebuild';
import { PrismaCanonicalStore } from './prisma-canonical.store';
import { SiteDomainsService } from './site-domains.service';

/** Every provider and controller of the domain slice in one list: SiteDomainsModule uses it and the staging integration tests assemble the same list into a slim app. */
export const SITE_DOMAIN_PROVIDERS: Provider[] = [
  { provide: DomainRepository, useClass: PrismaDomainRepository },
  DomainSettingsService, DnsGate, HostDirectory, SiteDomainsService, DomainHostResolver, DomainVendorHosts,
  { provide: CanonicalStore, useClass: PrismaCanonicalStore }, { provide: SiteRebuild, useClass: ModuleSiteRebuild }, CanonicalSwitchService,   // slice 5.6b
];
export const SITE_DOMAIN_CONTROLLERS: Type<unknown>[] = [MeDomainsController, DomainsAdminController, CanonicalAdminController];
