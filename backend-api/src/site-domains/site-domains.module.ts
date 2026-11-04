import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CanonicalSwitchService } from './canonical-switch.service';
import { HostDirectory } from './host-directory';
import { SITE_DOMAIN_CONTROLLERS, SITE_DOMAIN_PROVIDERS } from './site-domains.providers';
import { SiteDomainsService } from './site-domains.service';
import { DomainHostResolver, DomainVendorHosts } from './site-publish-adapters';

/**
 * Subdomain rules and domain mapping (slice 5.6). PlansModule is @Global, so the entitlement engine and the audit service are available here. Nothing in this module buys a
 * domain, calls a registrar, changes DNS or issues a certificate; the DNS TXT check runs only when the setting domainDnsLiveChecks is on (default off).
 */
@Module({
  imports: [PrismaModule],
  controllers: SITE_DOMAIN_CONTROLLERS,
  providers: SITE_DOMAIN_PROVIDERS,
  exports: [HostDirectory, SiteDomainsService, DomainHostResolver, DomainVendorHosts, CanonicalSwitchService],
})
export class SiteDomainsModule {}
