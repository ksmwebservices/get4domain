import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SiteDocService } from './site-doc.service';
import { StarterService } from './starter.service';
import { PackConfig, fillPlaceholders, validatePack } from './pack.types';
import { planStarterSeed } from './industry-seeds';
import { FAMILIES, designsFor } from './families';

const KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Category Packs: create, copy, edit, switch on or off, preview, and generate a vendor's site from one. No pack is ever needed in code. */
@Injectable()
export class PacksService {
  constructor(private readonly prisma: PrismaService, private readonly site: SiteDocService, private readonly starter: StarterService) {}

  /**
   * A pack the admin typed with only the essentials (a flow family and the starter content) becomes a complete pack: the four designs of that family in the chosen
   * theme colours, the default design, and every older field filled from the starter content. Nothing about a new category needs code.
   */
  completePack(c: Partial<PackConfig>): PackConfig {
    if (!c.family || !FAMILIES[c.family] || !c.seed) return c as PackConfig;
    const fam = FAMILIES[c.family];
    const designs = c.designs ?? designsFor(c.family, c.themeKey ?? fam.themes[0]);
    const seed = c.seed;
    const noun = c.item?.noun ?? 'item';
    return {
      keywords: c.keywords ?? [], goal: c.goal ?? fam.goal, ctaLabel: c.ctaLabel ?? seed.cta ?? 'Get in touch',
      sections: c.sections ?? ['hero', 'services', 'about', 'gallery', 'testimonials', 'faq', 'contact'],
      item: c.item ?? { kind: fam.itemKind, noun, nounPlural: `${noun}s` },
      defaults: c.defaults ?? { tagline: seed.tagline, about: seed.about, headline: seed.headline, subline: seed.subline, trust: seed.trust ?? [], faq: seed.faq ?? [] },
      themeKey: c.themeKey ?? designs[0].themeKey,
      layouts: c.layouts ?? { hero: 'overlay', about: 'split', services: 'cards', gallery: 'mosaic', testimonials: 'cards', contact: 'card' },
      seoType: c.seoType ?? fam.seoType,
      aiPrompts: c.aiPrompts ?? { about: `Write a warm, honest 80-word About text for {business}, {city}. No claims that cannot be checked.`, tagline: 'A short tagline (under 8 words) for {business}, {city}.', images: `Three photo ideas: ${fam.imageMood}.` },
      family: c.family, designs, defaultDesign: c.defaultDesign ?? designs[0].key, seed,
    };
  }

  list() { return this.prisma.categoryPack.findMany({ orderBy: { name: 'asc' } }); }

  async get(key: string) {
    const p = await this.prisma.categoryPack.findUnique({ where: { key } });
    if (!p) throw new NotFoundException('We could not find that pack.');
    return p;
  }

  private check(key: string | undefined, name: string, config: unknown): void {
    if (key !== undefined && !KEY_RE.test(key)) throw new BadRequestException('The pack key can only use lower-case letters, numbers and dashes (for example "salon").');
    if (!name || name.trim().length < 2 || name.length > 80) throw new BadRequestException('Give the pack a name of 2 to 80 characters.');
    const problems = validatePack(config);
    if (problems.length) throw new BadRequestException(problems.join(' '));
  }

  async create(key: string, name: string, input: PackConfig, actor: string) {
    const config = this.completePack(input);
    this.check(key, name, config);
    if (await this.prisma.categoryPack.findUnique({ where: { key } })) throw new ConflictException('A pack with this key already exists. Choose another key, or edit that pack.');
    return this.prisma.categoryPack.create({ data: { key, name: name.trim(), config: config as unknown as Prisma.InputJsonValue, createdBy: actor } });
  }

  async update(key: string, patch: { name?: string; enabled?: boolean; config?: PackConfig }) {
    const cur = await this.get(key);
    const name = patch.name ?? cur.name;
    const config = patch.config ? this.completePack(patch.config) : (cur.config as unknown as PackConfig);
    this.check(undefined, name, config);
    return this.prisma.categoryPack.update({ where: { key }, data: { name: name.trim(), enabled: patch.enabled ?? cur.enabled, config: config as unknown as Prisma.InputJsonValue } });
  }

  async duplicate(key: string, newKey: string, newName: string, actor: string) {
    const src = await this.get(key);
    return this.create(newKey, newName, src.config as unknown as PackConfig, actor);
  }

  /**
   * Creates the 24 starter categories that are missing, each with its flow family, four designs and starter content. A pack that already exists keeps everything an admin
   * edited; one that has no designs yet (an older starter pack) gets the family, the four designs and the starter content ADDED, and nothing else changes.
   */
  async seedStarter(actor: string): Promise<{ created: string[]; upgraded: string[]; kept: number }> {
    const plan = planStarterSeed(await this.prisma.categoryPack.findMany({ select: { key: true, config: true } }));
    const created: string[] = []; const upgraded: string[] = [];
    for (const p of plan.create) { await this.prisma.categoryPack.create({ data: { key: p.key, name: p.name, config: p.config as unknown as Prisma.InputJsonValue, createdBy: actor } }); created.push(p.key); }
    for (const p of plan.upgrade) { await this.prisma.categoryPack.update({ where: { key: p.key }, data: { config: p.config as unknown as Prisma.InputJsonValue } }); upgraded.push(p.key); }
    const kept = plan.kept;
    return { created, upgraded, kept };
  }

  /** A pack filled with sample company details, so staff can see what a vendor would start with. Writes nothing. */
  async preview(key: string) {
    const p = await this.get(key);
    const c = p.config as unknown as PackConfig;
    const v = { business: `Sample ${p.name}`, city: 'Chennai', phone: '9876543210' };
    return {
      key: p.key, name: p.name, config: c,
      sample: {
        businessName: v.business, tagline: fillPlaceholders(c.defaults.tagline, v), about: fillPlaceholders(c.defaults.about, v),
        headline: fillPlaceholders(c.defaults.headline, v), subline: fillPlaceholders(c.defaults.subline, v),
        trust: c.defaults.trust.map((t) => fillPlaceholders(t, v)), faq: c.defaults.faq.map((f) => ({ q: fillPlaceholders(f.q, v), a: fillPlaceholders(f.a, v) })),
        layout: { themeKey: c.themeKey, ...c.layouts },
        family: c.family ?? null, designs: (c.designs ?? []).map((d) => ({ key: d.key, name: d.name, enabled: d.enabled !== false, themeKey: d.themeKey })), items: (c.seed?.items ?? []).map((i) => i.title),
      },
    };
  }

  /**
   * Onboarding: the vendor picked a category and typed their company details. The site starts as a DRAFT filled from the pack (their own words win over the
   * pack's); the vendor then edits it in Website Manager and publishes. Needs the new Website Manager to be switched on for the vendor.
   */
  async generate(vendorId: string, packKey: string, company: { businessName: string; city?: string; phone?: string }) {
    const p = await this.prisma.categoryPack.findUnique({ where: { key: packKey } });
    if (!p || !p.enabled) throw new NotFoundException('That category is not available right now. Choose another, or contact support.');
    const c = p.config as unknown as PackConfig;
    const v = { business: company.businessName.trim(), city: (company.city ?? '').trim(), phone: company.phone?.trim() };
    // a pack with starter content and designs: the company details first, then the starter content over everything still empty (their own words always win)
    if (c.seed) {
      await this.prisma.vendorCMS.upsert({ where: { vendorId }, create: { vendorId, packKey: p.key }, update: { packKey: p.key } });
      await this.site.writeDraft(vendorId, { businessName: v.business, ...(v.phone ? { phone: v.phone } : {}), ...(v.city ? { address: v.city } : {}) });
      await this.starter.seed(vendorId, p.key, { businessName: v.business, city: v.city, phone: v.phone }, 'draft');
      return this.site.view(vendorId);
    }
    const row = await this.prisma.vendorCMS.findUnique({ where: { vendorId }, select: { tagline: true, about: true } });
    await this.prisma.vendorCMS.upsert({ where: { vendorId }, create: { vendorId, packKey: p.key }, update: { packKey: p.key } });
    return this.site.saveDraft(vendorId, {
      businessName: v.business,
      ...(v.phone ? { phone: v.phone } : {}),
      ...(v.city ? { address: v.city } : {}),
      tagline: row?.tagline?.trim() ? row.tagline : fillPlaceholders(c.defaults.tagline, v),
      about: row?.about?.trim() ? row.about : fillPlaceholders(c.defaults.about, v),
      layout: { themeKey: c.themeKey, ...c.layouts },
    } as never);
  }
}
