import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { normalisePhone } from '../provisioning/steps/business-input';
import { cleanReason } from '../vendor-lifecycle/core/lifecycle-core';
import {
  classify, DuplicateInput, DuplicatePath, hostOf, Match, matchesFromCandidates, normaliseGstin, normalisePincode, Outcome, phoneKeyOf, similarSubdomain, strengthOf,
} from './core/duplicate-core';
import { claimRoute, DUPLICATE_BLOCKED_MESSAGE, DUPLICATE_POSSIBLE_MESSAGE, duplicateError } from './duplicate.errors';
import { DuplicateHoldPort, DuplicateStore, Hit, PublicListing } from './duplicate.store';

/** Staff who may override a duplicate refusal (with a written reason). Every other role, and every self-service path, cannot. */
export const OVERRIDE_ROLES: readonly string[] = ['SUPER_ADMIN', 'ADMIN'];

export interface Actor { id: string; role: string }
export interface CheckOptions {
  /** a STAFF path attaches to an unowned listing instead of stopping on it (the directory step does the attaching) */
  listingsAreAttachable?: boolean;
}
export interface CheckResult {
  outcome: Outcome;
  matches: Match[];
  /** the matches that decided the outcome */
  deciding: Match[];
  /** public facts of the matched listings, for "Is this your business?" and the claim route */
  listings: PublicListing[];
  /** an existing subdomain the requested one looks like: a warning only */
  subdomainWarning: string | null;
}
export interface EnforceContext {
  path: DuplicatePath;
  /** set on a staff path: the actor may override with a reason */
  actor?: Actor | null;
  overrideReason?: string | null;
  /** SELF-SERVICE only: the person says this is a different business than the one shown. It is created, but held for admin review and not published. */
  confirmDistinct?: boolean;
  /** true for every path a visitor can reach without signing in as staff: asked "Is this your business?" instead of stopped */
  selfService?: boolean;
  listingsAreAttachable?: boolean;
}
export interface Decision {
  outcome: Outcome;
  /** the new business must be held for admin review (written by `record` once it has an id) */
  hold: boolean;
  matches: Match[];
  override: { reason: string; staff: Actor } | null;
  subdomainWarning: string | null;
  path: DuplicatePath;
}

/**
 * ONE duplicate check for every way a vendor is made (docs/v3/DUPLICATE_CHECK_FINDINGS.md). Strong signals block, a medium match asks or goes to review, supporting signals only help the medium rule.
 * A refusal never names the other business's private details: it says a business with these details exists and shows the claim route when its listing is unclaimed.
 */
@Injectable()
export class DuplicateCheckService extends DuplicateHoldPort {
  private readonly logger = new Logger(DuplicateCheckService.name);
  clock: () => Date = () => new Date();

  constructor(private readonly store: DuplicateStore) { super(); }

  /** Finds every match and classifies it. Never throws for a duplicate: `enforce` decides what a path does with the answer. */
  async check(input: DuplicateInput, o: CheckOptions = {}): Promise<CheckResult> {
    const ex = input.excludeVendorId ?? null;
    const matches: Match[] = [];
    const add = (signal: Match['signal'], h: { vendorId: string | null; businessId: string | null; attachable: boolean }): void => {
      matches.push({ signal, strength: strengthOf(signal), vendorId: h.vendorId, businessId: h.businessId, attachable: h.attachable });
    };

    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (email) for (const id of await this.store.vendorsByEmail(email, ex)) add('EMAIL', { vendorId: id, businessId: null, attachable: false });

    const key = phoneKeyOf(input.phone);
    if (key) {
      const e164 = typeof input.phone === 'string' ? normalisePhone(input.phone) : null;
      for (const h of await this.store.byPhone(key, e164, ex)) add('PHONE', h);
    }

    const gstin = normaliseGstin(input.gstin);
    if (gstin) for (const id of await this.store.vendorsByGstin(gstin, ex)) add('GSTIN', { vendorId: id, businessId: null, attachable: false });

    const host = hostOf(input.customDomain);
    if (host) for (const h of await this.store.byHosts([host], ex)) add(h.via, { vendorId: h.vendorId, businessId: null, attachable: false });

    // the medium rule needs a place (pincode or area) and a category: without them there is nothing honest to compare, so it stays quiet
    const pincode = normalisePincode(input.pincode ?? undefined);
    const area = typeof input.area === 'string' && input.area.trim() ? input.area.trim() : null;
    if (input.businessName?.trim() && (pincode || area) && input.category) {
      matches.push(...matchesFromCandidates(await this.store.nameCandidates({
        name: input.businessName.trim(), pincode, area, category: input.category, ownerName: input.ownerName ?? null, address: input.address ?? null, excludeVendorId: ex,
      })));
    }

    const c = classify(matches, { listingsAreAttachable: o.listingsAreAttachable === true });
    const listings = c.deciding.length ? await this.store.publicListings(c.deciding.flatMap((m) => (m.businessId ? [m.businessId] : [])), c.deciding.flatMap((m) => (m.vendorId ? [m.vendorId] : []))) : [];
    return { outcome: c.outcome, matches, deciding: c.deciding, listings, subdomainWarning: await this.subdomainWarning(input.subdomain) };
  }

  /** A subdomain that looks like an existing one (look-alike letters or one letter apart). A warning, never a block. */
  async subdomainWarning(subdomain: string | null | undefined): Promise<string | null> {
    if (typeof subdomain !== 'string' || subdomain.trim() === '') return null;
    const slug = subdomain.trim().toLowerCase();
    try { return similarSubdomain(slug, await this.store.subdomainsNear(slug)); } catch (e) { this.logger.warn(`similar-subdomain lookup failed: ${e instanceof Error ? e.message : 'error'}`); return null; }
  }

  /**
   * What a creation path does with the check. Returns a Decision to go ahead (the caller creates the vendor, then calls `record`), or throws:
   *   409 DUPLICATE_BUSINESS  a strong match (no override)            403 DUPLICATE_OVERRIDE_FORBIDDEN  an override from a role that may not
   *   409 DUPLICATE_POSSIBLE  a medium match a visitor can answer, or a staff path with no override    400 DUPLICATE_OVERRIDE_REASON_REQUIRED
   */
  async enforce(input: DuplicateInput, ctx: EnforceContext): Promise<Decision> {
    const override = this.checkOverride(ctx);
    const r = await this.check(input, { listingsAreAttachable: ctx.listingsAreAttachable });
    const base = { matches: r.matches, subdomainWarning: r.subdomainWarning, path: ctx.path };
    if (r.subdomainWarning) this.logger.warn(`duplicate check (${ctx.path}): subdomain "${input.subdomain}" looks like "${r.subdomainWarning}"`);
    if (r.outcome === 'CLEAR') return { outcome: 'CLEAR', hold: false, override: null, ...base };
    if (override) return { outcome: r.outcome, hold: false, override, ...base };

    const staffView = ctx.selfService === true ? {} : { matches: r.deciding.map((m) => ({ signal: m.signal, vendorId: m.vendorId, businessId: m.businessId })) };
    if (r.outcome === 'BLOCKED') {
      throw new ConflictException(duplicateError('DUPLICATE_BUSINESS', DUPLICATE_BLOCKED_MESSAGE, { claim: claimRoute(r.listings.find((l) => l.claimable)), ...staffView }));
    }
    // POSSIBLE. A visitor is asked, once, with PUBLIC listing facts only. If they say it is another business, or there is no public listing to show, it goes to admin review, unpublished.
    if (ctx.selfService) {
      const facts = r.listings.map(({ slug, name, category, city, area, claimable }) => ({ slug, name, category, city, area, claimable }));
      if (facts.length > 0 && ctx.confirmDistinct !== true) {
        throw new ConflictException(duplicateError('DUPLICATE_POSSIBLE', DUPLICATE_POSSIBLE_MESSAGE, { candidates: facts, claim: claimRoute(r.listings.find((l) => l.claimable)) }));
      }
      return { outcome: 'POSSIBLE', hold: true, override: null, ...base };
    }
    throw new ConflictException(duplicateError('DUPLICATE_POSSIBLE', DUPLICATE_POSSIBLE_MESSAGE, { candidates: r.listings, claim: claimRoute(r.listings.find((l) => l.claimable)), ...staffView }));
  }

  private checkOverride(ctx: EnforceContext): { reason: string; staff: Actor } | null {
    const given = ctx.overrideReason;
    if (given === undefined || given === null || given === '') return null;
    if (ctx.selfService || !ctx.actor || !OVERRIDE_ROLES.includes(ctx.actor.role)) throw new ForbiddenException(duplicateError('DUPLICATE_OVERRIDE_FORBIDDEN', 'Only an ADMIN or SUPER_ADMIN can override a duplicate refusal.'));
    const reason = cleanReason(given);
    if (!reason) throw new BadRequestException(duplicateError('DUPLICATE_OVERRIDE_REASON_REQUIRED', 'A written reason of 5 to 300 characters is required to override a duplicate refusal.'));
    return { reason, staff: ctx.actor };
  }

  /**
   * The review row that holds a possible duplicate. The caller writes it IN THE SAME TRANSACTION as the vendor (`tx.v3DuplicateReview.create({ data })`), so a business can never exist unheld
   * with its review lost. Null when the decision holds nothing.
   */
  reviewData(d: Decision, vendorId: string): { path: string; vendorId: string; matchedVendorId: string | null; matchedBusinessId: string | null; matchedSignals: string[]; score: number | null } | null {
    if (!d.hold) return null;
    const m = d.matches.filter((x) => x.strength !== 'SUPPORTING');
    const first = m[0];
    return { path: d.path, vendorId, matchedVendorId: first?.vendorId ?? null, matchedBusinessId: first?.businessId ?? null, matchedSignals: [...new Set(m.map((x) => x.signal))], score: first?.score ?? null };
  }

  /** After the vendor exists: writes the override log (who, why, which record, when). A failed log is reported loudly but never hides a vendor that now exists. */
  async record(d: Decision, vendorId: string): Promise<void> {
    if (!d.override) return;
    try {
      await this.store.recordOverride({ path: d.path, staffId: d.override.staff.id, staffRole: d.override.staff.role, reason: d.override.reason, outcome: d.outcome === 'BLOCKED' ? 'BLOCKED' : 'POSSIBLE', matches: d.matches.filter((m) => m.strength !== 'SUPPORTING'), newVendorId: vendorId });
    } catch (e) {
      this.logger.error(`duplicate check: could not record the override for vendor ${vendorId}: ${e instanceof Error ? e.message : 'error'}`);
    }
  }

  /** For an unowned UNCLAIMED listing of the same business: its id, so the directory step attaches the new vendor to it instead of making a second listing. */
  async findAttachableListing(input: DuplicateInput): Promise<string | null> {
    const r = await this.check(input, { listingsAreAttachable: false });
    const hit = r.matches.find((m) => m.attachable && m.businessId && m.strength !== 'SUPPORTING');
    return hit?.businessId ?? null;
  }

  // ── the publish hold and the admin review queue ───────────────────────────────────────────────────────────────

  isHeld(vendorId: string): Promise<boolean> { return this.store.isHeld(vendorId); }

  async listReviews(q: { status?: string; skip: number; take: number }) { return this.store.listReviews(q.status ?? null, q.skip, q.take); }

  /** ADMIN or SUPER_ADMIN clears (the business is let through) or rejects (it stays unpublished) a held possible duplicate, with a written reason. */
  async decide(id: string, decision: 'CLEARED' | 'REJECTED', reasonIn: unknown, actor: Actor): Promise<{ id: string; status: string }> {
    if (!OVERRIDE_ROLES.includes(actor.role)) throw new ForbiddenException(duplicateError('DUPLICATE_OVERRIDE_FORBIDDEN', 'Only an ADMIN or SUPER_ADMIN can decide a duplicate review.'));
    const reason = cleanReason(reasonIn);
    if (!reason) throw new BadRequestException(duplicateError('DUPLICATE_OVERRIDE_REASON_REQUIRED', 'A written reason of 5 to 300 characters is required.'));
    const row = await this.store.getReview(id);
    if (!row) throw new NotFoundException(duplicateError('DUPLICATE_REVIEW_NOT_FOUND', 'That review does not exist.'));
    if (row.status !== 'PENDING') throw new ConflictException(duplicateError('DUPLICATE_REVIEW_DECIDED', 'That review has already been decided.'));
    if (!(await this.store.decideReview(id, { status: decision, staffId: actor.id, reason, now: this.clock() }))) throw new ConflictException(duplicateError('DUPLICATE_REVIEW_DECIDED', 'That review has already been decided.'));
    return { id, status: decision };
  }
}

export type { Hit };
