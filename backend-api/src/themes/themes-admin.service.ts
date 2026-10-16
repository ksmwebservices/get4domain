import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { makePreviewToken, readPreviewToken } from '../site-doc/preview-token';
import { PackConfig } from '../site-doc/pack.types';
import { CONTRACT, LintLine, lintPackage, readZip, PackageFile } from './core';
import { buildSampleSite } from './theme-sample';
import { GST_RATE } from './theme-catalog.service';

export const FREE_SLOTS = ['classic', 'bold', 'minimal', 'warm'] as const;
const ROLES = ['FREE_DEFAULT', 'MARKETPLACE'] as const;
const STATUSES = ['DRAFT', 'LIVE', 'RETIRED'] as const;

export interface ImportOutcome { ok: boolean; lines: LintLine[]; id?: string; key?: string; version?: number; contrast?: { what: string; ratio: number | null; ok: boolean }[]; fileCount?: number }

/** Admin side of the Theme marketplace: import a package, review it, set its role, categories and price, preview it, and see what it earns. */
@Injectable()
export class ThemesAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** The flat name a picture has in a URL: assets/img/a.webp becomes img~a.webp. */
  static assetName(path: string): string { return path.replace(/^assets\//, '').replace(/\//g, '~'); }

  private async categoryPacks(): Promise<Map<string, { key: string; name: string; family: string | null }>> {
    const packs = await this.prisma.categoryPack.findMany({ select: { key: true, name: true, config: true } });
    return new Map(packs.map((p) => [p.key, { key: p.key, name: p.name, family: ((p.config as unknown as PackConfig).family ?? null) as string | null }]));
  }

  /** Reads a zip, runs the lint (the same one KSM runs on his computer), checks the categories exist and suit the families, and stores the package as a DRAFT. */
  async importZip(buffer: Buffer, actor: string, opts: { dryRun?: boolean } = {}): Promise<ImportOutcome> {
    const zip = readZip(new Uint8Array(buffer));
    if (zip.error) return { ok: false, lines: [{ level: 'error', text: zip.error }] };
    return this.importFiles(zip.files, actor, opts);
  }

  async importFiles(files: PackageFile[], actor: string, opts: { dryRun?: boolean } = {}): Promise<ImportOutcome> {
    const lint = lintPackage(files);
    const lines = [...lint.lines];
    const pkg = lint.result.package;
    if (!lint.ok || !pkg) return { ok: false, lines };
    const m = pkg.manifest;
    const packs = await this.categoryPacks();
    const problems: string[] = [];
    for (const c of m.categories) {
      const p = packs.get(c);
      if (!p) { problems.push(`The category "${c}" in theme.json does not exist. Categories: ${[...packs.keys()].slice(0, 30).join(', ')}.`); continue; }
      if (p.family && !m.families.includes(p.family)) problems.push(`The category "${c}" is a ${p.family} business, but this theme declares only ${m.families.join(', ')}. Add "${p.family}" to "families" in theme.json, or remove "${c}" from "categories".`);
    }
    if (pkg.assets.some((a) => a.path.includes('~'))) problems.push('A file name in assets/ contains "~". Rename it (the engine uses that character in picture addresses).');
    if (await this.prisma.themePackage.findUnique({ where: { key_version: { key: m.id, version: m.version } } })) problems.push(`Version ${m.version} of "${m.id}" is already in the marketplace. Raise "version" in theme.json and upload again.`);
    for (const t of problems) lines.push({ level: 'error', text: t });
    if (problems.length) return { ok: false, lines };
    if (opts.dryRun) return { ok: true, lines, key: m.id, version: m.version, contrast: lint.contrast, fileCount: files.length };

    const preview = pkg.preview;
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.themePackage.create({
        data: {
          key: m.id, version: m.version, name: m.name, manifest: m as unknown as Prisma.InputJsonValue, pages: pkg.pages as unknown as Prisma.InputJsonValue, css: pkg.css,
          assetIndex: pkg.assets.map((a) => ({ path: a.path, mime: a.mime, bytes: a.bytes })) as unknown as Prisma.InputJsonValue,
          googleFonts: (pkg.googleFonts.length ? pkg.googleFonts : (m.googleFonts ?? [])) as unknown as Prisma.InputJsonValue,
          families: m.families as unknown as Prisma.InputJsonValue, categories: m.categories as unknown as Prisma.InputJsonValue,
          role: 'MARKETPLACE', status: 'DRAFT', previewPath: preview ? preview.path : null,
          lint: { lines: lines.map((l) => ({ level: l.level, text: l.text })), contrast: lint.contrast } as unknown as Prisma.InputJsonValue, createdBy: actor,
        },
      });
      const all = [...pkg.assets, ...(preview ? [preview] : [])];
      if (all.length) await tx.themeAsset.createMany({ data: all.map((a) => ({ packageId: created.id, path: a.path, mime: a.mime, bytes: a.bytes, data: Buffer.from(a.data) })) });
      return created;
    });
    return { ok: true, lines, id: row.id, key: row.key, version: row.version, contrast: lint.contrast, fileCount: files.length };
  }

  async list() {
    const rows = await this.prisma.themePackage.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }] });
    const ents = await this.prisma.themeEntitlement.groupBy({ by: ['themeKey'], where: { status: 'ACTIVE', endsAt: { gt: new Date() } }, _count: { _all: true } });
    const active = new Map(ents.map((e) => [e.themeKey, e._count._all]));
    return rows.map((r) => ({ id: r.id, key: r.key, version: r.version, name: r.name, role: r.role, status: r.status, replacesDesign: r.replacesDesign, priceYearlyPaise: r.priceYearlyPaise, categories: r.categories, families: r.families, previewPath: r.previewPath, activeLicences: active.get(r.key) ?? 0, createdAt: r.createdAt, lintSummary: this.lintSummary(r.lint) }));
  }

  private lintSummary(lint: unknown): { warnings: number; contrastFails: number } {
    const l = (lint ?? {}) as { lines?: LintLine[]; contrast?: { ok: boolean }[] };
    return { warnings: (l.lines ?? []).filter((x) => x.level === 'warn').length, contrastFails: (l.contrast ?? []).filter((c) => !c.ok).length };
  }

  async get(id: string) {
    const r = await this.prisma.themePackage.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('We could not find that theme.');
    const { pages: _p, css: _c, ...rest } = r;
    void _p; void _c;
    return { ...rest, pageNames: Object.keys((r.pages as Record<string, string>) ?? {}) };
  }

  /** Role, categories, price and status. Every rule that protects vendors lives here, so no screen can skip it. */
  async update(id: string, patch: { categories?: string[]; role?: string; replacesDesign?: string | null; priceYearlyPaise?: number | null; status?: string; name?: string }) {
    const cur = await this.prisma.themePackage.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('We could not find that theme.');
    const packs = await this.categoryPacks();
    const families = (cur.families as string[]) ?? [];
    const categories = patch.categories ?? ((cur.categories as string[]) ?? []);
    const role = patch.role ?? cur.role;
    const status = patch.status ?? cur.status;
    const price = patch.priceYearlyPaise === undefined ? cur.priceYearlyPaise : patch.priceYearlyPaise;
    const slot = patch.replacesDesign === undefined ? cur.replacesDesign : patch.replacesDesign;
    if (!(ROLES as readonly string[]).includes(role)) throw new BadRequestException('Choose a role: a free default design for a category, or a marketplace theme.');
    if (!(STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Choose a status: draft, live or retired.');
    if (!categories.length) throw new BadRequestException('Choose at least one category this theme is for.');
    for (const c of categories) {
      const p = packs.get(c);
      if (!p) throw new BadRequestException(`The category "${c}" does not exist.`);
      if (p.family && !families.includes(p.family)) throw new BadRequestException(`"${p.name}" is a ${p.family} business, and this theme was built for ${families.join(', ')}. A theme works only for the kinds of business it was built for.`);
    }
    if (price !== null && price !== undefined && (!Number.isInteger(price) || price < 0 || price > 5_000_000)) throw new BadRequestException('The yearly price must be a whole number of paise (for example 99900 for 999 rupees), between 0 and 50,000 rupees.');
    if (role === 'FREE_DEFAULT' && (!slot || !(FREE_SLOTS as readonly string[]).includes(slot))) throw new BadRequestException(`A free default design replaces one of the four built-in designs of its category. Choose which: ${FREE_SLOTS.join(', ')}.`);
    if (status === 'LIVE') {
      if (role === 'MARKETPLACE' && !(price && price > 0)) throw new BadRequestException('Set a yearly price before a marketplace theme goes live. Prices are set here, never in code.');
      if (role === 'FREE_DEFAULT') {
        for (const c of categories) {
          const clash = await this.prisma.themePackage.findMany({ where: { status: 'LIVE', role: 'FREE_DEFAULT', replacesDesign: slot, id: { not: id }, key: { not: cur.key } } });
          const hit = clash.find((t) => ((t.categories as string[]) ?? []).includes(c));
          if (hit) throw new ConflictException(`The ${slot} slot of "${packs.get(c)?.name ?? c}" is already used by "${hit.name}". Retire that theme or choose another slot. A category has four free designs at most.`);
        }
      }
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const u = await tx.themePackage.update({
        where: { id },
        data: {
          categories: categories as unknown as Prisma.InputJsonValue, role, status, replacesDesign: role === 'FREE_DEFAULT' ? slot : null, priceYearlyPaise: role === 'MARKETPLACE' ? (price ?? null) : null,
          ...(patch.name ? { name: patch.name.trim().slice(0, 80) } : {}),
        },
      });
      // a new version going live retires the older live versions of the same theme (owners keep using what they own; new buyers get the new one)
      if (status === 'LIVE') await tx.themePackage.updateMany({ where: { key: u.key, id: { not: u.id }, status: 'LIVE' }, data: { status: 'RETIRED' } });
      return u;
    });
    return this.get(row.id);
  }

  async duplicate(id: string, newKey: string, actor: string) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(newKey) || newKey.length < 3 || newKey.length > 40) throw new BadRequestException('The new theme id can only use lower-case letters, numbers and dashes (3 to 40 characters).');
    const src = await this.prisma.themePackage.findUnique({ where: { id }, include: { assets: true } });
    if (!src) throw new NotFoundException('We could not find that theme.');
    if (await this.prisma.themePackage.findFirst({ where: { key: newKey } })) throw new ConflictException('A theme with that id already exists.');
    // the stylesheet is scoped to the theme id, so a copy gets its own scope
    const css = src.css.split(`.g4d-theme-${src.key}`).join(`.g4d-theme-${newKey}`);
    const manifest = { ...(src.manifest as Record<string, unknown>), id: newKey, version: 1 };
    const row = await this.prisma.$transaction(async (tx) => {
      const c = await tx.themePackage.create({ data: { key: newKey, version: 1, name: `${src.name} (copy)`, manifest: manifest as Prisma.InputJsonValue, pages: src.pages as Prisma.InputJsonValue, css, assetIndex: src.assetIndex as Prisma.InputJsonValue, googleFonts: (src.googleFonts ?? []) as Prisma.InputJsonValue, families: src.families as Prisma.InputJsonValue, categories: src.categories as Prisma.InputJsonValue, role: 'MARKETPLACE', status: 'DRAFT', previewPath: src.previewPath, lint: (src.lint ?? undefined) as Prisma.InputJsonValue | undefined, createdBy: actor } });
      if (src.assets.length) await tx.themeAsset.createMany({ data: src.assets.map((a) => ({ packageId: c.id, path: a.path, mime: a.mime, bytes: a.bytes, data: a.data })) });
      return c;
    });
    return this.get(row.id);
  }

  /** A private link per compatible category that shows the theme filled with that category's sample content, on desktop and on a phone (valid 30 minutes). */
  async previewLinks(id: string) {
    const t = await this.prisma.themePackage.findUnique({ where: { id }, select: { id: true, categories: true } });
    if (!t) throw new NotFoundException('We could not find that theme.');
    const token = makePreviewToken(`theme:${id}`);
    return ((t.categories as string[]) ?? []).map((c) => ({ category: c, path: `/theme-pack/${id}?category=${encodeURIComponent(c)}&token=${encodeURIComponent(token)}` }));
  }

  /** Sample site and package for the preview page. Needs the preview token unless the theme is live. */
  async sample(id: string, categoryKey: string, token: string | undefined) {
    const t = await this.prisma.themePackage.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('We could not find that theme.');
    if (t.status !== 'LIVE' && readPreviewToken(token) !== `theme:${id}`) throw new NotFoundException('We could not find that theme.');
    if (!((t.categories as string[]) ?? []).includes(categoryKey)) throw new BadRequestException('This theme is not for that category.');
    const pack = await this.prisma.categoryPack.findUnique({ where: { key: categoryKey } });
    if (!pack) throw new NotFoundException('We could not find that category.');
    return { site: buildSampleSite({ key: pack.key, name: pack.name, config: pack.config as unknown as PackConfig }), theme: await this.publicPackage(id, true) };
  }

  /** The package as the website renders it: manifest, pages, scoped stylesheet and the picture index. Public (it holds no vendor data). */
  async publicPackage(id: string, anyStatus = false) {
    const t = await this.prisma.themePackage.findUnique({ where: { id } });
    if (!t || (!anyStatus && t.status === 'DRAFT')) throw new NotFoundException('We could not find that theme.');
    return { id: t.id, key: t.key, version: t.version, name: t.name, manifest: t.manifest, pages: t.pages, css: t.css, googleFonts: t.googleFonts ?? [], assets: ((t.assetIndex as { path: string; mime: string; bytes: number }[]) ?? []).map((a) => ({ path: a.path, name: ThemesAdminService.assetName(a.path) })), previewPath: t.previewPath };
  }

  async asset(id: string, flat: string) {
    const t = await this.prisma.themePackage.findUnique({ where: { id }, select: { id: true, assetIndex: true, previewPath: true } });
    if (!t) throw new NotFoundException('Not found');
    const idx = ((t.assetIndex as { path: string }[]) ?? []).map((a) => a.path);
    if (t.previewPath) idx.push(t.previewPath);
    const path = idx.find((p) => ThemesAdminService.assetName(p) === flat || p === flat);
    if (!path) throw new NotFoundException('Not found');
    const a = await this.prisma.themeAsset.findUnique({ where: { packageId_path: { packageId: id, path } } });
    if (!a) throw new NotFoundException('Not found');
    return { mime: a.mime, data: Buffer.from(a.data) };
  }

  /** Themes sold, active licences, revenue per theme (ex-GST and GST), and licences ending within 30 days. */
  async report(now = new Date()) {
    const ents = await this.prisma.themeEntitlement.findMany({ orderBy: { createdAt: 'desc' } });
    const names = new Map((await this.prisma.themePackage.findMany({ select: { key: true, name: true }, orderBy: { version: 'asc' } })).map((r) => [r.key, r.name]));
    const per = new Map<string, { key: string; name: string; sold: number; active: number; revenuePaise: number; gstPaise: number }>();
    for (const e of ents) {
      const r = per.get(e.themeKey) ?? { key: e.themeKey, name: names.get(e.themeKey) ?? e.themeKey, sold: 0, active: 0, revenuePaise: 0, gstPaise: 0 };
      r.sold += 1; r.revenuePaise += e.amountPaise; r.gstPaise += e.gstPaise;
      if (e.status === 'ACTIVE' && e.endsAt > now) r.active += 1;
      per.set(e.themeKey, r);
    }
    const soon = ents.filter((e) => e.status === 'ACTIVE' && e.endsAt > now && e.endsAt.getTime() - now.getTime() <= 30 * 86_400_000);
    const vendors = soon.length ? await this.prisma.vendor.findMany({ where: { id: { in: soon.map((e) => e.vendorId) } }, select: { id: true, businessName: true, email: true } }) : [];
    const vmap = new Map(vendors.map((v) => [v.id, v]));
    return {
      totals: { sold: ents.length, active: [...per.values()].reduce((n, r) => n + r.active, 0), revenuePaise: [...per.values()].reduce((n, r) => n + r.revenuePaise, 0), gstPaise: [...per.values()].reduce((n, r) => n + r.gstPaise, 0) },
      perTheme: [...per.values()].sort((a, b) => b.revenuePaise - a.revenuePaise),
      expiringSoon: soon.map((e) => ({ vendorId: e.vendorId, businessName: vmap.get(e.vendorId)?.businessName ?? '', themeKey: e.themeKey, themeName: names.get(e.themeKey) ?? e.themeKey, endsAt: e.endsAt, daysLeft: Math.ceil((e.endsAt.getTime() - now.getTime()) / 86_400_000) })),
    };
  }

  static gst(basePaise: number): number { return Math.round(basePaise * GST_RATE); }
  static contract() { return CONTRACT; }
}
