import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { evaluateBusinessIndexing } from './core/indexing';
import { maskEmail } from './core/masking';
import { hashPhone, normalisePhoneE164 } from './core/otp';
import { businessSlug, slugify, uniqueSlug } from './core/slug';
import { DirectoryAudit } from './directory-audit';
import { directoryError } from './directory.errors';
import { Address, BusinessRow, CategoryRow, DirectoryRepository, LocationKind, LocationRow, StaffBusinessQuery } from './directory.repository';
import { locationPath, staffBusinessView, ViewContext } from './directory-views';
import { DirectoryReadService } from './directory-read.service';
import { DirectorySettingsService } from './settings/directory-settings.service';
import { OtpPepper } from './pepper';

export interface BusinessInput {
  name: string; categoryId: string; locationId?: string | null; phone?: string | null; email?: string | null; address?: Address; hours?: Record<string, unknown>;
  geo?: { lat: number; lng: number } | null; description?: string; status?: 'DRAFT' | 'UNCLAIMED'; services?: Array<{ name: string; description?: string }>; media?: Array<{ url: string; altText?: string }>;
}
/** True only for a unique-rule failure about the SLUG (Prisma P2002 on slug, or the in-memory twin's message); a clash on the vendor link is a different bug and must not be retried. */
export function isSlugClash(e: unknown): boolean {
  const x = e as { code?: string; message?: string; meta?: { target?: unknown } } | null;
  if (x?.code === 'P2002') { const t = x.meta?.target; return Array.isArray(t) ? t.includes('slug') : typeof t === 'string' && t.includes('slug'); }
  return /duplicate slug/.test(String(x?.message ?? ''));
}
const bad = (m: string): BadRequestException => new BadRequestException(directoryError('DIRECTORY_INVALID', m));
const notFound = (): NotFoundException => new NotFoundException(directoryError('DIRECTORY_NOT_FOUND', 'That directory entry does not exist.'));
const need = (reason: unknown): string => { if (typeof reason !== 'string' || reason.trim().length < 3) throw bad('A reason of at least 3 characters is required.'); return reason.trim(); };

/** Staff side of the directory: the tree, businesses, moderation, sponsored placements and the claim-phone override. Every write is audited (ids and masked values only). */
@Injectable()
export class DirectoryAdminService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly repo: DirectoryRepository, private readonly audit: DirectoryAudit, @Inject(DirectorySettingsService) private readonly settings: Pick<DirectorySettingsService, 'get'>,
    @Inject(DirectoryReadService) private readonly read: Pick<DirectoryReadService, 'invalidate'>, private readonly pepper: OtpPepper,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────────────── tree
  async listLocations(): Promise<LocationRow[]> { return this.repo.listLocations(); }
  async listCategories(): Promise<CategoryRow[]> { return this.repo.listCategories(); }

  async createLocation(d: { parentId?: string | null; kind: LocationKind; name: string; slug?: string; sortOrder?: number }, actor: Actor): Promise<LocationRow> {
    const parent = d.parentId ? await this.repo.getLocation(d.parentId) : null;
    if (d.parentId && !parent) throw bad('The parent place does not exist.');
    const want: Record<LocationKind, LocationKind | null> = { STATE: null, DISTRICT: 'STATE', CITY: 'DISTRICT' };
    if ((parent?.kind ?? null) !== want[d.kind]) throw bad(`A ${d.kind.toLowerCase()} must sit under ${want[d.kind] ? `a ${want[d.kind]!.toLowerCase()}` : 'nothing (it is a top-level place)'}.`);
    const name = String(d.name ?? '').trim(); if (!name || name.length > 120) throw bad('The name must be 1 to 120 characters.');
    const slug = slugify(d.slug || name);
    try {
      const row = await this.repo.createLocation({ parentId: parent?.id ?? null, kind: d.kind, name, slug, sortOrder: d.sortOrder ?? 0 });
      await this.audit.record(actor, 'directory.location.create', 'directory_location', row.id, null, row); this.read.invalidate(); return row;
    } catch (e) { throw this.slugClash(e); }
  }
  async updateLocation(id: string, p: { name?: string; slug?: string; sortOrder?: number; active?: boolean }, actor: Actor): Promise<LocationRow> {
    const before = await this.repo.getLocation(id); if (!before) throw notFound();
    const patch = { ...(p.name !== undefined ? { name: this.cleanName(p.name), proposed: false } : {}), ...(p.slug !== undefined ? { slug: slugify(p.slug) } : {}), ...(p.sortOrder !== undefined ? { sortOrder: p.sortOrder } : {}), ...(p.active !== undefined ? { active: p.active } : {}) };
    try { const row = await this.repo.updateLocation(id, patch); await this.audit.record(actor, 'directory.location.update', 'directory_location', id, before, row); this.read.invalidate(); return row; } catch (e) { throw this.slugClash(e); }
  }
  async createCategory(d: { parentId?: string | null; name: string; slug?: string; themeCategoryId?: string | null; sortOrder?: number }, actor: Actor): Promise<CategoryRow> {
    const parent = d.parentId ? await this.repo.getCategory(d.parentId) : null;
    if (d.parentId && !parent) throw bad('The parent category does not exist.');
    if (parent?.parentId) throw bad('Categories are two levels: a family and its categories.');
    const name = this.cleanName(d.name);
    try {
      const row = await this.repo.createCategory({ parentId: parent?.id ?? null, name, slug: slugify(d.slug || name), themeCategoryId: d.themeCategoryId ?? null, family: parent?.family ?? null, sortOrder: d.sortOrder ?? 0 });
      await this.audit.record(actor, 'directory.category.create', 'directory_category', row.id, null, row); this.read.invalidate(); return row;
    } catch (e) { throw this.slugClash(e); }
  }
  async updateCategory(id: string, p: { name?: string; slug?: string; sortOrder?: number; active?: boolean; themeCategoryId?: string | null }, actor: Actor): Promise<CategoryRow> {
    const before = await this.repo.getCategory(id); if (!before) throw notFound();
    const patch = { ...(p.name !== undefined ? { name: this.cleanName(p.name), proposed: false } : {}), ...(p.slug !== undefined ? { slug: slugify(p.slug) } : {}), ...(p.sortOrder !== undefined ? { sortOrder: p.sortOrder } : {}), ...(p.active !== undefined ? { active: p.active } : {}), ...(p.themeCategoryId !== undefined ? { themeCategoryId: p.themeCategoryId } : {}) };
    try { const row = await this.repo.updateCategory(id, patch); await this.audit.record(actor, 'directory.category.update', 'directory_category', id, before, row); this.read.invalidate(); return row; } catch (e) { throw this.slugClash(e); }
  }
  private cleanName(n: unknown): string { const s = String(n ?? '').trim(); if (!s || s.length > 120) throw bad('The name must be 1 to 120 characters.'); return s; }
  private slugClash(e: unknown): unknown { return e instanceof Error && /duplicate|unique/i.test(e.message) ? new ConflictException(directoryError('DIRECTORY_SLUG_TAKEN', 'That short name is already used at this level.')) : e; }

  // ───────────────────────────────────────────────────────────────────────────────────── businesses
  private async context(b: BusinessRow): Promise<ViewContext> {
    const [locs, cats, services, media] = await Promise.all([this.repo.listLocations(), this.repo.listCategories(), this.repo.getServices(b.id), this.repo.getMedia(b.id)]);
    const cat = cats.find((c) => c.id === b.categoryId) ?? null;
    return { category: cat ? { slug: cat.slug, name: cat.name } : null, location: locationPath(locs, b.locationId), services, media };
  }

  async indexableFor(b: Pick<BusinessRow, 'status' | 'name' | 'categoryId' | 'locationId' | 'phoneE164' | 'address' | 'descriptionText'>): Promise<boolean> {
    const s = await this.settings.get();
    return evaluateBusinessIndexing({ status: b.status, name: b.name, categoryId: b.categoryId, locationId: b.locationId, phoneE164: b.phoneE164, addressLine: b.address?.line1 ?? '', descriptionText: b.descriptionText }, { indexUnclaimed: s.directoryIndexUnclaimed, minDescriptionChars: s.directoryMinDescriptionChars }).indexable;
  }

  async listBusinesses(q: StaffBusinessQuery, redact: boolean) {
    const { items, total } = await this.repo.listForStaff(q);
    return { items: await Promise.all(items.map(async (b) => staffBusinessView(b, await this.context(b), redact))), total };
  }
  async getBusiness(id: string, redact: boolean) { const b = await this.repo.getBusiness(id); if (!b) throw notFound(); return staffBusinessView(b, await this.context(b), redact); }

  async createBusiness(i: BusinessInput, actor: Actor) {
    const cat = await this.repo.getCategory(i.categoryId); if (!cat || !cat.active) throw bad('That category does not exist.');
    const loc = i.locationId ? await this.repo.getLocation(i.locationId) : null; if (i.locationId && !loc) throw bad('That place does not exist.');
    const name = this.cleanName(i.name);
    const phone = i.phone ? normalisePhoneE164(i.phone) : null; if (i.phone && !phone) throw bad('That phone number is not valid.');
    const status = i.status ?? 'UNCLAIMED';
    const draft = { status, name, categoryId: cat.id, locationId: loc?.id ?? null, phoneE164: phone, address: i.address ?? {}, descriptionText: String(i.description ?? '').slice(0, 2000) };
    const indexable = await this.indexableFor(draft as never);
    const row = await this.createWithSlug(businessSlug(name, loc?.name), (slug) => this.repo.createBusiness({ vendorId: null, slug, name, categoryId: cat.id, locationId: loc?.id ?? null, address: draft.address, phoneE164: phone, emailMasked: i.email ? maskEmail(i.email) || null : null, hours: i.hours ?? {}, geo: i.geo ?? null, descriptionText: draft.descriptionText, status, indexable, source: 'STAFF' }));
    if (i.services?.length) await this.repo.replaceServices(row.id, i.services.slice(0, 40).map((s) => ({ name: s.name, description: s.description ?? '' })));
    if (i.media?.length) await this.repo.replaceMedia(row.id, i.media.slice(0, 40).map((m) => ({ url: m.url, altText: m.altText ?? '' })));
    await this.audit.record(actor, 'directory.business.create', 'directory_business', row.id, null, { slug: row.slug, status: row.status, categoryId: row.categoryId, locationId: row.locationId });
    return staffBusinessView(row, await this.context(row), false);
  }

  /** A free slug (short names are stable once chosen; a staff edit never changes them). `extraTaken` holds slugs a racing insert already took. */
  async freeSlug(base: string, extraTaken: ReadonlySet<string> = new Set()): Promise<string> {
    const taken = new Set<string>(extraTaken);
    for (let n = 0; n < 250; n++) {
      const candidate = uniqueSlug(base, (s) => taken.has(s));
      if (!(await this.repo.slugTaken(candidate))) return candidate;
      taken.add(candidate);
    }
    return uniqueSlug(base, (s) => taken.has(s)) + '-x';
  }

  /** Inserts with a free slug and, when two creators pick the same one at the same moment (the unique rule fires), tries the next. Any other failure is raised as it is. */
  async createWithSlug(base: string, make: (slug: string) => Promise<BusinessRow>): Promise<BusinessRow> {
    const raced = new Set<string>();
    for (let n = 0; n < 8; n++) {
      const slug = await this.freeSlug(base, raced);
      try { return await make(slug); } catch (e) { if (!isSlugClash(e)) throw e; raced.add(slug); }
    }
    throw new ConflictException(directoryError('DIRECTORY_SLUG_TAKEN', 'Could not find a free short name; please try again.'));
  }

  async updateBusiness(id: string, p: Partial<BusinessInput>, actor: Actor) {
    const before = await this.repo.getBusiness(id); if (!before) throw notFound();
    if (before.status === 'REMOVED') throw new ConflictException(directoryError('DIRECTORY_STATE_INVALID', 'A removed profile cannot be edited.'));
    const patch: Record<string, unknown> = {};
    if (p.name !== undefined) patch.name = this.cleanName(p.name);
    if (p.categoryId !== undefined) { const c = await this.repo.getCategory(p.categoryId); if (!c || !c.active) throw bad('That category does not exist.'); patch.categoryId = c.id; }
    if (p.locationId !== undefined) { if (p.locationId) { const l = await this.repo.getLocation(p.locationId); if (!l) throw bad('That place does not exist.'); patch.locationId = l.id; } else patch.locationId = null; }
    if (p.phone !== undefined) { const ph = p.phone ? normalisePhoneE164(p.phone) : null; if (p.phone && !ph) throw bad('That phone number is not valid.'); patch.phoneE164 = ph; }
    if (p.email !== undefined) patch.emailMasked = p.email ? maskEmail(p.email) || null : null;
    if (p.address !== undefined) patch.address = p.address; if (p.hours !== undefined) patch.hours = p.hours; if (p.geo !== undefined) patch.geo = p.geo;
    if (p.description !== undefined) patch.descriptionText = String(p.description).slice(0, 2000);
    const merged = { ...before, ...patch } as BusinessRow;
    patch.indexable = await this.indexableFor(merged);
    const row = await this.repo.updateBusiness(id, patch);
    if (p.services) await this.repo.replaceServices(id, p.services.slice(0, 40).map((s) => ({ name: s.name, description: s.description ?? '' })));
    if (p.media) await this.repo.replaceMedia(id, p.media.slice(0, 40).map((m) => ({ url: m.url, altText: m.altText ?? '' })));
    await this.audit.record(actor, 'directory.business.update', 'directory_business', id, { status: before.status, indexable: before.indexable }, { status: row.status, indexable: row.indexable, fields: Object.keys(patch).filter((k) => k !== 'indexable') });
    return staffBusinessView(row, await this.context(row), false);
  }

  /** SUSPEND hides a profile (reversible), RESTORE brings it back, REMOVE hides it for good in this slice (the row and its audit trail are kept; the public API answers 410). */
  async moderate(id: string, action: 'SUSPEND' | 'RESTORE' | 'REMOVE', reason: string, actor: Actor) {
    const why = need(reason);
    const b = await this.repo.getBusiness(id); if (!b) throw notFound();
    if (b.status === 'REMOVED') throw new ConflictException(directoryError('DIRECTORY_STATE_INVALID', 'A removed profile cannot be changed.'));
    let patch: Record<string, unknown>;
    if (action === 'SUSPEND') { if (b.status === 'SUSPENDED') return staffBusinessView(b, await this.context(b), false); patch = { status: 'SUSPENDED', indexable: false }; }
    else if (action === 'RESTORE') {
      if (b.status !== 'SUSPENDED') throw new ConflictException(directoryError('DIRECTORY_STATE_INVALID', 'Only a suspended profile can be restored.'));
      const status = b.vendorId && b.claimedAt ? 'CLAIMED' : 'UNCLAIMED'; patch = { status, indexable: await this.indexableFor({ ...b, status }) };
    } else patch = { status: 'REMOVED', indexable: false, removedAt: this.clock() };
    const row = await this.repo.updateBusiness(id, patch);
    await this.audit.record(actor, `directory.business.${action.toLowerCase()}`, 'directory_business', id, { status: b.status }, { status: row.status, reason: why });
    return staffBusinessView(row, await this.context(row), false);
  }

  // ───────────────────────────────────────────────────────────────────────────────────── placements (always labelled sponsored)
  async createPlacement(businessId: string, d: { startsAt: string; endsAt: string; label: string }, actor: Actor) {
    const b = await this.repo.getBusiness(businessId); if (!b) throw notFound();
    if (b.status !== 'CLAIMED' && b.status !== 'UNCLAIMED') throw new ConflictException(directoryError('DIRECTORY_STATE_INVALID', 'Only a public profile can have a sponsored placement.'));
    const label = String(d.label ?? '').trim(); if (!label || label.length > 60) throw bad('A sponsored placement needs a label of 1 to 60 characters.');
    const startsAt = new Date(d.startsAt); const endsAt = new Date(d.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw bad('The end must be after the start.');
    const row = await this.repo.createPlacement({ businessId, startsAt, endsAt, label, createdByStaffId: actor.id });
    await this.audit.record(actor, 'directory.placement.create', 'directory_placement', row.id, null, { businessId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), label });
    return row;
  }
  async listPlacements(businessId: string) { if (!(await this.repo.getBusiness(businessId))) throw notFound(); return this.repo.listPlacements(businessId); }
  async revokePlacement(id: string, actor: Actor) {
    const p = await this.repo.getPlacement(id); if (!p) throw notFound();
    await this.repo.revokePlacement(id, this.clock());
    await this.audit.record(actor, 'directory.placement.revoke', 'directory_placement', id, { businessId: p.businessId }, { revoked: true });
    return { revoked: true };
  }

  // ───────────────────────────────────────────────────────────────────────────────────── claim phone override (the OTP goes to the phone on file; a different phone needs this)
  async claimPhoneOverride(businessId: string, d: { phone: string; reason: string }, actor: Actor) {
    const why = need(d.reason);
    const b = await this.repo.getBusiness(businessId); if (!b) throw notFound();
    if (b.status === 'CLAIMED' || b.status === 'REMOVED') throw new ConflictException(directoryError('DIRECTORY_STATE_INVALID', 'Only an unclaimed profile can have its claim phone changed.'));
    const phone = normalisePhoneE164(d.phone); if (!phone) throw bad('That phone number is not valid.');
    const row = await this.repo.addOverride({ businessId, phoneE164: phone, phoneHash: hashPhone(phone, this.pepper.value()), reason: why, approvedByStaffId: actor.id ?? 'unknown' });
    await this.audit.record(actor, 'directory.claim_phone.override', 'directory_business', businessId, null, { overrideId: row.id, reason: why, phoneMasked: `${phone.slice(0, 3)}${'•'.repeat(Math.max(phone.length - 6, 1))}${phone.slice(-3)}` });
    return { id: row.id, businessId, createdAt: row.createdAt };
  }
}
