import { BadRequestException, ForbiddenException, GoneException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { LeadspaceProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { checkBusiness, promotionGate, reraLooksValid, scanText } from './abuse';
import { clean } from './goals';
import { CATEGORIES, EVENT_TYPES, EventType, categoryOf, hashOf, normalizePhone, slugify } from './leadspace.types';
import { LeadOtpService } from './otp.service';
import { PageModel, PageSource, ServiceItem, buildPage, pageUrl } from './page-builder';
import { LeadspaceSettingsService } from './settings.service';
import { templateFor } from './templates';

export interface PageInput {
  category?: string; subcategory?: string; city?: string; serviceArea?: string; goal?: string; mode?: string; businessName?: string; tagline?: string; about?: string;
  address?: string; mapsLink?: string; heroImage?: string; email?: string; hours?: string; existingPageUrl?: string; reraNumber?: string;
  services?: unknown; offer?: unknown; gallery?: unknown; faqs?: unknown; trust?: unknown;
}

const URL_OK = /^https?:\/\/[^\s<>"']{4,500}$/i;
const IMG_OK = /^(https?:\/\/[^\s<>"']{4,500}|\/[A-Za-z0-9_\-./]{2,300})$/i;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function cleanServices(v: unknown): ServiceItem[] {
  return arr(v).slice(0, 40).map((x) => {
    const o = obj(x);
    const name = clean(o.name, 120);
    const n = Number(o.price);
    const price: number | string | null = typeof o.price === 'number' || (typeof o.price === 'string' && /^\d+(\.\d+)?$/.test(o.price.trim()))
      ? (Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? n : null)
      : clean(o.price, 40) || null;
    const img = clean(o.image, 500);
    return { name, price, description: clean(o.description, 240) || null, image: IMG_OK.test(img) ? img : null };
  }).filter((s) => s.name);
}
const cleanFaqs = (v: unknown): { q: string; a: string }[] => arr(v).slice(0, 12).map((x) => ({ q: clean(obj(x).q, 160), a: clean(obj(x).a, 500) })).filter((f) => f.q && f.a);
const cleanTrust = (v: unknown): string[] => arr(v).slice(0, 8).map((x) => clean(x, 80)).filter(Boolean);
const cleanGallery = (v: unknown): { src: string; alt: string }[] => arr(v).slice(0, 12).map((x) => (typeof x === 'string' ? { src: clean(x, 500), alt: '' } : { src: clean(obj(x).src, 500), alt: clean(obj(x).alt, 120) })).filter((g) => IMG_OK.test(g.src));
const cleanOffer = (v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull => {
  const o = obj(v);
  const headline = clean(o.headline, 80); const text = clean(o.text, 240);
  if (!headline && !text) return Prisma.JsonNull;
  const until = clean(o.validUntil, 10);
  return { headline, text, validUntil: /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null };
};

/** Pages, their rules and their public views. */
@Injectable()
export class LeadspaceProfileService {
  constructor(private readonly prisma: PrismaService, private readonly otp: LeadOtpService, private readonly settings: LeadspaceSettingsService) {}

  private async scan(p: { businessName: string; tagline?: string | null; about?: string | null; services: unknown; offer?: unknown; category: string }): Promise<void> {
    const s = await this.settings.get();
    const t = templateFor(p.category);
    const v = scanText({
      'business name': p.businessName, tagline: p.tagline, about: p.about,
      services: arr(p.services).map((x) => `${obj(x).name ?? ''} ${obj(x).description ?? ''}`).join(' . '), offer: `${obj(p.offer).headline ?? ''} ${obj(p.offer).text ?? ''}`,
    }, s.blocklistWords, t.forbiddenClaims ?? []);
    if (!v.ok) throw new BadRequestException(v.reason);
  }

  private async uniqueSlug(base: string): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const slug = i === 0 ? base : `${base}-${i === 1 ? Math.floor(Math.random() * 90 + 10) : Math.floor(Math.random() * 9000 + 1000)}`;
      if (!(await this.prisma.leadspaceProfile.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  /** What a vendor is missing before the page can go live, in plain sentences. */
  checklist(p: LeadspaceProfile, hasAlertNumber: boolean): { done: boolean; text: string }[] {
    const services = cleanServices(p.services);
    return [
      { done: checkBusiness(p.businessName, p.category).ok, text: 'Business name and trade are set' },
      { done: Boolean(p.city), text: 'City is set' },
      { done: services.length > 0, text: 'Add at least one service or product (prices are optional)' },
      { done: hasAlertNumber, text: 'Add a WhatsApp number for alerts' },
      { done: p.verificationStatus === 'VERIFIED', text: 'Verify your phone number with a code (needed for search and promotion)' },
      ...(categoryOf(p.category)?.regulated === 'realEstate' ? [{ done: reraLooksValid(p.reraNumber), text: 'Add your RERA number (shown on the page and needed for promotion)' }] : []),
    ];
  }

  async mine(vendorId: string): Promise<Record<string, unknown>> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId } });
    if (!p) return { profile: null, categories: CATEGORIES };
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { phone: true } });
    const model = buildPage(p as unknown as PageSource);
    const gate = promotionGate(p);
    return { profile: p, preview: model, url: pageUrl(p.slug), embed: this.embedSnippet(p.slug), checklist: this.checklist(p, Boolean(normalizePhone(p.alertWhatsapp) ?? normalizePhone(p.phone) ?? normalizePhone(vendor?.phone))), promotion: { allowed: gate.ok, reason: gate.reason ?? null }, categories: CATEGORIES };
  }

  embedSnippet(slug: string): string {
    const base = (process.env.PUBLIC_APP_URL || 'https://get4domain.com').replace(/\/+$/, '');
    const api = (process.env.PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com').replace(/\/+$/, '');
    return `<script src="${base}/ls-embed.js" data-slug="${slug}" data-api="${api}" defer></script>`;
  }

  /** Create the page from company details. Anything the vendor already has (website text, catalogue) is reused, not retyped. */
  async create(vendorId: string, input: PageInput, ip?: string): Promise<LeadspaceProfile> {
    if (await this.prisma.leadspaceProfile.findUnique({ where: { vendorId }, select: { id: true } })) throw new BadRequestException('You already have a LeadSpace page. Open the Page tab to edit it.');
    const s = await this.settings.get();
    const ipHash = ip ? hashOf(`i:${ip}`) : null;
    if (ipHash) {
      const made = await this.prisma.leadspaceProfile.count({ where: { createdIpHash: ipHash, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
      if (made >= s.pagesPerIpPerDay) throw new HttpException('Too many pages were created from this network today. Please try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const cat = categoryOf(input.category);
    if (!cat) throw new BadRequestException('Choose your trade from the list.');
    const city = clean(input.city, 60);
    if (!city) throw new BadRequestException('Enter the city you serve.');
    const [vendor, cms, products] = await Promise.all([
      this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { businessName: true, phone: true, email: true } }),
      this.prisma.vendorCMS.findUnique({ where: { vendorId } }),
      this.prisma.vendorProduct.findMany({ where: { vendorId, active: true }, orderBy: { createdAt: 'asc' }, take: 40, select: { name: true, description: true, price: true, priceAmount: true, image: true } }),
    ]);
    const businessName = clean(input.businessName || cms?.businessName || vendor?.businessName, 80);
    const verdict = checkBusiness(businessName, cat.id);
    if (!verdict.ok) throw new BadRequestException(verdict.reason);
    const services = input.services !== undefined ? cleanServices(input.services)
      : cleanServices(products.map((x) => ({ name: x.name, description: x.description, price: x.priceAmount ?? x.price, image: x.image })));
    const tagline = clean(input.tagline ?? cms?.tagline, 120) || null;
    const about = clean(input.about ?? cms?.about, 900) || null;
    await this.scan({ businessName, tagline, about, services, category: cat.id });
    const goal = this.goalFor(cat.id, input.goal);
    const slug = await this.uniqueSlug(`${slugify(businessName)}-${slugify(city)}`.slice(0, 50));
    const phone = normalizePhone(cms?.phone ?? vendor?.phone);
    return this.prisma.leadspaceProfile.create({
      data: {
        vendorId, slug, category: cat.id, subcategory: clean(input.subcategory, 60) || null, city, serviceArea: clean(input.serviceArea, 120) || null, goal,
        mode: input.mode === 'EXISTING_PAGE' ? 'EXISTING_PAGE' : 'TEMPLATE', templateId: cat.id, businessName, tagline, about, phone, alertWhatsapp: normalizePhone(cms?.whatsapp) ?? phone,
        email: clean(input.email ?? cms?.email ?? vendor?.email, 120) || null, address: clean(input.address ?? cms?.address, 240) || null,
        mapsLink: URL_OK.test(clean(input.mapsLink ?? cms?.googleMaps, 500)) ? clean(input.mapsLink ?? cms?.googleMaps, 500) : null,
        heroImage: IMG_OK.test(clean(input.heroImage ?? cms?.banner, 500)) ? clean(input.heroImage ?? cms?.banner, 500) : null,
        services: services as unknown as Prisma.InputJsonValue, hours: clean(input.hours ?? cms?.businessHours, 160) || null,
        ...(input.offer !== undefined ? { offer: cleanOffer(input.offer) } : {}), ...(input.faqs !== undefined ? { faqs: cleanFaqs(input.faqs) as unknown as Prisma.InputJsonValue } : {}),
        ...(input.trust !== undefined ? { trust: cleanTrust(input.trust) as unknown as Prisma.InputJsonValue } : {}), ...(input.gallery !== undefined ? { gallery: cleanGallery(input.gallery) as unknown as Prisma.InputJsonValue } : {}),
        existingPageUrl: URL_OK.test(clean(input.existingPageUrl, 500)) ? clean(input.existingPageUrl, 500) : null,
        regulated: cat.regulated ? ({ [cat.regulated]: true, reviewed: false } as Prisma.InputJsonValue) : undefined,
        reraNumber: cat.regulated === 'realEstate' && reraLooksValid(input.reraNumber) ? clean(input.reraNumber, 60) : null,
        verificationStatus: 'UNVERIFIED', noindex: true, status: 'DRAFT', createdIpHash: ipHash,
      },
    });
  }

  /** The goal a trade may have. Advocates take enquiries only; clinics take appointments or enquiries; everyone else may choose among the five. */
  private goalFor(category: string, wanted?: string): EventType {
    const cat = categoryOf(category);
    const g = (wanted ?? cat?.goal ?? 'ENQUIRY') as EventType;
    if (!(EVENT_TYPES as readonly string[]).includes(g)) throw new BadRequestException('Choose what you want visitors to do.');
    if (cat?.regulated === 'advocate' && g !== 'ENQUIRY') throw new BadRequestException('Advocate pages take enquiries only.');
    if (cat?.regulated === 'clinic' && g !== 'APPOINTMENT' && g !== 'ENQUIRY') throw new BadRequestException('Clinic pages take appointment requests or enquiries only.');
    return g;
  }

  async save(vendorId: string, input: PageInput): Promise<LeadspaceProfile> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId } });
    if (!p) throw new NotFoundException('Create your page first.');
    if (p.status === 'SUSPENDED') throw new ForbiddenException('This page is suspended. Contact support to have it reviewed.');
    const category = input.category ? (categoryOf(input.category)?.id ?? null) : p.category;
    if (!category) throw new BadRequestException('Choose your trade from the list.');
    const data: Prisma.LeadspaceProfileUpdateInput = { category, templateId: category };
    const set = <K extends keyof PageInput>(k: K, fn: (v: NonNullable<PageInput[K]>) => unknown, col: string = k as string): void => { if (input[k] !== undefined) (data as Record<string, unknown>)[col] = fn(input[k] as NonNullable<PageInput[K]>); };
    set('city', (v) => clean(v, 60) || p.city); set('subcategory', (v) => clean(v, 60) || null); set('serviceArea', (v) => clean(v, 120) || null);
    set('businessName', (v) => clean(v, 80) || p.businessName); set('tagline', (v) => clean(v, 120) || null); set('about', (v) => clean(v, 900) || null);
    set('address', (v) => clean(v, 240) || null); set('hours', (v) => clean(v, 160) || null); set('email', (v) => clean(v, 120) || null);
    set('mapsLink', (v) => (URL_OK.test(clean(v, 500)) ? clean(v, 500) : null)); set('heroImage', (v) => (IMG_OK.test(clean(v, 500)) ? clean(v, 500) : null));
    set('existingPageUrl', (v) => (URL_OK.test(clean(v, 500)) ? clean(v, 500) : null));
    set('services', (v) => cleanServices(v)); set('faqs', (v) => cleanFaqs(v)); set('trust', (v) => cleanTrust(v)); set('gallery', (v) => cleanGallery(v));
    // A service saved without its picture gets the picture of the catalogue product with the same name (a save from an older screen dropped them).
    if (Array.isArray(data.services)) data.services = (await this.withCatalogueImages(vendorId, data.services as ServiceItem[])) as unknown as Prisma.InputJsonValue;
    if (input.offer !== undefined) data.offer = cleanOffer(input.offer);
    if (input.mode !== undefined) data.mode = input.mode === 'EXISTING_PAGE' ? 'EXISTING_PAGE' : 'TEMPLATE';
    if (input.goal !== undefined || input.category) data.goal = this.goalFor(category, input.goal ?? p.goal);
    if (input.reraNumber !== undefined) data.reraNumber = reraLooksValid(input.reraNumber) ? clean(input.reraNumber, 60) : null;
    const next = { ...p, ...(data as Record<string, unknown>) } as unknown as LeadspaceProfile;
    const verdict = checkBusiness(next.businessName, next.category);
    if (!verdict.ok) throw new BadRequestException(verdict.reason);
    await this.scan({ businessName: next.businessName, tagline: next.tagline, about: next.about, services: next.services, offer: next.offer, category: next.category });
    const catReg = categoryOf(category)?.regulated;
    if (catReg && !(p.regulated as Record<string, unknown> | null)?.[catReg]) data.regulated = { [catReg]: true, reviewed: false } as Prisma.InputJsonValue;
    return this.prisma.leadspaceProfile.update({ where: { id: p.id }, data });
  }

  private async withCatalogueImages(vendorId: string, services: ServiceItem[]): Promise<ServiceItem[]> {
    if (!services.some((x) => !x.image)) return services;
    const products = await this.prisma.vendorProduct.findMany({ where: { vendorId, active: true, image: { not: null } }, select: { name: true, image: true }, take: 200 });
    const byName = new Map(products.map((x) => [x.name.trim().toLowerCase(), String(x.image ?? '').trim()]));
    return services.map((x) => { if (x.image) return x; const img = byName.get(x.name.trim().toLowerCase()); return img && IMG_OK.test(img) ? { ...x, image: img } : x; });
  }

  private reviewed(p: LeadspaceProfile): boolean { return !categoryOf(p.category)?.regulated || Boolean((p.regulated as Record<string, unknown> | null)?.reviewed); }
  private noindexFor(p: LeadspaceProfile, verified: boolean): boolean { return !(verified && this.reviewed(p)); }

  async publish(vendorId: string): Promise<LeadspaceProfile> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId } });
    if (!p) throw new NotFoundException('Create your page first.');
    if (p.status === 'SUSPENDED') throw new ForbiddenException('This page is suspended. Contact support to have it reviewed.');
    const v = checkBusiness(p.businessName, p.category);
    if (!v.ok) throw new BadRequestException(v.reason);
    await this.scan({ businessName: p.businessName, tagline: p.tagline, about: p.about, services: p.services, offer: p.offer, category: p.category });
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { phone: true } });
    if (!(normalizePhone(p.alertWhatsapp) ?? normalizePhone(p.phone) ?? normalizePhone(vendor?.phone))) throw new BadRequestException('Add the WhatsApp number where we should send your alerts, then publish.');
    if (!cleanServices(p.services).length) throw new BadRequestException('Add at least one service or product before you publish.');
    return this.prisma.leadspaceProfile.update({ where: { id: p.id }, data: { status: 'PUBLISHED', noindex: this.noindexFor(p, p.verificationStatus === 'VERIFIED') } });
  }

  async unpublish(vendorId: string): Promise<LeadspaceProfile> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId } });
    if (!p) throw new NotFoundException('Create your page first.');
    if (p.status === 'SUSPENDED') throw new ForbiddenException('This page is suspended. Contact support to have it reviewed.');
    return this.prisma.leadspaceProfile.update({ where: { id: p.id }, data: { status: 'DRAFT', promotionEnabled: false } });
  }

  async verifyPhoneRequest(vendorId: string, phone: string): Promise<{ otpId: string; expiresInSeconds: number; sandbox: boolean }> {
    if (!(await this.prisma.leadspaceProfile.findUnique({ where: { vendorId }, select: { id: true } }))) throw new NotFoundException('Create your page first.');
    return this.otp.requestForVendor(vendorId, phone);
  }

  async verifyPhoneConfirm(vendorId: string, otpId: string, phone: string, code: string): Promise<LeadspaceProfile> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId } });
    if (!p) throw new NotFoundException('Create your page first.');
    const ten = await this.otp.confirmForVendor(vendorId, otpId, phone, code);
    return this.prisma.leadspaceProfile.update({ where: { id: p.id }, data: { phone: ten, alertWhatsapp: ten, verificationStatus: 'VERIFIED', noindex: p.status === 'PUBLISHED' ? this.noindexFor(p, true) : true } });
  }

  async setPromotion(vendorId: string, on: boolean): Promise<LeadspaceProfile> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId } });
    if (!p) throw new NotFoundException('Create your page first.');
    if (on) { const g = promotionGate(p); if (!g.ok) throw new BadRequestException(g.reason); }
    return this.prisma.leadspaceProfile.update({ where: { id: p.id }, data: { promotionEnabled: on } });
  }

  // — public —

  async publicPage(slug: string): Promise<PageModel> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { slug: clean(slug, 60) } });
    if (!p || p.status === 'DRAFT') throw new NotFoundException('This page is not available.');
    if (p.status === 'SUSPENDED') throw new GoneException('This page has been taken down.');
    return buildPage(p as unknown as PageSource);
  }

  async track(slug: string, kind: 'view' | 'cta' | 'form'): Promise<{ ok: true }> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { slug: clean(slug, 60) }, select: { id: true, vendorId: true, status: true } });
    if (!p || p.status !== 'PUBLISHED') return { ok: true };
    const day = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const inc = kind === 'view' ? { views: { increment: 1 } } : kind === 'cta' ? { ctaClicks: { increment: 1 } } : { formStarts: { increment: 1 } };
    await this.prisma.leadspaceDailyStat.upsert({
      where: { profileId_day: { profileId: p.id, day } },
      create: { profileId: p.id, vendorId: p.vendorId, day, views: kind === 'view' ? 1 : 0, ctaClicks: kind === 'cta' ? 1 : 0, formStarts: kind === 'form' ? 1 : 0 },
      update: inc,
    });
    if (kind === 'view') await this.prisma.leadspaceProfile.update({ where: { id: p.id }, data: { views: { increment: 1 } } });
    return { ok: true };
  }

  async report(slug: string, reason: string, note: string | undefined, ip?: string): Promise<{ received: true }> {
    const s = clean(slug, 60);
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { slug: s }, select: { id: true } });
    if (!p) throw new NotFoundException('This page is not available.');
    const ipHash = ip ? hashOf(`i:${ip}`) : null;
    if (ipHash && (await this.prisma.leadspaceAbuseReport.count({ where: { slug: s, ipHash, createdAt: { gte: new Date(Date.now() - 86_400_000) } } })) >= 2) return { received: true };
    await this.prisma.leadspaceAbuseReport.create({ data: { slug: s, reason: clean(reason, 40) || 'OTHER', note: clean(note, 500) || null, ipHash } });
    return { received: true };
  }

  async sitemapXml(): Promise<string> {
    const rows = await this.prisma.leadspaceProfile.findMany({ where: { status: 'PUBLISHED', verificationStatus: 'VERIFIED', noindex: false }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5000 });
    const NL = String.fromCharCode(10);
    return [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...rows.map((r) => `<url><loc>${pageUrl(r.slug)}</loc><lastmod>${r.updatedAt.toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq></url>`), `</urlset>`].join(NL);
  }

  // — Merchant Centre feed (product vendors) —

  private feedItems(p: LeadspaceProfile, products: { name: string; description: string | null; priceAmount: number | null; image: string | null }[]): { items: { id: string; title: string; description: string; link: string; image: string; price: string }[]; skipped: { name: string; why: string }[] } {
    const src = [...cleanServices(p.services).map((s) => ({ name: s.name, description: s.description ?? '', price: typeof s.price === 'number' ? s.price : null, image: s.image ?? p.heroImage ?? null })), ...products.map((x) => ({ name: x.name, description: x.description ?? '', price: x.priceAmount, image: x.image }))];
    const seen = new Set<string>();
    const items: { id: string; title: string; description: string; link: string; image: string; price: string }[] = [];
    const skipped: { name: string; why: string }[] = [];
    src.forEach((x, i) => {
      const key = x.name.toLowerCase();
      if (seen.has(key)) return; seen.add(key);
      if (x.price === null || x.price <= 0) return void skipped.push({ name: x.name, why: 'No price' });
      if (!x.image || !/^https?:\/\//.test(x.image)) return void skipped.push({ name: x.name, why: 'No picture (Merchant Centre needs one)' });
      items.push({ id: `${p.slug}-${i + 1}`, title: x.name.slice(0, 150), description: (x.description || `${x.name} from ${p.businessName}, ${p.city}`).slice(0, 4900), link: `${pageUrl(p.slug)}#item-${i + 1}`, image: x.image, price: `${x.price.toFixed(2)} INR` });
    });
    return { items, skipped };
  }

  private async feedFor(p: LeadspaceProfile): Promise<{ items: ReturnType<LeadspaceProfileService['feedItems']>['items']; skipped: { name: string; why: string }[] }> {
    const products = await this.prisma.vendorProduct.findMany({ where: { vendorId: p.vendorId, active: true }, take: 200, select: { name: true, description: true, priceAmount: true, image: true } });
    return this.feedItems(p, products);
  }

  async feedStatus(vendorId: string): Promise<{ eligible: boolean; url: string; items: number; skipped: { name: string; why: string }[] }> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId } });
    if (!p) throw new NotFoundException('Create your page first.');
    const f = await this.feedFor(p);
    const base = (process.env.PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com').replace(/\/+$/, '');
    return { eligible: p.goal === 'CART_ORDER', url: `${base}/leadspace/public/feed/${p.slug}.xml`, items: f.items.length, skipped: f.skipped };
  }

  async feedXml(slug: string): Promise<string> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { slug: clean(slug, 60) } });
    if (!p || p.status !== 'PUBLISHED' || p.goal !== 'CART_ORDER') throw new NotFoundException('There is no product feed for this page.');
    const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const f = await this.feedFor(p);
    const NL = String.fromCharCode(10);
    return [`<?xml version="1.0" encoding="UTF-8"?>`, `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>`, `<title>${esc(p.businessName)}</title>`, `<link>${esc(pageUrl(p.slug))}</link>`, `<description>${esc(p.businessName)} products</description>`,
      ...f.items.map((i) => `<item><g:id>${esc(i.id)}</g:id><title>${esc(i.title)}</title><description>${esc(i.description)}</description><link>${esc(i.link)}</link><g:image_link>${esc(i.image)}</g:image_link><g:availability>in_stock</g:availability><g:price>${esc(i.price)}</g:price><g:condition>new</g:condition><g:brand>${esc(p.businessName)}</g:brand></item>`),
      `</channel></rss>`].join(NL);
  }

  // — admin —

  async adminList(q: { status?: string; verification?: string; regulated?: string; search?: string; take?: number; skip?: number }): Promise<{ total: number; rows: unknown[] }> {
    const where: Prisma.LeadspaceProfileWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.verification) where.verificationStatus = q.verification;
    if (q.regulated === 'pending') where.OR = CATEGORIES.filter((c) => c.regulated).map((c) => ({ category: c.id }));
    if (q.search) where.AND = [{ OR: [{ businessName: { contains: q.search, mode: 'insensitive' } }, { slug: { contains: q.search.toLowerCase() } }, { city: { contains: q.search, mode: 'insensitive' } }] }];
    const [total, rows] = await Promise.all([this.prisma.leadspaceProfile.count({ where }), this.prisma.leadspaceProfile.findMany({ where, orderBy: { updatedAt: 'desc' }, take: Math.min(q.take ?? 50, 200), skip: q.skip ?? 0 })]);
    const reports = await this.prisma.leadspaceAbuseReport.groupBy({ by: ['slug'], where: { status: 'OPEN', slug: { in: rows.map((r) => r.slug) } }, _count: true });
    return { total, rows: rows.map((r) => ({ ...r, openReports: reports.find((x) => x.slug === r.slug)?._count ?? 0, regulatedKind: categoryOf(r.category)?.regulated ?? null, reviewed: this.reviewed(r) })) };
  }

  async suspend(id: string, reason: string): Promise<LeadspaceProfile> {
    return this.prisma.leadspaceProfile.update({ where: { id }, data: { status: 'SUSPENDED', suspendedReason: clean(reason, 300) || 'Suspended by an administrator', promotionEnabled: false, noindex: true } });
  }

  async unsuspend(id: string): Promise<LeadspaceProfile> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('We could not find that page.');
    return this.prisma.leadspaceProfile.update({ where: { id }, data: { status: 'DRAFT', suspendedReason: null, noindex: this.noindexFor(p, p.verificationStatus === 'VERIFIED') } });
  }

  /** Regulated trades are reviewed by a person before the page is indexed or promoted. `allowPromotion` is the per-vendor switch for advocates and clinics. */
  async reviewRegulated(id: string, approve: boolean, allowPromotion: boolean): Promise<LeadspaceProfile> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('We could not find that page.');
    const flags = { ...obj(p.regulated), reviewed: approve, adminAllowPromotion: approve && allowPromotion };
    const next = { ...p, regulated: flags } as unknown as LeadspaceProfile;
    return this.prisma.leadspaceProfile.update({ where: { id }, data: { regulated: flags as Prisma.InputJsonValue, noindex: p.status === 'PUBLISHED' ? this.noindexFor(next, p.verificationStatus === 'VERIFIED') : true, promotionEnabled: approve && allowPromotion ? p.promotionEnabled : false } });
  }

  reports(status = 'OPEN'): Promise<unknown[]> { return this.prisma.leadspaceAbuseReport.findMany({ where: { status }, orderBy: { createdAt: 'desc' }, take: 200 }); }

  async actionReport(id: string, action: 'ACTIONED' | 'DISMISSED', suspendReason?: string): Promise<unknown> {
    const r = await this.prisma.leadspaceAbuseReport.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('We could not find that report.');
    if (action === 'ACTIONED' && suspendReason) {
      const p = await this.prisma.leadspaceProfile.findUnique({ where: { slug: r.slug }, select: { id: true } });
      if (p) await this.suspend(p.id, suspendReason);
    }
    return this.prisma.leadspaceAbuseReport.update({ where: { id }, data: { status: action } });
  }

}
