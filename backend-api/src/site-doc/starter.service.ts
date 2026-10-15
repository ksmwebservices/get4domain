import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SiteDocService } from './site-doc.service';
import { PackConfig } from './pack.types';
import { FAMILIES } from './families';
import { overlayDraft } from './site-merge';
import { sampleMap } from './sample-markers';
import { makePreviewToken } from './preview-token';
import { SiteExtras } from './site-doc.constants';

/** "12 Marker Street, Anna Nagar, Chennai, 600001" -> the part before the pin code; a single word is the city itself. Same rule as the public renderer. */
export function cityOf(address: string | null | undefined): string {
  const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].length <= 40 ? parts[0] : '';
  const last = parts[parts.length - 1];
  return /^\d{5,6}$/.test(last) ? parts[parts.length - 2] ?? '' : last;
}

export interface CompanyDetails { businessName: string; city?: string; phone?: string }
export interface StarterResult { filled: string[]; kept: string[]; itemsCreated: number; designKey: string }

const RESERVED = new Set(['www', 'app', 'api', 'gapi', 'admin', 'mail', 'cdn', 'static', 'staging', 'demo', 'dashboard', 'login', 'register', 'support', 'help', 'blog', 'ftp', 'smtp', 'test', 'dev']);
const SUB_RE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;

/** "Cafe in {city}" with no city becomes "Cafe"; every placeholder is filled from the vendor's own details. */
export function fillSeedText(t: string, v: { business: string; city: string; phone?: string }): string {
  let s = t;
  if (!v.city) s = s.replace(/\s+(in|at|near)\s+\{city\}/g, '').replace(/\{city\}/g, '');
  return s.replace(/\{business\}/g, v.business).replace(/\{city\}/g, v.city).replace(/\{phone\}/g, v.phone ?? '').replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
}

const isEmptyValue = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

/**
 * Starter content (industry designs). Copies a category's starter text, items, questions, steps, sample quotes and pictures into the vendor's OWN site, marked sample.
 * It fills only what is empty or still sample: a field the vendor wrote or edited is never overwritten. Nothing is a render-time fallback.
 */
@Injectable()
export class StarterService {
  constructor(private readonly prisma: PrismaService, private readonly site: SiteDocService) {}

  async packFor(packKey: string | null | undefined, industry: string | null | undefined): Promise<{ key: string; config: PackConfig } | null> {
    const keys = [packKey, industry].filter((k): k is string => !!k);
    for (const k of keys) {
      const p = await this.prisma.categoryPack.findUnique({ where: { key: k } });
      if (p?.enabled && (p.config as unknown as PackConfig).seed) return { key: p.key, config: p.config as unknown as PackConfig };
    }
    if (industry) {
      const all = await this.prisma.categoryPack.findMany({ where: { enabled: true } });
      const hit = all.find((p) => ((p.config as unknown as PackConfig).keywords ?? []).some((w) => w.toLowerCase() === industry.toLowerCase()) && (p.config as unknown as PackConfig).seed);
      if (hit) return { key: hit.key, config: hit.config as unknown as PackConfig };
    }
    return null;
  }

  /**
   * Seeds one vendor. `where`: 'published' writes the site row directly (a brand-new site nobody has seen), 'draft' lays the starter over the pending draft so the vendor can
   * preview it and publish (an existing site). Items are the vendor's own catalogue rows and are only added when the vendor has no items at all.
   */
  async seed(vendorId: string, packKey: string, company: CompanyDetails, where: 'published' | 'draft'): Promise<StarterResult> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { industry: true } });
    if (!vendor) throw new NotFoundException('We could not find that account.');
    const pack = await this.packFor(packKey, vendor.industry);
    if (!pack?.config.seed) throw new NotFoundException('That category has no starter content yet. Choose another, or contact support.');
    const c = pack.config; const seed = c.seed!;
    const v = { business: company.businessName.trim(), city: (company.city ?? '').trim(), phone: company.phone?.trim() };
    const fill = (t: string): string => fillSeedText(t, v);

    const row = await this.prisma.vendorCMS.findUnique({ where: { vendorId } });
    const cur = (row ? overlayDraft(row as unknown as { draft?: unknown }) : {}) as Record<string, unknown>;
    const curEx = ((cur.extras && typeof cur.extras === 'object' ? cur.extras : {}) as SiteExtras);
    const sample = sampleMap(curEx);
    const filled: string[] = []; const kept: string[] = [];
    const can = (key: string, value: unknown): boolean => { const ok = isEmptyValue(value) || sample[key] === true; (ok ? filled : kept).push(key); return ok; };

    const patch: Record<string, unknown> = {};
    const extras: SiteExtras = { ...curEx };
    const mark: Record<string, boolean> = { ...sample };
    const setExtra = <K extends keyof SiteExtras>(k: K, value: SiteExtras[K]): void => { if (can(String(k), curEx[k])) { extras[k] = value; mark[String(k)] = true; } };

    if (can('tagline', cur.tagline)) { patch.tagline = fill(seed.tagline); mark.tagline = true; }
    if (can('about', cur.about)) { patch.about = fill(seed.about); mark.about = true; }
    if (can('banner', cur.banner)) { patch.banner = seed.images.hero; mark.banner = true; }
    if (can('gallery', cur.portfolio)) { patch.portfolio = seed.images.gallery.map((src, i) => ({ id: `starter-${i + 1}`, src, title: '', category: '' })); mark.gallery = true; }
    setExtra('headline', fill(seed.headline));
    setExtra('subline', fill(seed.subline));
    setExtra('ctaLabel', seed.cta);
    setExtra('announcement', fill(seed.announce));
    setExtra('trust', seed.trust.map(fill));
    setExtra('faq', (seed.faq ?? c.defaults.faq).map((f) => ({ q: fill(f.q), a: fill(f.a) })));
    setExtra('steps', seed.steps.map((s) => ({ title: s.title, desc: s.desc })));
    extras.sample = mark;
    patch.extras = extras;
    if (isEmptyValue(cur.testimonials)) patch.testimonials = seed.quotes.map((q) => ({ quote: q.quote, author: q.author, sample: true }));

    const design = (c.designs ?? []).find((d) => d.key === (cur.designKey as string | undefined) && d.enabled !== false) ?? (c.designs ?? []).find((d) => d.key === c.defaultDesign) ?? (c.designs ?? [])[0];
    patch.designKey = design.key;
    const layout = (cur.layout && typeof cur.layout === 'object' ? cur.layout : {}) as Record<string, string>;
    patch.layout = layout.themeKey ? layout : { ...layout, themeKey: design.themeKey };

    if (where === 'published') {
      const data = { ...this.site.columnsOf(patch), packKey: pack.key, ...(company.businessName ? { businessName: v.business } : {}), ...(v.phone ? { phone: v.phone } : {}), ...(v.city && isEmptyValue(cur.address) ? { address: v.city } : {}) };
      await this.prisma.vendorCMS.upsert({ where: { vendorId }, create: { vendorId, ...data }, update: data });
    } else {
      await this.prisma.vendorCMS.upsert({ where: { vendorId }, create: { vendorId, packKey: pack.key }, update: { packKey: pack.key } });
      await this.site.writeDraft(vendorId, patch);
    }

    const itemsCreated = await this.seedItems(vendorId, vendor.industry, c, fill);
    return { filled, kept, itemsCreated, designKey: design.key };
  }

  /** Adds the category's starter items, marked sample, only when the vendor has no items yet. Sample prices are marked so the public page shows "Contact for price". */
  private async seedItems(vendorId: string, industry: string | null, c: PackConfig, fill: (t: string) => string): Promise<number> {
    if ((await this.prisma.vendorProduct.count({ where: { vendorId } })) > 0) return 0;
    const seed = c.seed!;
    const rows: Prisma.VendorProductCreateManyInput[] = seed.items.map((it, i) => {
      const price = (it.price ?? '').trim();
      const fields = Object.fromEntries(Object.entries(it.fields ?? {}).map(([k, val]) => [k, fill(val)]).filter(([, val]) => val));
      return {
        vendorId, name: fill(it.title), description: fill(it.desc), price: price || null, priceAmount: price ? Number(price) : null, category: it.category || null,
        image: seed.images.gallery[i % seed.images.gallery.length] ?? null, active: true, industryType: industry ?? 'general',
        customFields: { ...fields, sample: 'true', ...(price ? { samplePrice: 'true' } : {}) } as Prisma.InputJsonValue,
      };
    });
    await this.prisma.vendorProduct.createMany({ data: rows });
    return rows.length;
  }

  /** The four designs of the vendor's own category, with the one in use. Nothing else is ever offered to the vendor. */
  async designsOf(vendorId: string): Promise<{ packKey: string | null; family: string | null; current: string | null; defaultDesign: string | null; designs: { key: string; name: string; themeKey: string; font: string; radius: string; button: string; sections: string[] }[]; itemFields: { key: string; label: string }[] }> {
    const [row, vendor] = await Promise.all([this.prisma.vendorCMS.findUnique({ where: { vendorId } }), this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { industry: true } })]);
    const pack = await this.packFor(row?.packKey, vendor?.industry);
    if (!pack) return { packKey: null, family: null, current: null, defaultDesign: null, designs: [], itemFields: [] };
    const cur = (row ? overlayDraft(row as unknown as { draft?: unknown }) : {}) as Record<string, unknown>;
    const designs = (pack.config.designs ?? []).filter((d) => d.enabled !== false).map((d) => ({ key: d.key, name: d.name, themeKey: d.themeKey, font: d.font, radius: d.radius, button: d.button, sections: d.sections.map((s) => `${s.type}:${s.variant}`) }));
    return { packKey: pack.key, family: pack.config.family ?? null, current: (cur.designKey as string | undefined) || pack.config.defaultDesign || null, defaultDesign: pack.config.defaultDesign ?? null, designs, itemFields: pack.config.family ? FAMILIES[pack.config.family].itemFields : [] };
  }

  /** Switching design changes layout and style only; every word, item and picture stays (sections are matched by type). Written to the draft. */
  async switchDesign(vendorId: string, key: string) {
    await this.site.assertDesignAllowed(vendorId, key);
    const d = await this.designsOf(vendorId);
    const theme = d.designs.find((x) => x.key === key)?.themeKey;
    await this.site.writeDraft(vendorId, { designKey: key, layout: theme ? { themeKey: theme } : {} });
    return this.site.view(vendorId);
  }

  /** "Reset to starter": fills what is empty or still sample from the category's starter content. Never overwrites anything the vendor wrote or edited. */
  async reset(vendorId: string): Promise<{ view: Awaited<ReturnType<SiteDocService['view']>>; result: StarterResult }> {
    const [row, vendor] = await Promise.all([this.prisma.vendorCMS.findUnique({ where: { vendorId } }), this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { industry: true, businessName: true, phone: true } })]);
    if (!vendor) throw new NotFoundException('We could not find that account.');
    const pack = await this.packFor(row?.packKey, vendor.industry);
    if (!pack) throw new NotFoundException('Your category has no starter content yet. Choose a category first, or contact support.');
    const cur = (row ? overlayDraft(row as unknown as { draft?: unknown }) : {}) as Record<string, unknown>;
    const result = await this.seed(vendorId, pack.key, { businessName: String(cur.businessName || vendor.businessName), city: cityOf(cur.address as string | undefined), phone: String(cur.phone || vendor.phone || '') || undefined }, 'draft');
    return { view: await this.site.view(vendorId), result };
  }

  /** Admin: one new site for a category and business details. It starts as DRAFT: hidden from the public until it is published or claimed. */
  async createSite(input: { categoryKey: string; businessName: string; subdomain: string; city?: string; phone?: string }, actor: string): Promise<{ vendorId: string; subdomain: string; status: string; designKey: string; itemsCreated: number; previewUrl: string }> {
    const sub = input.subdomain.trim().toLowerCase();
    if (!SUB_RE.test(sub)) throw new BadRequestException('The site address can use lower-case letters, numbers and dashes, 3 to 40 characters, and cannot start or end with a dash.');
    if (RESERVED.has(sub)) throw new BadRequestException('That address is reserved. Choose another.');
    if (await this.prisma.vendor.findUnique({ where: { subdomain: sub } })) throw new ConflictException('That address is already used by another site. Choose another.');
    const pack = await this.prisma.categoryPack.findUnique({ where: { key: input.categoryKey } });
    if (!pack || !pack.enabled || !(pack.config as unknown as PackConfig).seed) throw new BadRequestException('Choose a category that is switched on and has starter content.');
    const name = input.businessName.trim();
    if (name.length < 2 || name.length > 120) throw new BadRequestException('Give the business a name of 2 to 120 characters.');
    const password = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
    const vendor = await this.prisma.vendor.create({
      data: { name, email: `site+${sub}@sites.get4domain.invalid`, password, businessName: name, phone: input.phone?.trim() || null, industry: pack.key, subdomain: sub, status: 'PENDING' },
    });
    await this.prisma.vendorAddon.create({ data: { vendorId: vendor.id, addonKey: 'site_doc_v2', enabled: true } });
    await this.prisma.vendorCMS.create({ data: { vendorId: vendor.id, packKey: pack.key, siteStatus: 'DRAFT', businessName: name, ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}) } });
    const r = await this.seed(vendor.id, pack.key, { businessName: name, city: input.city, phone: input.phone }, 'published');
    void actor;
    return { vendorId: vendor.id, subdomain: sub, status: 'DRAFT', designKey: r.designKey, itemsCreated: r.itemsCreated, previewUrl: `/site/${sub}?preview=${makePreviewToken(vendor.id)}` };
  }
}
