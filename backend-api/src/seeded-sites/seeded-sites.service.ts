import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { SUPER_ONLY } from '../auth/guards/admin-role-matrix';
import { b3Error } from '../b3-settings/b3-errors';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { hashPhone, normalisePhoneE164 } from '../directory/core/otp';
import { OtpPepper } from '../directory/pepper';
import { Actor } from '../plans/admin/audit.service';
import { cleanReason } from '../vendor-lifecycle/core/lifecycle-core';
import { LifecycleStore } from '../vendor-lifecycle/lifecycle.store';
import {
  canIssueClaimLink, canMoveOutreach, csvToRows, deriveLifecycle, DupKeys, findDuplicates, nameKey, OUTREACH_STATUSES, OutreachStatus, seededSiteQuality, SeedInput, SeededLifecycle, validateSeedRow,
} from './core/seeded';
import { ClaimHandover, SeedProvisioner, SeededFacts, SeededPublisher } from './seeded-ports';
import { SeededRow, SeededStore } from './seeded.store';

export type StaffRole = 'SUPER_ADMIN' | 'OPERATIONS' | 'MARKETING';
/** A staff view of one seeded site. The fields depend on the role (MARKETING gets the non-personal ones only). */
export interface SeededView { id: string; lifecycle: SeededLifecycle; outreachStatus: OutreachStatus; [field: string]: unknown }
export interface Who { actor: Actor; role: StaffRole }
type RowStatus = 'OK' | 'REJECTED' | 'DUPLICATE' | 'ON_REGISTER' | 'REMOVED_BEFORE';
export interface BatchLine { line: number; businessName: string; status: RowStatus; errors?: string[]; duplicates?: Array<{ kind: string; with: string; line?: number }>; created?: boolean; vendorId?: string; failure?: string }

const need = (reason: unknown): string => {
  const r = cleanReason(reason);
  if (!r) throw new BadRequestException(b3Error('LIFECYCLE_REASON_REQUIRED', 'A reason of 5 to 300 characters is required.'));
  return r;
};
const notFound = (): NotFoundException => new NotFoundException(b3Error('SEEDED_NOT_FOUND', 'That seeded site does not exist.'));

/**
 * Seeded sites (slice 5.13a): staff create many Free sites from public facts as promotion pages. Every directory listing has a Free site behind it. The rules are pure (core/seeded.ts);
 * this service sequences them with the ports. Nothing is emailed or sent. A removal is honoured at once, permanently, and puts the phone on the register; the register is append-only.
 */
@Injectable()
export class SeededSitesService {
  clock: () => Date = () => new Date();

  constructor(
    private readonly store: SeededStore, private readonly provisioner: SeedProvisioner, private readonly publisher: SeededPublisher, private readonly handover: ClaimHandover,
    private readonly facts: SeededFacts, private readonly lifecycle: LifecycleStore, @Inject(B3SettingsService) private readonly b3: Pick<B3SettingsService, 'get'>, private readonly pepper: OtpPepper,
  ) {}

  // ── keys ──
  private emailHash(email: string): string { return createHmac('sha256', this.pepper.value()).update(`seed-email:${email}`).digest('hex'); }
  private keysOf(i: SeedInput): DupKeys { return { phoneHash: hashPhone(i.phone, this.pepper.value()), emailHash: i.email ? this.emailHash(i.email) : null, nameKey: nameKey(i.businessName, i.city) }; }

  // ── views ──
  /** Staff view. MARKETING gets the non-personal fields only (no phone facts, no outreach notes, no consent detail). */
  private async view(r: SeededRow, role: StaffRole, withLogs = false): Promise<SeededView> {
    const f = await this.facts.factsOf(r.vendorId);
    const lifecycle = deriveLifecycle({ stored: r.lifecycle, businessStatus: f?.businessStatus ?? null, proActive: f?.proActive === true });
    if (lifecycle !== r.lifecycle) await this.store.update(r.id, { lifecycle });   // write-through: the stored value follows the facts (claim, upgrade, removal)
    const base = {
      id: r.id, lifecycle, sourceKind: r.sourceKind, outreachStatus: r.outreachStatus, batchId: r.batchId, createdAt: r.createdAt, removed: lifecycle === 'REMOVED',
      business: f ? { name: f.name, city: f.city, area: f.area } : null,
    };
    if (role === 'MARKETING') return base;
    const logs = withLogs ? await this.store.listLogs(r.id) : undefined;
    return {
      ...base, vendorId: r.vendorId, directoryBusinessId: r.directoryBusinessId, sourceNote: r.sourceNote, publicFactsConfirmed: r.publicFactsConfirmed, outreachOwnerStaffId: r.outreachOwnerStaffId,
      lastContactAt: r.lastContactAt, nextFollowUpAt: r.nextFollowUpAt, ownerAgreedToContact: r.ownerAgreedToContact, ownerAgreedAt: r.ownerAgreedAt, ownerAgreedBy: r.ownerAgreedBy,
      quality: await this.quality(r), ...(logs ? { log: logs } : {}),
    };
  }

  async quality(r: SeededRow): Promise<{ pass: boolean; missing: string[] }> {
    const f = await this.facts.factsOf(r.vendorId);
    return seededSiteQuality({
      businessName: f?.name ?? null, categoryKnown: f?.categoryKnown === true, city: f?.city ?? null, area: f?.area ?? null, phoneE164: f?.phoneE164 ?? null, sourceKind: r.sourceKind,
      publicFactsConfirmed: r.publicFactsConfirmed, onRegister: await this.store.onRegister(r.phoneHash), lifecycle: r.lifecycle,
    });
  }

  // ── create ──
  /**
   * Creates one seeded site. Refuses: missing public fields or the staff checkbox (400), a phone on the register or a business that was removed before (409, unless a SUPER_ADMIN gives an
   * override reason), a duplicate of an existing site (409, never overridable). The site is published listing-only; whether it is indexable is decided by the quality rule and the setting.
   */
  async create(raw: Record<string, unknown>, who: Who, o: { batchId?: string | null; overrideReason?: string } = {}) {
    const v = validateSeedRow(raw, { categoryExists: (id) => this.facts.categoryExists(id) });
    if (!v.ok) throw new BadRequestException(b3Error('SEEDED_INVALID', 'Some public facts are missing or not valid.', { errors: v.errors }));
    const input = v.input; const keys = this.keysOf(input);
    const override = this.checkOverride(who, o.overrideReason);
    const dup = (await this.duplicatesOf([{ ...keys, line: 0 }])).get(0);
    if (dup?.length) throw new ConflictException(b3Error('SEEDED_DUPLICATE', 'A site for this business already exists.', { duplicates: dup }));
    if (!override) {
      if (await this.store.onRegister(keys.phoneHash)) throw new ConflictException(b3Error('SEEDED_DNC', 'This business asked not to be contacted or listed, so no site can be made.'));
    }
    const created = await this.createOne(input, keys, who, o.batchId ?? null);
    if (override) await this.store.recordAudit(who.actor, 'seeded.override_create', 'seeded_site', created.id, null, { reason: override });
    return this.view(created, who.role, true);
  }

  private checkOverride(who: Who, reasonIn?: string): string | null {
    if (reasonIn === undefined || reasonIn === null || reasonIn === '') return null;
    if (!SUPER_ONLY.includes(who.role)) throw new ForbiddenException(b3Error('SEEDED_OVERRIDE_FORBIDDEN', 'Only a SUPER_ADMIN can override a removal.'));
    return need(reasonIn);
  }

  private async duplicatesOf(c: Array<DupKeys & { line: number }>): Promise<Map<number, ReturnType<typeof findDuplicates> extends Map<number, infer V> ? V : never>> {
    const existing = await this.store.findKeyMatches({ phoneHashes: c.map((x) => x.phoneHash), emailHashes: c.flatMap((x) => (x.emailHash ? [x.emailHash] : [])), nameKeys: c.map((x) => x.nameKey) });
    return findDuplicates(c, existing);
  }

  private async createOne(input: SeedInput, keys: DupKeys, who: Who, batchId: string | null): Promise<SeededRow> {
    const placeholderEmail = `site+seed-${keys.phoneHash.slice(0, 24)}@sites.get4domain.invalid`;
    const { vendorId, directoryBusinessId } = await this.provisioner.provision({ input, placeholderEmail, idempotencyKey: `seeded:${keys.phoneHash.slice(0, 40)}`, actor: who.actor });
    const existing = await this.store.getByVendor(vendorId);
    const row = existing ?? await this.store.create({
      vendorId, directoryBusinessId, lifecycle: 'SEEDED', sourceKind: input.sourceKind, sourceNote: input.sourceNote || null, publicFactsConfirmed: true, phoneHash: keys.phoneHash, emailHash: keys.emailHash,
      nameKey: keys.nameKey, outreachStatus: 'NOT_CONTACTED', outreachOwnerStaffId: null, lastContactAt: null, nextFollowUpAt: null, ownerAgreedToContact: false, ownerAgreedAt: null, ownerAgreedBy: null,
      createdByStaffId: who.actor.id, batchId,
    });
    await this.publisher.publish(vendorId, who.actor);   // after the seeded row exists: the build reads the lifecycle to decide indexing
    await this.store.recordAudit(who.actor, 'seeded.create', 'seeded_site', row.id, null, { vendorId, batchId, sourceKind: input.sourceKind });
    return row;
  }

  // ── batches ──
  /** DRY RUN: validation and duplicates report; no site is created. APPLY: creates the rows that passed (a failure on one row is recorded and the batch goes on). */
  async batch(csv: string, fileName: string, mode: 'DRY_RUN' | 'APPLIED', who: Who, overrideReason?: string) {
    const s = await this.b3.get();
    const parsed = csvToRows(csv, s.seededBatchMaxRows);
    if (parsed.error) throw new BadRequestException(b3Error('SEEDED_INVALID', parsed.error));
    const override = this.checkOverride(who, overrideReason);
    const lines: BatchLine[] = []; const ok: Array<{ line: number; input: SeedInput; keys: DupKeys }> = [];
    for (const r of parsed.rows) {
      const v = validateSeedRow(r.cells, { categoryExists: (id) => this.facts.categoryExists(id) });
      if (!v.ok) { lines.push({ line: r.line, businessName: r.cells.businessName ?? '', status: 'REJECTED', errors: v.errors }); continue; }
      ok.push({ line: r.line, input: v.input, keys: this.keysOf(v.input) });
    }
    const dups = await this.duplicatesOf(ok.map((x) => ({ ...x.keys, line: x.line })));
    const onRegister = await this.store.registerHashesAmong(ok.map((x) => x.keys.phoneHash));
    const toCreate: typeof ok = [];
    for (const x of ok) {
      const d = dups.get(x.line);
      if (d?.length) { lines.push({ line: x.line, businessName: x.input.businessName, status: 'DUPLICATE', duplicates: d }); continue; }
      if (onRegister.has(x.keys.phoneHash) && !override) { lines.push({ line: x.line, businessName: x.input.businessName, status: 'ON_REGISTER', errors: ['The phone is on the do-not-contact register: no site is made.'] }); continue; }
      lines.push({ line: x.line, businessName: x.input.businessName, status: 'OK' }); toCreate.push(x);
    }
    const batch = await this.store.createBatch({ createdBy: who.actor.id, fileName: String(fileName ?? 'batch.csv').slice(0, 200), rowsTotal: parsed.rows.length, rowsCreated: 0, rowsRejected: 0, mode, reportJson: {} });
    if (mode === 'APPLIED') {
      for (const x of toCreate) {
        const entry = lines.find((l) => l.line === x.line)!;
        try {
          const row = await this.createOne(x.input, x.keys, who, batch.id);
          entry.created = true; entry.vendorId = row.vendorId;
        } catch (e) {
          entry.created = false; entry.failure = (e as { response?: { code?: string } })?.response?.code ?? 'UNEXPECTED';
        }
      }
      if (override) await this.store.recordAudit(who.actor, 'seeded.override_batch', 'seeded_batch', batch.id, null, { reason: override });
    }
    lines.sort((a, b) => a.line - b.line);
    const created = lines.filter((l) => l.created === true).length;
    const rejected = lines.filter((l) => l.status !== 'OK' || l.created === false).length;
    const counts = { total: parsed.rows.length, ok: lines.filter((l) => l.status === 'OK').length, rejected: lines.filter((l) => l.status === 'REJECTED').length, duplicates: lines.filter((l) => l.status === 'DUPLICATE').length, onRegister: lines.filter((l) => l.status === 'ON_REGISTER').length, created };
    await this.store.updateBatch(batch.id, { rowsCreated: created, rowsRejected: rejected, reportJson: { counts, lines } });
    await this.store.recordAudit(who.actor, mode === 'APPLIED' ? 'seeded.batch.apply' : 'seeded.batch.dry_run', 'seeded_batch', batch.id, null, counts);
    return { batchId: batch.id, mode, counts, lines };
  }

  // ── reads and outreach ──
  async list(f: { lifecycle?: SeededLifecycle; outreachStatus?: OutreachStatus; batchId?: string; q?: string; skip: number; take: number }, role: StaffRole) {
    const { items, total } = await this.store.list(f);
    return { items: await Promise.all(items.map((r) => this.view(r, role))), total };
  }
  async get(id: string, role: StaffRole) { const r = await this.store.get(id); if (!r) throw notFound(); return this.view(r, role, role !== 'MARKETING'); }

  async updateOutreach(id: string, p: { status?: OutreachStatus; ownerStaffId?: string | null; nextFollowUpAt?: string | null; note?: string }, who: Who) {
    const r = await this.mustGet(id);
    if (r.lifecycle === 'REMOVED') throw new ConflictException(b3Error('SEEDED_REMOVED', 'This site was removed.'));
    if (p.status !== undefined) {
      if (!OUTREACH_STATUSES.includes(p.status)) throw new BadRequestException(b3Error('SEEDED_INVALID', 'Unknown outreach status.'));
      if (!canMoveOutreach(r.outreachStatus, p.status)) throw new ConflictException(b3Error('SEEDED_DNC', 'A business marked do-not-contact stays that way.'));
    }
    if (p.status === 'DO_NOT_CONTACT') return this.remove(id, 'The business asked not to be contacted.', who);   // do-not-contact removes the site and joins the register
    const next = p.nextFollowUpAt === undefined ? undefined : p.nextFollowUpAt === null ? null : new Date(p.nextFollowUpAt);
    if (next instanceof Date && Number.isNaN(next.getTime())) throw new BadRequestException(b3Error('SEEDED_INVALID', 'The follow-up date is not valid.'));
    const row = await this.store.update(id, { ...(p.status ? { outreachStatus: p.status } : {}), ...(p.ownerStaffId !== undefined ? { outreachOwnerStaffId: p.ownerStaffId } : {}), ...(next !== undefined ? { nextFollowUpAt: next } : {}) });
    if (p.note) await this.store.addLog({ seededSiteId: id, kind: 'NOTE', staffId: who.actor.id, outcome: null, note: p.note.slice(0, 500) }, this.clock());
    await this.store.recordAudit(who.actor, 'seeded.outreach.update', 'seeded_site', id, { outreachStatus: r.outreachStatus }, { outreachStatus: row.outreachStatus });
    return this.view(row, who.role, true);
  }

  async logCall(id: string, p: { outcome: string; note?: string; nextFollowUpAt?: string | null }, who: Who) {
    const r = await this.mustGet(id);
    if (r.lifecycle === 'REMOVED') throw new ConflictException(b3Error('SEEDED_REMOVED', 'This site was removed.'));
    const at = this.clock();
    await this.store.addLog({ seededSiteId: id, kind: 'CALL', staffId: who.actor.id, outcome: String(p.outcome ?? '').slice(0, 80), note: p.note ? p.note.slice(0, 500) : null }, at);
    const next = p.nextFollowUpAt ? new Date(p.nextFollowUpAt) : p.nextFollowUpAt === null ? null : undefined;
    const row = await this.store.update(id, { lastContactAt: at, ...(r.outreachStatus === 'NOT_CONTACTED' ? { outreachStatus: 'CALLED' as const } : {}), ...(next !== undefined && !(next instanceof Date && Number.isNaN(next.getTime())) ? { nextFollowUpAt: next } : {}) });
    return this.view(row, who.role, true);
  }

  /** The consent flag: the owner agreed to be contacted (recorded with who and when). Needed before a claim link. Withdrawing it is recorded too. */
  async setConsent(id: string, agreed: boolean, who: Who) {
    const r = await this.mustGet(id);
    if (r.lifecycle === 'REMOVED') throw new ConflictException(b3Error('SEEDED_REMOVED', 'This site was removed.'));
    const row = await this.store.update(id, { ownerAgreedToContact: agreed, ownerAgreedAt: agreed ? this.clock() : null, ownerAgreedBy: agreed ? who.actor.id : null });
    await this.store.recordAudit(who.actor, agreed ? 'seeded.consent.recorded' : 'seeded.consent.withdrawn', 'seeded_site', id, { ownerAgreedToContact: r.ownerAgreedToContact }, { ownerAgreedToContact: agreed });
    return this.view(row, who.role, true);
  }

  // ── claim links ──
  async issueClaimLink(id: string, who: Who) {
    const r = await this.mustGet(id);
    const f = await this.facts.factsOf(r.vendorId);
    const lifecycle = deriveLifecycle({ stored: r.lifecycle, businessStatus: f?.businessStatus ?? null, proActive: f?.proActive === true });
    const can = canIssueClaimLink({ ownerAgreedToContact: r.ownerAgreedToContact, phoneOnRegister: await this.store.onRegister(r.phoneHash), lifecycle, outreachStatus: r.outreachStatus });
    if (!can.ok) throw new ConflictException(b3Error(can.reason === 'CONSENT_REQUIRED' ? 'SEEDED_CONSENT_REQUIRED' : can.reason === 'REMOVED' ? 'SEEDED_REMOVED' : 'SEEDED_DNC', `A claim link cannot be issued (${can.reason}).`, { reason: can.reason }));
    const link = await this.handover.issue(r.vendorId, who.actor);
    await this.store.update(id, { lifecycle: 'INVITED', outreachStatus: 'CLAIM_LINK_SENT', lastContactAt: this.clock() });
    await this.store.addLog({ seededSiteId: id, kind: 'CLAIM_LINK', staffId: who.actor.id, outcome: 'ISSUED', note: null }, this.clock());
    await this.store.recordAudit(who.actor, 'seeded.claim_link.issue', 'seeded_site', id, null, { expiresAt: link.expiresAt });
    return { claimUrl: link.claimUrl, expiresAt: link.expiresAt, note: 'Shown once. Give it to the owner yourself; nothing was emailed or sent.' };
  }

  async revokeClaimLink(id: string, who: Who) {
    const r = await this.mustGet(id);
    const revoked = await this.handover.revoke(r.vendorId, who.actor);
    if (r.lifecycle === 'INVITED') await this.store.update(id, { lifecycle: 'SEEDED' });
    await this.store.addLog({ seededSiteId: id, kind: 'CLAIM_LINK', staffId: who.actor.id, outcome: 'REVOKED', note: null }, this.clock());
    return { revoked };
  }

  // ── removal ──
  /**
   * Removal (a request from the owner, or "do not contact"): hidden at once (the by-host read becomes the uniform 404, the directory profile REMOVED and noindex), the audit row is kept, and
   * the phone joins the register. Permanent. Idempotent.
   */
  async remove(id: string, reasonIn: unknown, who: Who) {
    const reason = need(reasonIn);
    const r = await this.mustGet(id);
    if (r.lifecycle !== 'REMOVED') {
      await this.lifecycle.executeRemoval({
        vendorId: r.vendorId, kind: 'SEEDED_REMOVAL', reason, phoneHash: r.phoneHash, requestedBy: null, executedBy: who.actor.id,
        audit: { actor: who.actor, action: 'seeded.remove', entityType: 'seeded_site', entityId: id, before: { lifecycle: r.lifecycle }, after: { lifecycle: 'REMOVED', reason } },
      });
      await this.store.addToRegister(r.phoneHash, reason, 'DO_NOT_CONTACT', who.actor.id);
      await this.store.update(id, { lifecycle: 'REMOVED', removedAt: this.clock(), outreachStatus: 'DO_NOT_CONTACT' });
      await this.store.addLog({ seededSiteId: id, kind: 'REMOVAL', staffId: who.actor.id, outcome: 'REMOVED', note: reason }, this.clock());
    }
    return this.view((await this.store.get(id))!, who.role, true);
  }

  // ── the register ──
  async readRegister(skip: number, take: number) {
    const { items, total } = await this.store.listRegister(skip, take);
    return { items: items.map((i) => ({ id: i.id, phoneHash: i.phoneHash.slice(0, 12), source: i.source, addedAt: i.addedAt })), total };   // a hash prefix only: the number is never recoverable
  }
  async addToRegister(phone: string, reasonIn: unknown, who: Who) {
    const reason = need(reasonIn);
    const e164 = normalisePhoneE164(phone);
    if (!e164) throw new BadRequestException(b3Error('SEEDED_INVALID', 'That is not a valid phone number.'));
    const hash = hashPhone(e164, this.pepper.value());
    const added = await this.store.addToRegister(hash, reason, 'STAFF', who.actor.id);
    await this.store.recordAudit(who.actor, 'seeded.register.add', 'dnc_register', null, null, { added, phoneHashPrefix: hash.slice(0, 8) });
    return { added };
  }

  private async mustGet(id: string): Promise<SeededRow> { const r = await this.store.get(id); if (!r) throw notFound(); return r; }
}
