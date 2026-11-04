import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { normalisePhoneE164 } from './core/otp';
import { businessSlug } from './core/slug';
import { DirectoryAdminService } from './directory-admin.service';
import { DirectoryAudit } from './directory-audit';
import { DirectoryReadService } from './directory-read.service';
import { directoryError } from './directory.errors';
import { Address, BusinessRow, DirectoryRepository } from './directory.repository';
import { locationPath, resolveCategory, resolveLocation } from './directory-views';

export interface ProfileInput { name?: string; description?: string; phone?: string | null; address?: Address; hours?: Record<string, unknown>; geo?: { lat: number; lng: number } | null; services?: Array<{ name: string; description?: string }>; media?: Array<{ url: string; altText?: string }>; categorySlug?: string; locationPath?: string }
const bad = (m: string): BadRequestException => new BadRequestException(directoryError('DIRECTORY_INVALID', m));

/** The vendor's own directory profile. The vendor is the verified principal's vendor (never from the body); the slug, status, indexable flag and vendor link are never editable here. */
@Injectable()
export class MeDirectoryService {
  constructor(private readonly repo: DirectoryRepository, private readonly admin: DirectoryAdminService, private readonly audit: DirectoryAudit, @Inject(DirectoryReadService) private readonly read: Pick<DirectoryReadService, 'invalidate'>) {}

  private async view(b: BusinessRow) {
    const [locs, cats, services, media] = await Promise.all([this.repo.listLocations(), this.repo.listCategories(), this.repo.getServices(b.id), this.repo.getMedia(b.id)]);
    const cat = cats.find((c) => c.id === b.categoryId);
    return {
      slug: b.slug, name: b.name, status: b.status, indexable: b.indexable, description: b.descriptionText, phone: b.phoneE164, address: b.address, hours: b.hours, geo: b.geo,
      category: cat ? { slug: cat.slug, name: cat.name } : null, location: locationPath(locs, b.locationId), services: services.map((s) => ({ name: s.name, description: s.description })), media: media.map((m) => ({ url: m.url, altText: m.altText })),
    };
  }

  async get(vendorId: string) {
    const b = await this.repo.getBusinessByVendor(vendorId);
    return b ? { exists: true as const, profile: await this.view(b) } : { exists: false as const };
  }

  async put(vendorId: string, i: ProfileInput, actor: Actor) {
    let b = await this.repo.getBusinessByVendor(vendorId);
    if (b?.status === 'REMOVED' || b?.status === 'SUSPENDED') throw new NotFoundException(directoryError('DIRECTORY_STATE_INVALID', 'This profile is not editable.'));
    if (!b) {
      const vendor = await this.repo.vendorBasics(vendorId); if (!vendor) throw new NotFoundException(directoryError('DIRECTORY_NOT_FOUND', 'That business does not exist.'));
      const cat = i.categorySlug ? resolveCategory(await this.repo.listCategories(), i.categorySlug) : null;
      const loc = i.locationPath ? resolveLocation(await this.repo.listLocations(), i.locationPath) : null;
      if (!cat || !cat.parentId) throw bad('Choose a category to create your directory profile.');
      if (!loc) throw bad('Choose a place to create your directory profile.');
      const name = (i.name ?? vendor.name).trim(); if (!name) throw bad('A profile needs a name.');
      const phone = i.phone ? normalisePhoneE164(i.phone) : null; if (i.phone && !phone) throw bad('That phone number is not valid.');
      const draft = { status: 'CLAIMED' as const, name, categoryId: cat.id, locationId: loc.id, phoneE164: phone, address: i.address ?? {}, descriptionText: String(i.description ?? '').slice(0, 2000) };
      const indexable = await this.admin.indexableFor(draft);
      b = await this.admin.createWithSlug(businessSlug(name, loc.name), (slug) => this.repo.createBusiness({ vendorId, slug, name, categoryId: cat.id, locationId: loc.id, address: draft.address, phoneE164: phone, emailMasked: null, hours: i.hours ?? {}, geo: i.geo ?? null, descriptionText: draft.descriptionText, status: 'CLAIMED', indexable, source: 'VENDOR', claimedAt: new Date() }));
      if (i.services?.length) await this.repo.replaceServices(b.id, i.services.slice(0, 40).map((s) => ({ name: s.name, description: s.description ?? '' })));
      if (i.media?.length) await this.repo.replaceMedia(b.id, i.media.slice(0, 40).map((m) => ({ url: m.url, altText: m.altText ?? '' })));
      await this.audit.record(actor, 'directory.profile.create', 'directory_business', b.id, null, { slug: b.slug });
    } else {
      const { categorySlug: _c, locationPath: _l, ...fields } = i;
      const patch = { ...fields, ...(i.categorySlug ? { categoryId: this.catId(await this.repo.listCategories(), i.categorySlug) } : {}), ...(i.locationPath ? { locationId: this.locId(await this.repo.listLocations(), i.locationPath) } : {}) };
      await this.admin.updateBusiness(b.id, patch, actor);
      b = (await this.repo.getBusinessByVendor(vendorId))!;
    }
    this.read.invalidate();
    return { exists: true as const, profile: await this.view(b) };
  }

  private catId(cats: Awaited<ReturnType<DirectoryRepository['listCategories']>>, slug: string): string { const c = resolveCategory(cats, slug); if (!c || !c.parentId) throw bad('That category does not exist.'); return c.id; }
  private locId(locs: Awaited<ReturnType<DirectoryRepository['listLocations']>>, p: string): string { const l = resolveLocation(locs, p); if (!l) throw bad('That place does not exist.'); return l.id; }
}
