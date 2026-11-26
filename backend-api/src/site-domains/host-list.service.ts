import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { confusableKeys } from './core/hostname';
import { DomainSettingsService } from './settings/domain-settings.service';
import { SUBDOMAIN_HARD_MAX } from './settings/domain-settings';

/** How long one answer is reused. The server script asks once a minute, so a change appears within about that. */
export const HOST_LIST_CACHE_MS = 10_000;
/** The site app treats names that start like the platform's own test and portal hosts (v3site, v3admin, t3-...) as never being vendors. */
const RESERVED_PREFIX = /^(v3|t3-)/;
const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export interface HostList { hosts: string[]; generatedAt: string }

/** The one rule for a name that may be sent to Version 3: well formed, at most 40 characters, not reserved (look-alikes included) and not a platform-style prefix. */
export function routableLabel(label: string, reservedKeys: ReadonlySet<string>): boolean {
  return label.length <= SUBDOMAIN_HARD_MAX && LABEL.test(label) && !RESERVED_PREFIX.test(label) && !confusableKeys(label).some((k) => reservedKeys.has(k));
}

/**
 * E11d: the host names the server's web server must send to Version 3: the free address of every business with a PUBLISHED site, and any older free address of
 * such a business that still redirects. Names only, nothing about the business. A removed business is left out. A business under a legal takedown STAYS in the
 * list, because its address must keep answering with the takedown notice. Custom domains are not part of this list.
 */
@Injectable()
export class HostListService {
  clock: () => Date = () => new Date();
  private readonly logger = new Logger(HostListService.name);
  private cache: { at: number; value: HostList } | null = null;

  constructor(private readonly prisma: PrismaService, private readonly settings: DomainSettingsService) {}

  async list(): Promise<HostList> {
    const now = this.clock();
    if (this.cache && now.getTime() - this.cache.at < HOST_LIST_CACHE_MS) return this.cache.value;
    const s = await this.settings.get();
    const base = `.${s.baseDomain}`;
    const live = { v3SiteRemoval: { is: null }, v3SitePublications: { some: { status: 'PUBLISHED' as const } } };
    const [vendors, redirects] = await Promise.all([
      this.prisma.vendor.findMany({ where: { subdomain: { not: null }, ...live }, select: { subdomain: true } }),
      this.prisma.v3Redirect.findMany({ where: { active: true, vendor: live }, select: { fromHost: true } }),
    ]);
    const reserved = new Set(s.reservedSubdomains.flatMap((r) => confusableKeys(r)));
    const labels = [
      ...vendors.map((v) => (v.subdomain ?? '').toLowerCase()),
      ...redirects.map((r) => r.fromHost.toLowerCase()).filter((h) => h.endsWith(base)).map((h) => h.slice(0, -base.length)),
    ].filter(Boolean);
    const kept = labels.filter((l) => routableLabel(l, reserved));
    const left = new Set(labels).size - new Set(kept).size;
    if (left > 0) this.logger.warn(`${left} published address(es) are left out of the host list (reserved, too long or not well formed).`);
    const value: HostList = { hosts: [...new Set(kept.map((l) => `${l}${base}`))].sort(), generatedAt: now.toISOString() };
    this.cache = { at: now.getTime(), value };
    return value;
  }
}
