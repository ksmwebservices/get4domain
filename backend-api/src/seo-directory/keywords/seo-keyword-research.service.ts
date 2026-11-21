import { Injectable } from '@nestjs/common';
import { DirectoryRepository } from '../../directory/directory.repository';
import { DirectorySettingsService } from '../../directory/settings/directory-settings.service';
import { Actor } from '../../plans/admin/audit.service';
import { generateResearchPlan, plannerCsv, ProfileFact, ResearchPlan, researchToCsv, ResearchRow, ServiceCityCount } from '../core/keyword-research';
import { parseVolumeCsv, planVolumeImport, VolumePlan } from '../core/keyword-volume';
import { SeoAudit } from '../seo-audit';
import { SeoDirectoryData } from '../pages/seo-directory.data';
import { loadPlaces, Places } from '../pages/places';
import { SeoSettingsService } from '../settings/seo-settings.service';
import { SeoSitemapService } from '../sitemaps/seo-sitemap.service';
import { SeoKeywordStore } from './seo-keyword.store';
import { SeoKeywordTargetStore } from './seo-keyword-target.store';

export const PROFILE_TAKE = 20_000;

export interface VolumeImportResult {
  applied: boolean; problems: string[]; fileRows: number; usableRows: number; skippedCount: number; skipped: Array<{ row: number; keyword: string; reason: string }>; duplicates: number;
  updated: number; created: number; unchanged: number; unmatchedCount: number; unmatched: string[];
}

/**
 * The keyword research list and the Keyword Planner volume import (prompt 8d). Staff only. The list is built from our own data (listed pages, keyword sets, services, profiles) and never
 * scrapes anything; the import writes volumes ONLY from the file staff upload. Generating the list stores nothing; an import is a dry run unless apply, one transaction, with an audit row.
 */
@Injectable()
export class SeoKeywordResearchService {
  constructor(
    private readonly data: SeoDirectoryData, private readonly repo: DirectoryRepository, private readonly keywords: SeoKeywordStore, private readonly sitemaps: SeoSitemapService,
    private readonly seo: SeoSettingsService, private readonly directory: DirectorySettingsService, private readonly targets: SeoKeywordTargetStore, private readonly audit: SeoAudit,
  ) {}

  private cityOf(pl: Places, locationId: string | null): { city: { id: string; name: string } | null; locality: string | null } {
    let cur = locationId ? pl.locs.find((l) => l.id === locationId) : undefined; let g = 0; let locality: string | null = null; let city: { id: string; name: string } | null = null;
    while (cur && g++ < 10) {
      if (!locality && cur.kind === 'LOCALITY') locality = cur.name;
      if (!city && (cur.kind === 'CITY' || cur.kind === 'DISTRICT')) city = { id: cur.id, name: cur.name };
      cur = cur.parentId ? pl.locs.find((l) => l.id === cur!.parentId) : undefined;
    }
    return { city, locality };
  }

  /** The whole research list. Nothing is stored. */
  async plan(): Promise<ResearchPlan> {
    const [listing, pl, kws, modifiers, s, stats, profiles] = await Promise.all([
      this.sitemaps.listing(), loadPlaces(this.repo, this.keywords), this.keywords.all(), this.seo.modifiers(), this.directory.get(), this.data.serviceStats(), this.data.profileNames(PROFILE_TAKE),
    ]);
    const synonyms = new Map(kws.filter((k) => k.synonyms.length).map((k) => [k.categorySlug, k.synonyms]));
    const rolled = new Map<string, ServiceCityCount>();
    for (const r of stats) {
      const { city } = this.cityOf(pl, r.locationId); if (!city) continue;
      const key = `${r.name}\u0000${r.categoryId}\u0000${city.id}`; const h = rolled.get(key);
      if (h) h.count += r.count; else rolled.set(key, { name: r.name, catId: r.categoryId, cityId: city.id, cityName: city.name, count: r.count });
    }
    const facts: ProfileFact[] = profiles.map((p) => { const { city, locality } = this.cityOf(pl, p.locationId); return { name: p.name, slug: p.slug, localityName: locality, cityName: city?.name ?? null }; });
    return generateResearchPlan({ listing, synonyms, modifiers, serviceCounts: [...rolled.values()], profiles: facts, min: s.directoryThinPageMinBusinesses });
  }

  async csv(): Promise<{ csv: string; planner: string; total: number }> { const p = await this.plan(); return { csv: researchToCsv(p.rows), planner: plannerCsv(p.rows), total: p.total }; }

  /** Reads a Keyword Planner CSV back into the targets. DRY RUN unless apply. */
  async importVolumes(csv: string, o: { apply: boolean }, actor: Actor): Promise<VolumeImportResult> {
    const file = parseVolumeCsv(csv);
    const base: VolumeImportResult = { applied: false, problems: file.problems, fileRows: file.total, usableRows: file.rows.length, skippedCount: file.total - file.rows.length - file.duplicates, skipped: file.skipped, duplicates: file.duplicates, updated: 0, created: 0, unchanged: 0, unmatchedCount: 0, unmatched: [] };
    if (file.problems.length) return base;
    const wanted = new Set(file.rows.map((r) => r.keyword));
    const existing = await this.targets.all();
    // our research keywords are only needed for the keywords that are not targets yet
    const missing = new Set([...wanted].filter((k) => !existing.some((t) => t.keyword === k)));
    const research = new Map<string, ResearchRow[]>();
    if (missing.size) for (const r of (await this.plan()).rows) if (missing.has(r.keyword)) research.set(r.keyword, [...(research.get(r.keyword) ?? []), r]);
    const plan: VolumePlan = planVolumeImport(file.rows, existing, research);
    const applied = o.apply && (plan.update.length > 0 || plan.create.length > 0);
    if (applied) {
      await this.targets.importApply({ create: plan.create, update: plan.update }, actor.id);
      await this.audit.record(actor, 'seo.keyword_target.volumes', 'seo_keyword_target', null, null, { updated: plan.update.length, created: plan.create.length, unchanged: plan.unchanged, unmatched: plan.unmatchedCount });
    }
    return { ...base, applied, updated: plan.update.length, created: plan.create.length, unchanged: plan.unchanged, unmatchedCount: plan.unmatchedCount, unmatched: plan.unmatched };
  }
}
