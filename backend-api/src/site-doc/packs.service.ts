import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SiteDocService } from './site-doc.service';
import { PackConfig, fillPlaceholders, validatePack } from './pack.types';
import { starterPacks } from './pack-seeds';

const KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Category Packs: create, copy, edit, switch on or off, preview, and generate a vendor's site from one. No pack is ever needed in code. */
@Injectable()
export class PacksService {
  constructor(private readonly prisma: PrismaService, private readonly site: SiteDocService) {}

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

  async create(key: string, name: string, config: PackConfig, actor: string) {
    this.check(key, name, config);
    if (await this.prisma.categoryPack.findUnique({ where: { key } })) throw new ConflictException('A pack with this key already exists. Choose another key, or edit that pack.');
    return this.prisma.categoryPack.create({ data: { key, name: name.trim(), config: config as unknown as Prisma.InputJsonValue, createdBy: actor } });
  }

  async update(key: string, patch: { name?: string; enabled?: boolean; config?: PackConfig }) {
    const cur = await this.get(key);
    const name = patch.name ?? cur.name;
    const config = patch.config ?? (cur.config as unknown as PackConfig);
    this.check(undefined, name, config);
    return this.prisma.categoryPack.update({ where: { key }, data: { name: name.trim(), enabled: patch.enabled ?? cur.enabled, config: config as unknown as Prisma.InputJsonValue } });
  }

  async duplicate(key: string, newKey: string, newName: string, actor: string) {
    const src = await this.get(key);
    return this.create(newKey, newName, src.config as unknown as PackConfig, actor);
  }

  /** Create the starter packs that are missing (the 12 LeadSpace trades and the 20 website-engine industries). Never changes a pack that exists. */
  async seedStarter(actor: string): Promise<{ created: string[]; kept: number }> {
    const have = new Set((await this.prisma.categoryPack.findMany({ select: { key: true } })).map((p) => p.key));
    const created: string[] = [];
    for (const p of starterPacks()) {
      if (have.has(p.key)) continue;
      await this.prisma.categoryPack.create({ data: { key: p.key, name: p.name, config: p.config as unknown as Prisma.InputJsonValue, createdBy: actor } });
      created.push(p.key);
    }
    return { created, kept: have.size };
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
