import type { EngineSiteData } from '../types';
import type { KitSiteModel, KitSection } from './model';
import { brandFrom, itemsFrom } from './content';

/**
 * A data-driven website template: the exact shape KitRenderer already consumes
 * (KitSiteModel) MINUS the brand — because brand always comes from the vendor. So a
 * template is a fully-serializable layout (theme tokens + ordered sections + nav +
 * CTAs) that can live in the DB, be authored in the admin UI, and render live for any
 * vendor with NO redeploy. `brandDefaults` are the demo values shown in preview / when
 * a vendor hasn't filled their CMS yet.
 */
export type WebsiteTemplate = Omit<KitSiteModel, 'brand'> & {
  id: string;
  name: string;
  /** null/undefined = available to any industry. */
  industry?: string | null;
  brandDefaults: { name: string; tagline: string; about: string };
};

/** A WebsiteTheme DB row as returned by the site API (layout may be absent/invalid). */
export interface ThemeRow {
  id: string;
  name: string;
  industry?: string | null;
  cssVars?: unknown;
  layout?: unknown;
}

/**
 * Build a renderable WebsiteTemplate from a DB theme row, or return null when the row
 * carries no valid data-driven layout — in which case the caller falls back to the
 * industry default. Guards the shape (sections array + theme) so a malformed uploaded
 * template can never crash a live site.
 */
export function templateFromThemeRow(row: ThemeRow | null | undefined): WebsiteTemplate | null {
  if (!row || !row.layout || typeof row.layout !== 'object') return null;
  const l = row.layout as Partial<Omit<WebsiteTemplate, 'id' | 'name' | 'industry'>>;
  if (!Array.isArray(l.sections) || l.sections.length === 0) return null;
  if (!l.theme || typeof l.theme !== 'object') return null;
  return {
    id: row.id,
    name: row.name,
    industry: row.industry ?? null,
    brandDefaults: l.brandDefaults ?? { name: '', tagline: '', about: '' },
    theme: l.theme,
    choices: l.choices ?? [],
    choiceLabel: l.choiceLabel ?? 'Option',
    nav: l.nav ?? [],
    bottomNav: l.bottomNav ?? [],
    primaryCta: l.primaryCta ?? { intent: 'engine.enquiry', label: 'Enquire', kind: 'enquiry' },
    sections: l.sections,
  };
}

/**
 * Fill a template with a vendor's real content (the shared-content model — the same
 * content flows into whichever template they pick):
 *  - brand always comes from the vendor's CMS, falling back to the template's demo defaults;
 *  - the FIRST showcase section shows the vendor's products when they have any, else the
 *    template's seed items;
 * everything else renders as the template was authored.
 */
export function resolveTemplate(t: WebsiteTemplate, site: EngineSiteData): KitSiteModel {
  let showcaseFilled = false;
  const sections: KitSection[] = t.sections.map((s) => {
    if (s.type === 'showcase' && !showcaseFilled && site.products.length) {
      showcaseFilled = true;
      return { ...s, items: itemsFrom(site, s.items) };
    }
    return s;
  });
  return {
    brand: brandFrom(site, t.brandDefaults),
    theme: t.theme,
    choices: t.choices,
    choiceLabel: t.choiceLabel,
    nav: t.nav,
    bottomNav: t.bottomNav,
    primaryCta: t.primaryCta,
    sections,
  };
}
