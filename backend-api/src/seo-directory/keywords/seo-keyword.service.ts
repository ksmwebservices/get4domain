import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../../plans/admin/audit.service';
import { planKeywordLoad, KeywordLoadPlan } from '../core/category-keywords';
import { cleanKeyword, MAX_KEYWORD_CHARS } from '../core/keyword-text';
import { seoError } from '../seo-directory.errors';
import { SeoAudit } from '../seo-audit';
import { KeywordRow, SeoKeywordStore } from './seo-keyword.store';

export { cleanKeyword, MAX_KEYWORD_CHARS };
export const MAX_SYNONYMS = 30;
const bad = (m: string): BadRequestException => new BadRequestException(seoError('SEO_INVALID', m));

@Injectable()
export class SeoKeywordService {
  constructor(private readonly store: SeoKeywordStore, private readonly audit: SeoAudit) {}

  list(q: { q?: string; skip: number; take: number }): Promise<{ items: KeywordRow[]; total: number }> { return this.store.list(q); }

  async get(slug: string): Promise<KeywordRow> {
    const r = await this.store.get(String(slug ?? '').toLowerCase());
    if (!r) throw new NotFoundException(seoError('SEO_NOT_FOUND', 'That category has no keyword set.'));
    return r;
  }

  /** Staff edit. Marks the row STAFF so the loader never overwrites it. Synonyms are replaced as a whole list. */
  async update(slug: string, p: { singular?: string; plural?: string; synonyms?: string[] }, actor: Actor): Promise<KeywordRow> {
    const before = await this.get(slug);
    const patch: { singular?: string; plural?: string; synonyms?: string[] } = {};
    for (const k of ['singular', 'plural'] as const) if (p[k] !== undefined) { const c = cleanKeyword(p[k]); if (!c) throw bad(`${k}: is not an acceptable keyword`); patch[k] = c; }
    if (p.synonyms !== undefined) {
      if (!Array.isArray(p.synonyms) || p.synonyms.length > MAX_SYNONYMS) throw bad(`synonyms: at most ${MAX_SYNONYMS}`);
      const list: string[] = [];
      for (const s of p.synonyms) { const c = cleanKeyword(s); if (!c) throw bad(`synonyms: "${String(s).slice(0, 40)}" is not an acceptable keyword`); if (!list.includes(c)) list.push(c); }
      patch.synonyms = list;
    }
    const after = await this.store.staffUpdate(before.categorySlug, patch, actor.id);
    if (!after) throw new NotFoundException(seoError('SEO_NOT_FOUND', 'That category has no keyword set.'));
    await this.audit.record(actor, 'seo.keywords.update', 'seo_category_keyword', before.categorySlug, { singular: before.singular, plural: before.plural, synonyms: before.synonyms }, { singular: after.singular, plural: after.plural, synonyms: after.synonyms });
    return after;
  }

  /** The loader: a DRY RUN unless apply is true. Idempotent; never touches a STAFF row or any synonym. */
  async load(csv: string, o: { apply: boolean }): Promise<KeywordLoadPlan> {
    const existing = new Map((await this.store.all()).map((r) => [r.categorySlug, r]));
    const plan = planKeywordLoad(csv, existing);
    if (o.apply && !plan.problems.length) await this.store.upsertDerived([...plan.create, ...plan.update]);
    return plan;
  }
}
