import { Injectable } from '@nestjs/common';
import { Campaign, CampaignLead, CampaignPage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CATEGORIES, categoryOf, hashOf, normalizePhone, phoneHash, slugify } from './leadspace.types';

/** Marker stored in LeadspaceProfile.createdIpHash for a page made by this import (a real value is always a 64-character hash, so it can never collide). */
export const MIGRATED_PAGE_MARKER = 'migrated-campaign-page';
export const LEGACY_LEAD_PREFIX = 'legacy:';

const INDUSTRY_TO_CATEGORY: Record<string, string> = {
  realestate: 'real-estate', salon: 'salon-beauty', clinic: 'clinic', diagnostics: 'clinic', restaurant: 'restaurant-food', retail: 'shop-retail', agriculture: 'shop-retail',
  photography: 'photography-events', events: 'photography-events', education: 'tutor', coaching: 'tutor', construction: 'builders-interiors', professional: 'freelancer',
  finance: 'freelancer', technology: 'startup',
};
/** Industries with no matching LeadSpace trade (travel, hotel, gym, logistics, automobile, general) start as the general "freelancer" page; the vendor can change the trade. */
export const categoryForIndustry = (industry: string | null | undefined): string => INDUSTRY_TO_CATEGORY[String(industry ?? '').toLowerCase()] ?? 'freelancer';

const LEAD_STATUS: Record<string, string> = { new: 'DELIVERED', contacted: 'CONTACTED', 'follow-up': 'CONTACTED', followup: 'CONTACTED', interested: 'CONTACTED', won: 'WON', converted: 'WON', closed: 'WON', lost: 'LOST', 'not-interested': 'LOST' };
const CAMPAIGN_DONE = new Set(['completed', 'done', 'finished', 'ended']);

export interface VendorImportPlan {
  vendorId: string; businessName: string; industry: string | null;
  page: { action: 'CREATE' | 'HAS_PROFILE' | 'NONE'; slug?: string; category?: string; city?: string; cityGuessed?: boolean; campaignPageId?: string; extraPages: string[] };
  campaigns: { total: number; toImport: number };
  leads: { total: number; toImport: number };
  /** managed-ads billing records are left exactly where they are (they hold invoice links) */
  domainCampaignRecords: number;
}
export interface ImportResult extends VendorImportPlan { applied: boolean; created: { profile: boolean; postJobs: number; leadEvents: number } }

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const text = (v: unknown, n: number): string => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, n);

/** "12 Lake View Road, Adyar, Chennai 600020" -> "Chennai". Falls back to "India" and says it guessed. */
export function guessCity(address: string | null | undefined): { city: string; guessed: boolean } {
  const parts = String(address ?? '').split(',').map((p) => p.replace(/\d+/g, '').replace(/\s+/g, ' ').trim()).filter((p) => /[A-Za-z]{3,}/.test(p));
  const last = parts[parts.length - 1];
  return last ? { city: last.slice(0, 60), guessed: false } : { city: 'India', guessed: true };
}

function firstCampaignText(c: Campaign): string {
  const content = (c.content && typeof c.content === 'object' ? c.content : {}) as Record<string, unknown>;
  for (const v of Object.values(content)) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object') { const o = v as Record<string, unknown>; const t = o.caption ?? o.text ?? o.message ?? o.body; if (typeof t === 'string' && t.trim()) return t.trim(); }
  }
  return c.description?.trim() || c.name;
}

/**
 * Phase 7: Campaigns, landing pages and DomainCampaign become LeadSpace, with nothing lost. This is a COPY: every old row stays where it is.
 *  - the vendor's newest active landing page becomes their LeadSpace page, as a DRAFT (the old /go/<slug> keeps serving until they publish it);
 *  - each campaign becomes a history entry on the Promote tab;
 *  - each campaign lead becomes a lead in the Leads tab (marked as imported, never charged);
 *  - DomainCampaign billing records are not touched.
 * Idempotent: running it again creates nothing twice. Everything it creates can be found again for the rollback (see the markers above).
 */
@Injectable()
export class LegacyImportService {
  constructor(private readonly prisma: PrismaService) {}

  async plan(vendorId: string): Promise<VendorImportPlan | null> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, businessName: true, industry: true } });
    if (!vendor) return null;
    const [profile, pages, campaigns, leads, records] = await Promise.all([
      this.prisma.leadspaceProfile.findUnique({ where: { vendorId }, select: { id: true, slug: true } }),
      this.prisma.campaignPage.findMany({ where: { vendorId }, orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }] }),
      this.prisma.campaign.findMany({ where: { vendorId }, select: { id: true } }),
      this.prisma.campaignLead.findMany({ where: { vendorId }, select: { id: true } }),
      this.prisma.domainCampaignRecord.count({ where: { vendorId } }),
    ]);
    const doneCampaigns = campaigns.length ? await this.prisma.postJob.findMany({ where: { vendorId }, select: { content: true } }) : [];
    const doneIds = new Set(doneCampaigns.map((j) => (j.content as { legacy?: { campaignId?: string } } | null)?.legacy?.campaignId).filter(Boolean) as string[]);
    const doneLeads = new Set((await this.prisma.leadEvent.findMany({ where: { vendorId, idempotencyKey: { startsWith: LEGACY_LEAD_PREFIX } }, select: { idempotencyKey: true } })).map((l) => l.idempotencyKey));
    const main = pages[0];
    const page: VendorImportPlan['page'] = profile ? { action: 'HAS_PROFILE', slug: profile.slug, extraPages: [] } : main ? (() => {
      const c = guessCity(main.address);
      return { action: 'CREATE' as const, slug: main.slug, category: categoryForIndustry(vendor.industry), city: c.city, cityGuessed: c.guessed, campaignPageId: main.id, extraPages: pages.slice(1).map((p) => p.slug) };
    })() : { action: 'NONE', extraPages: [] };
    if (profile && pages.length) page.extraPages = pages.map((p) => p.slug);
    return {
      vendorId, businessName: vendor.businessName, industry: vendor.industry, page,
      campaigns: { total: campaigns.length, toImport: campaigns.filter((c) => !doneIds.has(c.id)).length },
      leads: { total: leads.length, toImport: leads.filter((l) => !doneLeads.has(`${LEGACY_LEAD_PREFIX}${l.id}`)).length },
      domainCampaignRecords: records,
    };
  }

  /** Vendors that have anything to import, for the dry-run list. */
  async vendorsWithLegacy(): Promise<string[]> {
    const [a, b, c] = await Promise.all([
      this.prisma.campaignPage.findMany({ select: { vendorId: true }, distinct: ['vendorId'] }),
      this.prisma.campaign.findMany({ select: { vendorId: true }, distinct: ['vendorId'] }),
      this.prisma.campaignLead.findMany({ select: { vendorId: true }, distinct: ['vendorId'] }),
    ]);
    return [...new Set([...a, ...b, ...c].map((x) => x.vendorId))];
  }

  async run(vendorId: string, apply: boolean): Promise<ImportResult | null> {
    const plan = await this.plan(vendorId);
    if (!plan) return null;
    const out: ImportResult = { ...plan, applied: apply, created: { profile: false, postJobs: 0, leadEvents: 0 } };
    if (!apply) return out;

    const vendor = await this.prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { industry: true, businessName: true, phone: true, email: true } });

    // 1. the landing page
    let profileId: string | null = (await this.prisma.leadspaceProfile.findUnique({ where: { vendorId }, select: { id: true } }))?.id ?? null;
    if (plan.page.action === 'CREATE' && plan.page.campaignPageId) {
      const cp = await this.prisma.campaignPage.findUniqueOrThrow({ where: { id: plan.page.campaignPageId } });
      profileId = (await this.createProfileFrom(cp, vendor, plan.page.category as string, plan.page.city as string)).id;
      out.created.profile = true;
    }

    // 2. campaigns -> history on the Promote tab (kept paused: nothing posts by itself)
    const campaigns = await this.prisma.campaign.findMany({ where: { vendorId } });
    if (campaigns.length) {
      const existing = await this.prisma.postJob.findMany({ where: { vendorId }, select: { content: true } });
      const have = new Set(existing.map((j) => (j.content as { legacy?: { campaignId?: string } } | null)?.legacy?.campaignId).filter(Boolean) as string[]);
      const todo = campaigns.filter((c) => !have.has(c.id));
      if (todo.length) {
        const planRow = await this.prisma.promotionPlan.upsert({ where: { vendorId }, create: { vendorId, channels: [], schedule: { perWeek: 1 }, status: 'PAUSED' }, update: {} });
        await this.prisma.postJob.createMany({
          data: todo.map((c): Prisma.PostJobCreateManyInput => ({
            planId: planRow.id, vendorId, channel: 'MANUAL', scheduledFor: c.startDate ?? c.createdAt, theme: text(c.name, 80),
            content: { caption: firstCampaignText(c).slice(0, 1800), hashtags: [], source: 'template', legacy: { campaignId: c.id, name: c.name, status: c.status, channels: c.channels, content: c.content, walletCost: c.walletCost, analytics: c.analytics, startDate: c.startDate, endDate: c.endDate } } as unknown as Prisma.InputJsonValue,
            status: CAMPAIGN_DONE.has(c.status.toLowerCase()) ? 'POSTED' : 'DRAFT', manualTask: false, manualTarget: 'Imported from Campaigns', manualDoneAt: CAMPAIGN_DONE.has(c.status.toLowerCase()) ? c.endDate ?? c.updatedAt : null,
            approvalLog: [{ at: new Date().toISOString(), by: 'import', action: 'imported from Campaigns', note: c.name }] as unknown as Prisma.InputJsonValue, createdAt: c.createdAt,
          })),
        });
        out.created.postJobs = todo.length;
      }
    }

    // 3. campaign leads -> the Leads tab
    const leads = await this.prisma.campaignLead.findMany({ where: { vendorId }, orderBy: { createdAt: 'asc' } });
    if (leads.length) {
      const done = new Set((await this.prisma.leadEvent.findMany({ where: { vendorId, idempotencyKey: { startsWith: LEGACY_LEAD_PREFIX } }, select: { idempotencyKey: true } })).map((l) => l.idempotencyKey));
      const todo = leads.filter((l) => !done.has(`${LEGACY_LEAD_PREFIX}${l.id}`));
      if (todo.length) {
        await this.prisma.leadEvent.createMany({ data: todo.map((l) => this.leadToEvent(l, vendorId, profileId)) });
        out.created.leadEvents = todo.length;
      }
    }
    return out;
  }

  private leadToEvent(l: CampaignLead, vendorId: string, profileId: string | null): Prisma.LeadEventCreateManyInput {
    const ten = normalizePhone(l.phone);
    return {
      vendorId, profileId, type: 'ENQUIRY', customerName: text(l.name, 80) || 'Customer', customerPhone: ten ?? text(l.phone, 20), phoneHash: ten ? phoneHash(ten) : hashOf(`legacy:${l.id}`),
      payload: { message: text(l.message, 1000) || 'Enquiry imported from your earlier campaign page', imported: true, ...(l.notes ? { notes: text(l.notes, 500) } : {}) } as Prisma.InputJsonValue,
      source: 'legacy-campaign', status: LEAD_STATUS[String(l.status).toLowerCase()] ?? 'DELIVERED', priceChargedPaise: 0, idempotencyKey: `${LEGACY_LEAD_PREFIX}${l.id}`,
      deliveredAt: l.createdAt, createdAt: l.createdAt, vendorNote: l.notes ? text(l.notes, 500) : null,
    };
  }

  private async createProfileFrom(cp: CampaignPage, vendor: { industry: string | null; businessName: string; phone: string | null; email: string }, category: string, city: string): Promise<{ id: string }> {
    const cat = categoryOf(category) ?? CATEGORIES[3];
    let slug = cp.slug;
    if (await this.prisma.leadspaceProfile.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-ls`;
    if (await this.prisma.leadspaceProfile.findUnique({ where: { slug }, select: { id: true } })) slug = `${slugify(vendor.businessName)}-${Date.now().toString(36)}`;
    const benefits = arr<string>(cp.benefits).map((b) => text(b, 80)).filter(Boolean).slice(0, 8);
    const quotes = arr<{ name?: string; text?: string }>(cp.testimonials).filter((t) => t?.text).slice(0, 3).map((t) => text(`"${t.text}" - ${t.name ?? 'a customer'}`, 120));
    const products = await this.prisma.vendorProduct.findMany({ where: { vendorId: cp.vendorId, active: true }, take: 40, select: { name: true, description: true, price: true, priceAmount: true, image: true } });
    const services = products.map((p) => ({ name: text(p.name, 120), price: p.priceAmount ?? null, description: text(p.description, 240) || null, image: p.image && /^https?:\/\//.test(p.image) ? p.image : null })).filter((s) => s.name);
    const wa = normalizePhone(cp.whatsapp) ?? normalizePhone(cp.phone);
    const gallery = arr<string>(cp.photos).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 12);
    return this.prisma.leadspaceProfile.create({
      data: {
        vendorId: cp.vendorId, slug, category: cat.id, city, goal: 'ENQUIRY', mode: 'TEMPLATE', templateId: cat.id,
        businessName: text(vendor.businessName, 80), tagline: text(cp.subheadline ?? cp.headline, 120) || null, about: text(cp.aboutText, 900) || null,
        phone: normalizePhone(cp.phone), alertWhatsapp: wa, email: text(cp.email ?? vendor.email, 120) || null, address: text(cp.address, 240) || null,
        mapsLink: cp.mapsLink && /^https?:\/\//.test(cp.mapsLink) ? cp.mapsLink : null, heroImage: cp.heroImage && /^https?:\/\//.test(cp.heroImage) ? cp.heroImage : null,
        services: services as unknown as Prisma.InputJsonValue, gallery: gallery.length ? (gallery as unknown as Prisma.InputJsonValue) : undefined,
        trust: [...benefits, ...quotes].slice(0, 8) as unknown as Prisma.InputJsonValue,
        regulated: cat.regulated ? ({ [cat.regulated]: true, reviewed: false } as Prisma.InputJsonValue) : undefined,
        verificationStatus: 'UNVERIFIED', noindex: true, status: 'DRAFT', views: cp.views, createdIpHash: MIGRATED_PAGE_MARKER,
      },
      select: { id: true },
    });
  }

  /**
   * Undo an import for one vendor: only rows this import made, and only if untouched since. A page that was published, verified or has real events
   * is kept (the report says so). Dry run unless `apply`.
   */
  async rollback(vendorId: string, apply: boolean): Promise<{ profileRemoved: boolean; profileKept: string | null; postJobs: number; leadEvents: number; applied: boolean }> {
    const profile = await this.prisma.leadspaceProfile.findFirst({ where: { vendorId, createdIpHash: MIGRATED_PAGE_MARKER } });
    let removable = false; let kept: string | null = null;
    if (profile) {
      const real = await this.prisma.leadEvent.count({ where: { vendorId, NOT: { idempotencyKey: { startsWith: LEGACY_LEAD_PREFIX } } } });
      removable = profile.status === 'DRAFT' && profile.verificationStatus === 'UNVERIFIED' && real === 0;
      if (!removable) kept = 'The page was published, verified or has real customer requests, so it is kept.';
    }
    const jobs = await this.prisma.postJob.findMany({ where: { vendorId, manualTarget: 'Imported from Campaigns' }, select: { id: true } });
    const leads = await this.prisma.leadEvent.count({ where: { vendorId, source: 'legacy-campaign', priceChargedPaise: 0, idempotencyKey: { startsWith: LEGACY_LEAD_PREFIX } } });
    if (apply) {
      await this.prisma.$transaction(async (tx) => {
        await tx.leadEvent.deleteMany({ where: { vendorId, source: 'legacy-campaign', priceChargedPaise: 0, idempotencyKey: { startsWith: LEGACY_LEAD_PREFIX } } });
        await tx.postJob.deleteMany({ where: { id: { in: jobs.map((j) => j.id) } } });
        if (profile && removable) await tx.leadspaceProfile.delete({ where: { id: profile.id } });
      });
    }
    return { profileRemoved: Boolean(profile && removable), profileKept: kept, postJobs: jobs.length, leadEvents: leads, applied: apply };
  }
}
