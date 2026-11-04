import { Injectable } from '@nestjs/common';
import { HostResolver } from '../site-publish/publish/site-public.service';
import { VendorHosts } from '../site-publish/publish/vendor-hosts';
import { HostDirectory } from './host-directory';

/** Replaces the slice 5.4 placeholder resolver: the public by-host API now follows the domain tables and the redirect plan. Same contract; a redirect is added for non-primary hosts. */
@Injectable()
export class DomainHostResolver extends HostResolver {
  constructor(private readonly dir: HostDirectory) { super(); }
  async resolve(host: string): Promise<{ vendorId: string; redirect?: { host: string; status: 301 | 302 } } | null> {
    const r = await this.dir.resolveHost(host);
    if (!r) return null;
    return r.decision.action === 'REDIRECT' ? { vendorId: r.vendorId, redirect: { host: r.decision.host, status: r.decision.status } } : { vendorId: r.vendorId };
  }
}

/** The site build asks the domain slice for the canonical host and for the customDomain entitlement fact. */
@Injectable()
export class DomainVendorHosts extends VendorHosts {
  constructor(private readonly dir: HostDirectory) { super(); }
  primary(vendorId: string) { return this.dir.primaryHostFor(vendorId); }
  hasVerifiedCustomDomain(vendorId: string) { return this.dir.hasVerifiedCustomDomain(vendorId); }
}
