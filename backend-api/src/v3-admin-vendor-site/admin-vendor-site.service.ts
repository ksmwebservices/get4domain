import { randomBytes } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { isListableCategory } from '../directory/core/listable-categories';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationHook, SiteAnswer } from '../plans/registration/registration.hook';
import { SeededSitesService } from '../seeded-sites/seeded-sites.service';
import { TrialSignupPolicy } from '../v3-trial/trial-signup.policy';
import { VendorsService } from '../vendors/vendors.service';
import { TelecallerCapService } from '../v3-telecaller/telecaller-cap.service';
import { CreateVendorWithSiteDto } from './admin-vendor-site.dto';
import { buildCategoryTree, CategoryTree, PackRow } from './category-tree';

/** The address kept for the site: the full address when given, else the line, area, city and pincode that were given, joined with commas. Null when nothing was given. */
export function siteAddress(dto: Pick<CreateVendorWithSiteDto, 'address' | 'addressLine' | 'area' | 'city' | 'pincode'>): string | null {
  const full = dto.address?.trim();
  if (full) return dto.addressLine?.trim() && !full.toLowerCase().includes(dto.addressLine.trim().toLowerCase()) ? `${dto.addressLine.trim()}, ${full}` : full;
  const line = dto.addressLine?.trim(); if (!line) return null;
  return [line, dto.area?.trim(), dto.city?.trim(), dto.pincode?.trim()].filter(Boolean).join(', ');
}

/** label: FIELD_EXECUTIVE or TELECALLER when the role is a labelled SALES one. */
export interface StaffActor { id: string; role: string; label?: string | null }
const isTelecaller = (a: StaffActor): boolean => a.role === 'TELECALLER' || a.label === 'TELECALLER';
export interface CreatedVendorSite { vendorId: string; subdomain: string; site: SiteAnswer; siteUrl: string | null }

/**
 * Staff create a business on behalf of an owner (B2.2): the shared duplicate check (through VendorsService.create, path ADMIN_VENDOR), the vendor, its Free plan and the live trial site
 * built from the industry pack (starter text, services, FAQ and pictures; a plain generated banner when the pack has no pictures). Returns the site address.
 * The owner gets the welcome e-mail VendorsService.create already sends; the initial password is random and is never returned or logged.
 */
@Injectable()
export class AdminVendorSiteService {
  constructor(
    private readonly vendors: VendorsService, private readonly registration: RegistrationHook, private readonly trial: TrialSignupPolicy,
    private readonly prisma: PrismaService, private readonly seeded: SeededSitesService, private readonly telecallerCap: TelecallerCapService,
  ) {}

  async tree(q?: string): Promise<CategoryTree> {
    const listable = (await this.seeded.listableCategories()).items;
    const rows = await this.prisma.v3PackCategory.findMany({ where: { active: true }, select: { categoryKey: true, minTier: true, starterServices: true } });
    const packs = new Map<string, PackRow>(rows.map((r) => [r.categoryKey, { minTier: r.minTier, starterServices: Array.isArray(r.starterServices) ? (r.starterServices as unknown[]).map(String) : [] }]));
    return buildCategoryTree(listable, packs, q ?? '');
  }

  /** A telecaller is held to the daily cap whichever route was used, and cannot override the duplicate check (admins only). */
  async create(dto: CreateVendorWithSiteDto, actor: StaffActor): Promise<CreatedVendorSite> {
    if (!isTelecaller(actor)) return this.createNow(dto, actor);
    const { duplicateOverrideReason: _admins, ...safe } = dto;
    return this.telecallerCap.run(actor.id, () => this.createNow(safe as CreateVendorWithSiteDto, actor));
  }

  private async createNow(dto: CreateVendorWithSiteDto, actor: StaffActor): Promise<CreatedVendorSite> {
    const listable = (await this.seeded.listableCategories()).items;
    if (!isListableCategory(dto.category, (k) => listable.some((c) => c.key === k))) throw new BadRequestException({ code: 'CATEGORY_UNKNOWN', message: 'That category does not exist. Pick one from the category list.' });
    const subdomain = await this.trial.resolveSubdomain(dto.subdomain, dto.businessName);
    const vendor = await this.vendors.create({
      name: dto.ownerName, email: dto.email.trim().toLowerCase(), password: `${randomBytes(12).toString('base64url')}aA1`, businessName: dto.businessName, phone: dto.phone, industry: dto.category, subdomain,
      city: dto.city, area: dto.area, pincode: dto.pincode, gstin: dto.gstin, duplicateOverrideReason: dto.duplicateOverrideReason,
    }, { path: 'ADMIN_VENDOR', actor: { id: actor.id, role: actor.role }, selfService: false });
    // provenance first: the plan step only fills an empty `source`
    await this.prisma.vendor.update({ where: { id: vendor.id }, data: { source: 'STAFF', registeredByStaffId: actor.id } });
    const address = siteAddress(dto);
    if (address) await this.prisma.vendorCMS.upsert({ where: { vendorId: vendor.id }, create: { vendorId: vendor.id, address }, update: { address } });
    const site = await this.registration.createMySite(vendor.id, 'STAFF');
    return { vendorId: vendor.id, subdomain, site, siteUrl: site.url };
  }
}
