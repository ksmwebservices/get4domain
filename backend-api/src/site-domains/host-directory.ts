import { Injectable } from '@nestjs/common';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { choosePrimary, planRedirect, RedirectDecision } from './core/canonical';
import { normaliseHostname } from './core/hostname';
import { DomainRecord, DomainRepository } from './domain.repository';
import { DomainSettings } from './settings/domain-settings';
import { DomainSettingsService } from './settings/domain-settings.service';

export interface ResolvedHost { vendorId: string; host: string; primaryHost: string; decision: RedirectDecision }

const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 5000;

/**
 * Host name -> vendor, canonical host and redirect decision (slice 5.6). The one truth the public by-host API, the renderer's customDomain flag and (later) the Next.js host
 * router share. Read-only. Decisions are kept in process memory for 30 seconds and forgotten at once after any domain write (invalidate). A suspended vendor, an unknown host
 * and a custom domain that is not ACTIVE all give the same null.
 */
@Injectable()
export class HostDirectory {
  clock: () => Date = () => new Date();
  private cache = new Map<string, { at: number; v: ResolvedHost | null }>();

  constructor(private readonly repo: DomainRepository, private readonly settings: DomainSettingsService, private readonly ents: EntitlementsService) {}

  invalidate(): void { this.cache.clear(); }
  cacheSize(): number { return this.cache.size; }

  async resolveHost(host: string): Promise<ResolvedHost | null> {
    const h = normaliseHostname(host);
    if (!h) return null;
    const now = this.clock().getTime();
    const hit = this.cache.get(h);
    if (hit && now - hit.at < CACHE_TTL_MS && (await this.stillSafe(hit.v))) return hit.v;
    const v = await this.resolveUncached(h);
    if (this.cache.size >= CACHE_MAX) this.cache.clear();
    this.cache.set(h, { at: now, v });
    return v;
  }

  /**
   * The cache only saves the expensive part (plan, entitlements, redirect plan). The vendor's status is re-read on EVERY request (one primary-key lookup), because the legacy
   * admin suspends a vendor without telling this module and a refusal must never wait for a timer. Domain-row changes made through this module call invalidate(); a change made by
   * another server instance is picked up within the 30 second TTL (documented bound).
   */
  private async stillSafe(v: ResolvedHost | null): Promise<boolean> {
    if (!v) return true;   // a cached "no" can never serve anything
    const vendor = await this.repo.vendorInfo(v.vendorId);
    return !!vendor && vendor.status !== 'SUSPENDED';
  }

  /** The entitlement bridge: true only when the plan allows custom domains AND one is ACTIVE (verified). Closes the slice 5.1 gap in toRenderEntitlements. */
  async hasVerifiedCustomDomain(vendorId: string): Promise<boolean> {
    if (!(await this.customAllowed(vendorId))) return false;
    return (await this.repo.listForVendor(vendorId)).some((r) => r.kind === 'CUSTOM' && r.status === 'ACTIVE');
  }

  /** The canonical host for a vendor, and whether it is a custom domain. Falls back to the legacy <subdomain>.<base> address. */
  async primaryHostFor(vendorId: string): Promise<{ host: string | null; isCustom: boolean }> {
    const s = await this.settings.get();
    const p = await this.plan(vendorId, s);
    const row = p.rows.find((r) => r.hostname === p.primaryHost && r.status === 'ACTIVE');
    return { host: p.primaryHost, isCustom: row?.kind === 'CUSTOM' };
  }

  private async customAllowed(vendorId: string): Promise<boolean> { return (await this.ents.resolve(vendorId)).features['site.custom_domain']?.state === 'ACTIVE'; }

  private async resolveUncached(h: string): Promise<ResolvedHost | null> {
    const s = await this.settings.get();
    const row = await this.repo.findByHostname(h);
    if (row) {
      if (row.status === 'REMOVED') return this.fromRedirectTable(h, s);
      if (row.status !== 'ACTIVE') return null;
      return this.forVendor(row.vendorId, h, s);
    }
    const viaTable = await this.fromRedirectTable(h, s);
    if (viaTable) return viaTable;
    const counterpart = h.startsWith('www.') ? h.slice(4) : `www.${h}`;
    const crow = await this.repo.findByHostname(counterpart);
    if (crow && crow.kind === 'CUSTOM' && crow.status === 'ACTIVE') return this.forVendor(crow.vendorId, h, s);
    const base = `.${s.baseDomain}`;
    if (h.endsWith(base)) {
      const slug = h.slice(0, -base.length);
      if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
        const v = await this.repo.vendorBySubdomain(slug);
        if (v) return this.forVendor(v.id, h, s);
      }
    }
    return null;
  }

  private async fromRedirectTable(h: string, s: DomainSettings): Promise<ResolvedHost | null> {
    const red = await this.repo.findRedirect(h, '/');
    if (!red) return null;
    const vendor = await this.repo.vendorInfo(red.vendorId);
    if (!vendor || vendor.status === 'SUSPENDED') return null;
    const plan = await this.plan(red.vendorId, s);
    const toHost = plan.primaryHost ?? red.toHost;
    return { vendorId: red.vendorId, host: h, primaryHost: toHost, decision: { action: 'REDIRECT', host: toHost, status: red.status === 302 ? 302 : 301 } };
  }

  private async plan(vendorId: string, s: DomainSettings): Promise<{ rows: DomainRecord[]; primaryHost: string | null; owned: string[] }> {
    const [rows, vendor, allowed] = await Promise.all([this.repo.listForVendor(vendorId), this.repo.vendorInfo(vendorId), this.customAllowed(vendorId)]);
    const active = rows.filter((r) => r.status === 'ACTIVE');
    const legacyHost = vendor?.subdomain ? `${vendor.subdomain}.${s.baseDomain}` : null;
    const owned = active.map((r) => r.hostname);
    if (legacyHost && !owned.includes(legacyHost) && !rows.some((r) => r.hostname === legacyHost)) owned.push(legacyHost);
    const primary = choosePrimary(rows, { customAllowed: allowed });
    return { rows, primaryHost: primary?.hostname ?? legacyHost, owned };
  }

  private async forVendor(vendorId: string, h: string, s: DomainSettings): Promise<ResolvedHost | null> {
    const vendor = await this.repo.vendorInfo(vendorId);
    if (!vendor || vendor.status === 'SUSPENDED') return null;
    const p = await this.plan(vendorId, s);
    const primaryHost = p.primaryHost ?? h;
    const decision = planRedirect({ requestHost: h, primaryHost, ownedHosts: p.owned, wwwPolicy: s.wwwPolicy });
    return decision.action === 'UNKNOWN' ? null : { vendorId, host: h, primaryHost, decision };
  }
}
