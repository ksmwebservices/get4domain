import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from '../../plans/admin/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SeoTemplates } from '../core/default-templates';
import { SeoAudit } from '../seo-audit';
import { seoError } from '../seo-directory.errors';
import { resolveSeoCrawlers, resolveSeoTemplates, SEO_CRAWLERS_KEY, SEO_TEMPLATES_KEY, seoCrawlersProblem, seoTemplatesProblem } from './seo-settings';

const TTL_MS = 30_000;

/** Reads and writes the SEO page templates in g4d_plan_settings. Reads fall back to the defaults; a write is validated, saved with its audit row, and the cache is dropped. */
@Injectable()
export class SeoSettingsService {
  private cached: { at: number; v: SeoTemplates } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService, private readonly audit: SeoAudit) {}

  invalidate(): void { this.cached = null; }

  async templates(): Promise<SeoTemplates> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const row = await this.prisma.v3PlanSetting.findUnique({ where: { key: SEO_TEMPLATES_KEY } });
    const v = resolveSeoTemplates(row?.valueJson);
    this.cached = { at: now, v };
    return v;
  }

  /** The raw stored overrides (what staff typed), without the defaults. */
  async stored(): Promise<unknown> { return (await this.prisma.v3PlanSetting.findUnique({ where: { key: SEO_TEMPLATES_KEY } }))?.valueJson ?? {}; }

  async saveTemplates(value: unknown, actor: Actor): Promise<SeoTemplates> {
    const problem = seoTemplatesProblem(value);
    if (problem) throw new BadRequestException(seoError('SEO_INVALID', `templates: ${problem}`));
    const before = await this.stored();
    const json = value as Prisma.InputJsonValue;
    await this.prisma.v3PlanSetting.upsert({ where: { key: SEO_TEMPLATES_KEY }, create: { key: SEO_TEMPLATES_KEY, valueJson: json, description: 'SEO page templates (title, description, h1 per page type)' }, update: { valueJson: json } });
    await this.audit.record(actor, 'seo.templates.update', 'seo_templates', SEO_TEMPLATES_KEY, before, value);
    this.invalidate();
    return this.templates();
  }

  /** The crawlers named in robots.txt (defaults when staff never changed them). */
  async crawlers(): Promise<string[]> {
    const row = await this.prisma.v3PlanSetting.findUnique({ where: { key: SEO_CRAWLERS_KEY } });
    return resolveSeoCrawlers(row?.valueJson);
  }

  async saveCrawlers(value: unknown, actor: Actor): Promise<string[]> {
    const problem = seoCrawlersProblem(value);
    if (problem) throw new BadRequestException(seoError('SEO_INVALID', `crawlers: ${problem}`));
    const before = await this.crawlers();
    const json = value as Prisma.InputJsonValue;
    await this.prisma.v3PlanSetting.upsert({ where: { key: SEO_CRAWLERS_KEY }, create: { key: SEO_CRAWLERS_KEY, valueJson: json, description: 'Crawlers named in robots.txt, each with Allow: /' }, update: { valueJson: json } });
    await this.audit.record(actor, 'seo.crawlers.update', 'seo_crawlers', SEO_CRAWLERS_KEY, before, value);
    return this.crawlers();
  }
}
