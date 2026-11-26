import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { splitAddress } from '../site-publish/content/content-adapter';
import { ListName, validateList } from '../v3-website/core/managed-doc';
import { WebsiteService } from '../v3-website/website.service';
import { ContentPack, CurrentContent, ImportPlan, planImport, validatePack, VendorFacts } from './core/content-pack-core';

export interface ImportReport {
  dryRun: boolean; vendorId: string; packType: string;
  wrote: { fields: string[]; lists: string[]; seoHome: boolean; itemsCreated: string[] };
  skipped: Array<{ what: string; reason: string }>;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const reasonOf = (e: unknown): string => {
  const r = (e as { getResponse?: () => unknown })?.getResponse?.();
  const m = typeof r === 'string' ? r : (r as { message?: unknown; code?: unknown } | undefined)?.message ?? (r as { code?: unknown } | undefined)?.code;
  return typeof m === 'string' ? m.slice(0, 200) : e instanceof Error ? e.name : 'could not be saved';
};

/**
 * Content pack import (E5, staff only). Loads a pack's default wording and structure into one vendor's draft: the managed-document fields and lists through the Website manager (so every rule, limit
 * and wording filter of the manager applies), and the pack's services as the vendor's own items, marked as starter content (the vendor edits them to make them real; an indicative price stays hidden until
 * then). Nothing the vendor already has is overwritten (see content-pack-core.ts); a dry run writes nothing and returns the same report. The draft is published by the vendor, or by staff acting for them.
 */
@Injectable()
export class ContentPackService {
  constructor(private readonly prisma: PrismaService, private readonly web: WebsiteService) {}

  /** What the vendor already has, from their draft over live document and from the older site document (a starter text there is not the vendor's own and may be replaced). */
  private async currentOf(vendorId: string): Promise<{ current: CurrentContent; facts: Omit<VendorFacts, 'vendorId'>; industry: string | null }> {
    const [vendor, cms, products, docs] = await Promise.all([
      this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { businessName: true, name: true, phone: true, industry: true } }),
      this.prisma.vendorCMS.findUnique({ where: { vendorId }, select: { about: true, tagline: true, address: true, extras: true } }),
      this.prisma.vendorProduct.findMany({ where: { vendorId }, select: { name: true } }),
      this.web.draftAndLive(vendorId),
    ]);
    if (!vendor) throw new NotFoundException({ code: 'UNKNOWN_VENDOR', message: 'That business does not exist.' });
    const d = docs.draft;
    const ex = obj(cms?.extras); const sample = obj(ex.sample);
    const real = (key: string, value: unknown): boolean => (typeof value === 'string' ? value.trim() !== '' : Array.isArray(value) ? value.length > 0 : false) && sample[key] !== true;
    const fields: Record<string, string> = { ...d.fields };
    const legacy: Array<[string, string, unknown]> = [['about.text', 'about', cms?.about], ['hero.title', 'headline', ex.headline], ['hero.subtitle', 'subline', ex.subline], ['cta.label', 'ctaLabel', ex.ctaLabel]];
    for (const [fieldKey, sampleKey, value] of legacy) if (!fields[fieldKey] && real(sampleKey, value)) fields[fieldKey] = String(value);
    const lists: Partial<Record<ListName, unknown[]>> = { ...d.lists };
    const legacyLists: Array<[ListName, string]> = [['faqs', 'faq'], ['trust', 'trust'], ['steps', 'steps'], ['team', 'team']];
    for (const [name, key] of legacyLists) if ((lists[name] ?? []).length === 0 && real(key, ex[key])) lists[name] = ex[key] as unknown[];
    const branches = (d.lists.branches ?? []).map((b) => String(b.name)).filter(Boolean);
    return {
      industry: vendor.industry,
      facts: { businessName: vendor.businessName, owner: vendor.name ?? '', town: splitAddress(String(d.fields['contact.address'] ?? cms?.address ?? '')).city, phone: String(d.fields['contact.phone'] ?? vendor.phone ?? ''), branches: branches.join(', ') },
      current: {
        fields, lists, seoHome: !!d.seo?.home, existingNames: products.map((p) => p.name),
        existingDetailIds: (d.lists.itemDetails ?? []).map((r) => String(r.itemId)),
      },
    };
  }

  async plan(vendorId: string, raw: unknown): Promise<{ pack: ContentPack; plan: ImportPlan; industry: string | null }> {
    const v = validatePack(raw);
    if (!v.ok) throw new UnprocessableEntityException({ code: 'CONTENT_PACK_INVALID', message: 'The content pack is not valid.', errors: v.errors });
    const { current, facts, industry } = await this.currentOf(vendorId);
    return { pack: v.pack, plan: planImport(v.pack, { vendorId, ...facts }, current), industry };
  }

  async import(vendorId: string, raw: unknown, actor: Actor, o: { dryRun?: boolean } = {}): Promise<ImportReport> {
    const { pack, plan, industry } = await this.plan(vendorId, raw);
    const report: ImportReport = { dryRun: o.dryRun === true, vendorId, packType: pack.type, wrote: { fields: [], lists: [], seoHome: false, itemsCreated: [] }, skipped: [...plan.skipped] };
    if (report.dryRun) { report.wrote = { fields: plan.fields.map((f) => f.key), lists: plan.lists.map((l) => l.name), seoHome: plan.seoHome !== null, itemsCreated: plan.items.map((i) => i.name) }; return report; }

    // 1. the services, as starter items the vendor makes real by editing them
    const created: Array<{ id: string; item: ImportPlan['items'][number] }> = [];
    for (const item of plan.items) {
      const price = item.priceFrom ? `From ₹${item.priceFrom.amount}${item.priceFrom.unit ? ` ${item.priceFrom.unit}` : ''}` : null;
      try {
        const row = await this.prisma.vendorProduct.create({
          data: {
            vendorId, name: item.name, description: item.detail.summary || item.description, price, priceAmount: item.priceFrom?.amount ?? null, category: item.group || null, active: true, industryType: industry ?? 'general',
            customFields: { sample: 'true', ...(item.priceFrom ? { samplePrice: 'true' } : {}), importedFrom: `content-pack:${pack.type}`, packSlug: item.slug } as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
        created.push({ id: row.id, item }); report.wrote.itemsCreated.push(item.name);
      } catch (e) { report.skipped.push({ what: `service ${item.name}`, reason: reasonOf(e) }); }
    }

    // 2. the draft: fields, lists, the home page search text, then the item pages' details
    for (const f of plan.fields) {
      try { await this.web.save(vendorId, actor, { kind: 'field', key: f.key, value: f.value }); report.wrote.fields.push(f.key); } catch (e) { report.skipped.push({ what: f.key, reason: reasonOf(e) }); }
    }
    for (const l of plan.lists) {
      try { await this.web.save(vendorId, actor, { kind: 'list', name: l.name, items: l.items }); report.wrote.lists.push(l.name); } catch (e) { report.skipped.push({ what: `list ${l.name}`, reason: reasonOf(e) }); }
    }
    if (plan.seoHome) {
      try { await this.web.save(vendorId, actor, { kind: 'seo', pageKey: 'home', edit: plan.seoHome }); report.wrote.seoHome = true; } catch (e) { report.skipped.push({ what: 'home page search text', reason: reasonOf(e) }); }
    }
    if (created.length) {
      const existing = (await this.web.draftAndLive(vendorId)).draft.lists.itemDetails ?? [];
      const rows = [...existing, ...created.map((c) => ({ itemId: c.id, summary: c.item.detail.summary, details: c.item.detail.details, faqs: c.item.detail.faqs }))].map((r) => ({ ...r }));
      const ok = validateList('itemDetails', rows);
      if (!ok.ok) report.skipped.push({ what: 'item pages', reason: ok.message });
      else { try { await this.web.save(vendorId, actor, { kind: 'list', name: 'itemDetails', items: ok.items }); report.wrote.lists.push('itemDetails'); } catch (e) { report.skipped.push({ what: 'item pages', reason: reasonOf(e) }); } }
    }
    return report;
  }
}
