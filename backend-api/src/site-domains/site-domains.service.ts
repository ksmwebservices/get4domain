import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Actor } from '../plans/admin/audit.service';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { planError } from '../plans/plans.errors';
import { canonicalHostFor } from './core/canonical';
import { normaliseHostname, validateSubdomainSlug } from './core/hostname';
import { challengeName, checkTxt, generateTxtValue, TxtResult } from './core/verification';
import { DnsGate } from './dns-gate';
import {
  DomainListQuery, DomainRecord, DomainRepository, DomainStatus, DomainTx, DuplicateHostError, SslStatus, VerificationRecord,
} from './domain.repository';
import { HostDirectory } from './host-directory';
import { DOMAIN_NOT_FOUND_MESSAGE, domainError, HOST_UNAVAILABLE_MESSAGE } from './site-domains.errors';
import { DomainSettings } from './settings/domain-settings';
import { DomainSettingsService } from './settings/domain-settings.service';

export interface DomainView {
  id: string; hostname: string; kind: DomainRecord['kind']; status: DomainStatus; isPrimary: boolean; verifiedAt: Date | null; sslStatus: SslStatus; createdAt: Date;
  instructions: { type: 'TXT'; name: string; value: string } | null;
  lastCheck: { at: Date | null; result: string; attempts: number } | null;
}
export interface VerifyOutcome { result: TxtResult | 'DISABLED' | 'MATCHED'; domain: DomainView }

const DAY = 86_400_000;
const unavailable = (): ConflictException => new ConflictException(domainError('HOST_UNAVAILABLE', HOST_UNAVAILABLE_MESSAGE));
const notFound = (): NotFoundException => new NotFoundException(domainError('DOMAIN_NOT_FOUND', DOMAIN_NOT_FOUND_MESSAGE));
const badState = (m: string): ConflictException => new ConflictException(domainError('DOMAIN_STATE_INVALID', m));

/**
 * Free subdomain rules, custom domain requests, TXT ownership checks, primary host and removal (slice 5.6). Writes are serialised per vendor by the repository's
 * transaction and audited in the same transaction. Nothing here buys a domain, changes DNS or issues a certificate: sslStatus is a recorded field.
 * `vendorId` null on a method means a STAFF caller (any vendor); a vendor id means the owner, who can only see and touch their own rows (anything else is DOMAIN_NOT_FOUND).
 */
@Injectable()
export class SiteDomainsService {
  clock: () => Date = () => new Date();
  random: (chars: number) => string = (chars) => randomBytes(Math.ceil(chars / 2)).toString('hex').slice(0, chars);

  constructor(
    private readonly repo: DomainRepository, private readonly settings: DomainSettingsService, private readonly ents: EntitlementsService,
    private readonly dns: DnsGate, private readonly dir: HostDirectory,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────────────────────── reads
  private view(r: DomainRecord, v: VerificationRecord | null, s: DomainSettings): DomainView {
    return {
      id: r.id, hostname: r.hostname, kind: r.kind, status: r.status, isPrimary: r.isPrimary, verifiedAt: r.verifiedAt, sslStatus: r.sslStatus, createdAt: r.createdAt,
      instructions: r.kind === 'CUSTOM' && r.status !== 'REMOVED' && v ? { type: 'TXT', name: challengeName(s.verificationTxtPrefix, r.hostname), value: v.expectedValue } : null,
      lastCheck: r.kind === 'CUSTOM' && v ? { at: v.lastCheckedAt, result: v.result, attempts: v.attempts } : null,
    };
  }
  private async viewOf(r: DomainRecord, s: DomainSettings, src: Pick<DomainRepository, 'getVerification'> = this.repo): Promise<DomainView> { return this.view(r, r.kind === 'CUSTOM' ? await src.getVerification(r.id) : null, s); }

  private async customState(vendorId: string): Promise<{ allowed: boolean; state: string; upsellText: string | null }> {
    const f = (await this.ents.resolve(vendorId)).features['site.custom_domain'];
    return { allowed: f?.state === 'ACTIVE', state: f?.state ?? 'HIDDEN', upsellText: f?.upsellText ?? null };
  }

  async overview(vendorId: string) {
    const s = await this.settings.get();
    const [rows, vendor, custom] = await Promise.all([this.repo.listForVendor(vendorId), this.repo.vendorInfo(vendorId), this.customState(vendorId)]);
    const legacy = vendor?.subdomain ? `${vendor.subdomain}.${s.baseDomain}` : null;
    const addonActive = (await this.ents.resolve(vendorId)).features['promotion.custom_domain_addon']?.state === 'ACTIVE';
    const canonical = canonicalHostFor({ rows, legacyHost: legacy, addonActive });
    const since = new Date(this.clock().getTime() - s.subdomainChangePeriodDays * DAY);
    return {
      baseDomain: s.baseDomain,
      primaryHost: canonical.canonicalHost,   // owner rule 4: the one canonical host (the subdomain unless the custom-domain promotion add-on is active)
      canonical: { host: canonical.canonicalHost, kind: canonical.canonicalKind, promotionAddonActive: addonActive },
      domains: await Promise.all(rows.filter((r) => r.status !== 'REMOVED').map((r) => this.viewOf(r, s))),
      customDomain: custom,
      subdomain: { changesUsed: await this.repo.countSubdomainChangesSince(vendorId, since), limit: s.subdomainChangeLimitPerPeriod, periodDays: s.subdomainChangePeriodDays },
    };
  }

  private async load(vendorId: string | null, id: string): Promise<DomainRecord> {
    const r = typeof id === 'string' && id ? await this.repo.findById(id) : null;
    if (!r || (vendorId !== null && r.vendorId !== vendorId)) throw notFound();
    return r;
  }

  async get(vendorId: string | null, id: string): Promise<DomainView> { const r = await this.load(vendorId, id); return this.viewOf(r, await this.settings.get()); }

  async listAll(q: DomainListQuery): Promise<{ items: DomainView[]; total: number }> {
    const s = await this.settings.get();
    const { items, total } = await this.repo.list({ ...q, q: q.q?.toLowerCase() });
    return { items: items.map((r) => this.view(r, null, s)).map((v) => ({ ...v, instructions: null })), total };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────── free subdomain
  setSubdomain(vendorId: string, slug: string, actor: Actor): Promise<DomainView> { return this.changeSubdomain(vendorId, slug, actor, false); }

  async staffSetSubdomain(vendorId: string, slug: string, reason: string, actor: Actor): Promise<DomainView> {
    this.needReason(reason);
    return this.changeSubdomain(vendorId, slug, actor, true);
  }

  private needReason(reason: string): void { if (typeof reason !== 'string' || reason.trim().length < 3) throw new BadRequestException('A reason of at least 3 characters is required.'); }

  private async changeSubdomain(vendorId: string, slugInput: string, actor: Actor, staff: boolean): Promise<DomainView> {
    const s = await this.settings.get();
    const v = validateSubdomainSlug(slugInput, { min: s.subdomainMinLength, max: s.subdomainMaxLength, reserved: s.reservedSubdomains, blockedWords: s.blockedSubdomainWords });
    if (!v.ok) {
      if (v.code === 'BLOCKED') throw unavailable();
      if (v.code === 'RESERVED') throw new BadRequestException(domainError('SUBDOMAIN_RESERVED', 'That name is reserved. Please choose another.'));
      throw new BadRequestException(domainError('SUBDOMAIN_INVALID', SLUG_MESSAGES[v.code] ?? 'That name is not valid.'));
    }
    const slug = v.slug; const full = `${slug}.${s.baseDomain}`; const now = this.clock();
    try {
      const row = await this.repo.transaction(vendorId, async (tx) => {
        const vendor = await tx.vendorInfo(vendorId);
        if (!vendor) throw notFound();
        let current = (await tx.listForVendor(vendorId)).find((r) => r.kind === 'SUBDOMAIN' && r.status === 'ACTIVE');
        if (!current && vendor.subdomain) current = await this.materialiseLegacy(tx, vendorId, `${vendor.subdomain}.${s.baseDomain}`, now);
        if (current && current.hostname === full) return current;   // nothing to change
        const owner = await tx.findByHostname(full);
        if (owner && owner.vendorId !== vendorId) throw unavailable();
        const legacyOwner = await tx.vendorBySubdomain(slug);
        if (legacyOwner && legacyOwner.id !== vendorId) throw unavailable();
        if (current && !staff) {
          const since = new Date(now.getTime() - s.subdomainChangePeriodDays * DAY);
          if ((await tx.countSubdomainChangesSince(vendorId, since)) >= s.subdomainChangeLimitPerPeriod) {
            throw new HttpException(domainError('SUBDOMAIN_CHANGE_LIMIT', 'You have changed your address as often as your plan allows for now. Please try again later or contact support.'), 429);
          }
        }
        const rows = await tx.listForVendor(vendorId);
        const wasPrimary = current?.isPrimary ?? false;
        const otherPrimary = rows.some((r) => r.isPrimary && r.status === 'ACTIVE' && r.id !== current?.id);
        if (current) await tx.update(current.id, { status: 'REMOVED', removedAt: now });
        const target = owner
          ? await tx.update(owner.id, { status: 'ACTIVE', removedAt: null, verifiedAt: now })
          : await tx.create({ vendorId, hostname: full, kind: 'SUBDOMAIN', status: 'ACTIVE', verifiedAt: now, createdByType: actor.type, createdById: actor.id });
        await tx.setSubdomainSlot(target.id, true);
        if (wasPrimary || !otherPrimary) await tx.setPrimary(vendorId, target.id);
        await tx.setVendorSubdomain(vendorId, slug);
        if (current) await tx.addRedirect({ vendorId, fromHost: current.hostname, fromPath: '/', toHost: full, toPath: '/', status: 301, source: 'SYSTEM' });
        const after = (await tx.findById(target.id))!;
        await tx.audit(actor, 'domain.subdomain.set', target.id, current ?? null, after);
        return after;
      });
      return await this.viewOf(row, s);
    } catch (e) {
      if (e instanceof DuplicateHostError) throw unavailable();
      throw e;
    } finally { this.dir.invalidate(); }
  }

  /** A vendor created before the domain tables has its address only in the vendor's subdomain column: bring it into the table so it can be changed, redirected and kept. */
  private async materialiseLegacy(tx: DomainTx, vendorId: string, host: string, now: Date): Promise<DomainRecord | undefined> {
    const existing = await tx.findByHostname(host);
    if (existing) return existing.vendorId === vendorId && existing.status === 'ACTIVE' ? existing : undefined;
    const row = await tx.create({ vendorId, hostname: host, kind: 'SUBDOMAIN', status: 'ACTIVE', verifiedAt: now, createdByType: 'SYSTEM', createdById: null });
    await tx.setSubdomainSlot(row.id, true);
    const anyPrimary = (await tx.listForVendor(vendorId)).some((r) => r.isPrimary && r.status === 'ACTIVE');
    if (!anyPrimary) await tx.setPrimary(vendorId, row.id);
    return (await tx.findById(row.id))!;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────── custom domain
  async requestCustom(vendorId: string, hostInput: string, actor: Actor): Promise<DomainView> {
    const custom = await this.customState(vendorId);
    if (!custom.allowed) throw new ForbiddenException(planError('FEATURE_LOCKED', 'Using your own web address is part of a higher plan.', { feature: 'site.custom_domain', upsellText: custom.upsellText }));
    const s = await this.settings.get();
    const host = normaliseHostname(hostInput);
    if (!host || host === s.baseDomain || host.endsWith(`.${s.baseDomain}`)) throw new BadRequestException(domainError('DOMAIN_INVALID', 'That is not a web address you can connect. Use a domain you own, for example shop.example.in.'));
    try {
      const view = await this.repo.transaction(vendorId, async (tx) => {
        if (!(await tx.vendorInfo(vendorId))) throw notFound();
        const existing = await tx.findByHostname(host);
        if (existing && existing.status !== 'REMOVED') {
          if (existing.vendorId === vendorId && existing.kind === 'CUSTOM') return this.viewOf(existing, s, tx);
          throw unavailable();
        }
        if (existing && existing.kind !== 'CUSTOM') throw unavailable();
        if ((await tx.countNonRemovedCustom(vendorId)) >= s.domainMaxPerVendor) throw new ForbiddenException(domainError('DOMAIN_LIMIT_REACHED', 'You have reached the number of custom domains you can hold at once.'));
        const row = existing
          ? await tx.update(existing.id, { vendorId, status: 'PENDING', removedAt: null, verifiedAt: null, sslStatus: 'NONE', createdByType: actor.type, createdById: actor.id })
          : await tx.create({ vendorId, hostname: host, kind: 'CUSTOM', status: 'PENDING', createdByType: actor.type, createdById: actor.id });
        await tx.upsertVerification(row.id, vendorId, { method: 'TXT', expectedValue: generateTxtValue(this.random), attempts: 0, lastCheckedAt: null, result: 'PENDING' });
        await tx.audit(actor, 'domain.custom.request', row.id, existing ?? null, row);
        return this.viewOf(row, s, tx);
      });
      return view;
    } catch (e) {
      if (e instanceof DuplicateHostError) throw unavailable();
      throw e;
    } finally { this.dir.invalidate(); }
  }

  async verify(vendorId: string | null, id: string, actor: Actor): Promise<VerifyOutcome> {
    const row = await this.load(vendorId, id);
    const s = await this.settings.get();
    if (row.kind !== 'CUSTOM' || row.status === 'REMOVED') throw badState('Only a custom domain that is not removed can be verified.');
    if (row.status === 'ACTIVE') return { result: 'MATCHED', domain: await this.viewOf(row, s) };
    const ver = await this.repo.getVerification(row.id);
    if (!ver) throw badState('This domain has no verification record. Remove it and add it again.');
    const now = this.clock();
    if (ver.lastCheckedAt && now.getTime() - ver.lastCheckedAt.getTime() < s.domainVerifyMinIntervalSeconds * 1000) {
      throw new HttpException(domainError('VERIFY_TOO_SOON', 'Please wait a little before checking again.'), 429);
    }
    const resolver = await this.dns.resolver();
    if (!resolver) {
      const domain = await this.repo.transaction(row.vendorId, async (tx) => {
        const cur = (await tx.findById(row.id))!;
        const next = cur.status === 'PENDING' || cur.status === 'FAILED' ? await tx.update(cur.id, { status: 'VERIFYING' }) : cur;
        await tx.upsertVerification(cur.id, cur.vendorId, { result: 'DISABLED' });
        return this.viewOf(next, s, tx);
      });
      this.dir.invalidate();
      return { result: 'DISABLED', domain };
    }
    const result = await checkTxt(resolver, challengeName(s.verificationTxtPrefix, row.hostname), ver.expectedValue);   // outside any transaction: DNS can be slow
    const allowed = (await this.customState(row.vendorId)).allowed;
    const domain = await this.repo.transaction(row.vendorId, async (tx) => {
      const cur = (await tx.findById(row.id))!;
      if (!['PENDING', 'VERIFYING', 'FAILED'].includes(cur.status)) return this.viewOf(cur, s, tx);
      const attempts = ver.attempts + 1;
      await tx.upsertVerification(cur.id, cur.vendorId, { lastCheckedAt: now, attempts, result });
      if (result === 'MATCHED') { const act = await this.activate(tx, cur, allowed, now); await tx.audit(actor, 'domain.custom.verified', cur.id, cur, act); return this.viewOf(act, s, tx); }
      const next = await tx.update(cur.id, { status: attempts >= s.domainVerifyMaxAttempts ? 'FAILED' : 'VERIFYING' });
      return this.viewOf(next, s, tx);
    });
    this.dir.invalidate();
    return { result, domain };
  }

  /** ACTIVE + verified date; the first ACTIVE custom domain becomes primary while the plan allows custom domains. */
  private async activate(tx: DomainTx, row: DomainRecord, customAllowed: boolean, now: Date): Promise<DomainRecord> {
    const act = await tx.update(row.id, { status: 'ACTIVE', verifiedAt: now });
    const rows = await tx.listForVendor(row.vendorId);
    const hasPrimaryCustom = rows.some((r) => r.kind === 'CUSTOM' && r.status === 'ACTIVE' && r.isPrimary && r.id !== row.id);
    if (customAllowed && !hasPrimaryCustom) await tx.setPrimary(row.vendorId, row.id);
    return (await tx.findById(row.id))!;
  }

  async makePrimary(vendorId: string | null, id: string, actor: Actor): Promise<DomainView> {
    const row = await this.load(vendorId, id);
    if (row.status !== 'ACTIVE') throw badState('Only a domain that is active can be the main address.');
    if (row.kind === 'CUSTOM' && !(await this.customState(row.vendorId)).allowed) throw new ForbiddenException(planError('FEATURE_LOCKED', 'Using your own web address is part of a higher plan.', { feature: 'site.custom_domain', upsellText: (await this.customState(row.vendorId)).upsellText }));
    const s = await this.settings.get();
    const out = await this.repo.transaction(row.vendorId, async (tx) => {
      const before = (await tx.listForVendor(row.vendorId)).find((r) => r.isPrimary) ?? null;
      await tx.setPrimary(row.vendorId, row.id);
      const after = (await tx.findById(row.id))!;
      await tx.audit(actor, 'domain.primary.set', row.id, before, after);
      return this.viewOf(after, s, tx);
    });
    this.dir.invalidate();
    return out;
  }

  async remove(vendorId: string | null, id: string, actor: Actor, reason?: string): Promise<DomainView> {
    const row = await this.load(vendorId, id);
    const s = await this.settings.get();
    if (row.kind === 'SUBDOMAIN') throw badState('Your free address cannot be removed; you can change it instead.');
    if (row.status === 'REMOVED') return this.viewOf(row, s);
    const out = await this.repo.transaction(row.vendorId, async (tx) => {
      const cur = (await tx.findById(row.id))!;
      const next = await tx.update(cur.id, { status: 'REMOVED', removedAt: this.clock() });
      if (cur.isPrimary) { const sub = (await tx.listForVendor(row.vendorId)).find((r) => r.kind === 'SUBDOMAIN' && r.status === 'ACTIVE'); if (sub) await tx.setPrimary(row.vendorId, sub.id); }
      await tx.audit(actor, 'domain.custom.remove', cur.id, cur, { ...next, reason: reason ?? null });
      return this.viewOf(next, s, tx);
    });
    this.dir.invalidate();
    return out;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────── staff
  async forceState(id: string, o: { status?: DomainStatus; sslStatus?: SslStatus; reason: string }, actor: Actor): Promise<DomainView> {
    this.needReason(o.reason);
    const row = await this.load(null, id);
    const s = await this.settings.get();
    if (row.status === 'REMOVED') throw badState('A removed domain cannot be changed; ask the owner to add it again.');
    if (o.status && row.kind === 'SUBDOMAIN') throw badState('The status of a free subdomain is managed by the system.');
    const allowed = (await this.customState(row.vendorId)).allowed;
    const out = await this.repo.transaction(row.vendorId, async (tx) => {
      const cur = (await tx.findById(row.id))!;
      let next = cur; const now = this.clock();
      if (o.sslStatus && o.sslStatus !== cur.sslStatus) next = await tx.update(cur.id, { sslStatus: o.sslStatus });
      if (o.status && o.status !== cur.status) {
        if (o.status === 'ACTIVE') next = await this.activate(tx, next, allowed, now);
        else if (o.status === 'REMOVED') { next = await tx.update(cur.id, { status: 'REMOVED', removedAt: now }); if (cur.isPrimary) { const sub = (await tx.listForVendor(row.vendorId)).find((r) => r.kind === 'SUBDOMAIN' && r.status === 'ACTIVE'); if (sub) await tx.setPrimary(row.vendorId, sub.id); } }
        else next = await tx.update(cur.id, { status: o.status });
      }
      const after = (await tx.findById(next.id))!;
      await tx.audit(actor, 'domain.custom.force_state', cur.id, cur, { ...after, reason: o.reason.trim() });
      return this.viewOf(after, s, tx);
    });
    this.dir.invalidate();
    return out;
  }
}

const SLUG_MESSAGES: Record<string, string> = {
  TOO_SHORT: 'That name is too short.', TOO_LONG: 'That name is too long.', BAD_CHARACTERS: 'Use only lowercase letters, digits and hyphens.',
  BAD_EDGE: 'A name cannot start or end with a hyphen.', CONSECUTIVE_HYPHENS: 'A name cannot contain two hyphens in a row.',
};
