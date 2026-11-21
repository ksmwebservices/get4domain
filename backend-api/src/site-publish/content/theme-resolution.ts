import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { planError } from '../../plans/plans.errors';
import { siteError } from '../site.errors';
import { ThemeSummary } from '../renderer/theme-render.service';

export interface ThemesEntitlement { state: 'ACTIVE' | 'LIMITED' | 'LOCKED_PREVIEW' | 'HIDDEN'; enumValue: string | null; upsellText: string | null }
export interface ResolveArgs {
  /** the vendor's stored choice, or the one just asked for; null = none */
  requested: string | null;
  categoryId: string;
  /** the vendor's track (handyman, professional, ecommerce): a theme is designed for tracks, and a Pro vendor may use any theme designed for theirs */
  track: string;
  themes: ThemeSummary[];
  defaultId: string | null;
  /** the vendor's `site.themes` feature (`assigned` = only the category default, `library` = any theme designed for the vendor's track); null = no plan */
  entitlement: ThemesEntitlement | null;
  /** true when the vendor or staff ask for a theme (errors); false when a build re-reads a stored choice (falls back instead of failing) */
  strict: boolean;
}
export interface Resolved { themeId: string; source: 'stored' | 'default'; notes: string[] }

/**
 * Which theme a vendor's site is built with. The default is the category's assigned Standard theme. Anything else needs the plan feature `site.themes` =
 * `library`, and the theme must be designed for the vendor's track (the five Standard themes list disjoint categories, so a category alone would leave
 * Pro vendors with no choice; the kit's `tracks` field is what a theme is designed for). Pure; the caller supplies the entitlement and the theme list.
 */
export function resolveTheme(a: ResolveArgs): Resolved {
  if (!a.defaultId && !a.requested) throw new BadRequestException(siteError('THEME_INVALID', 'There is no theme for this kind of business yet.'));
  if (!a.requested || a.requested === a.defaultId) {
    if (!a.defaultId) throw new BadRequestException(siteError('THEME_INVALID', 'There is no theme for this kind of business yet.'));
    return { themeId: a.defaultId, source: a.requested ? 'stored' : 'default', notes: [] };
  }
  const theme = a.themes.find((t) => t.id === a.requested);
  if (!theme) {
    if (!a.strict && a.defaultId) return { themeId: a.defaultId, source: 'default', notes: ['theme-fallback'] };
    throw new BadRequestException(siteError('THEME_INVALID', 'That theme is not available.'));
  }
  const entitled = a.entitlement !== null && a.entitlement.state === 'ACTIVE' && a.entitlement.enumValue === 'library';
  if (!entitled) {
    if (!a.strict && a.defaultId) return { themeId: a.defaultId, source: 'default', notes: ['theme-fallback'] };
    throw new ForbiddenException(planError('FEATURE_LOCKED', 'Your plan uses the layout chosen for your kind of business.', { feature: 'site.themes', upsellText: a.entitlement?.upsellText ?? null }));
  }
  if (!theme.tracks.includes(a.track)) {
    if (!a.strict && a.defaultId) return { themeId: a.defaultId, source: 'default', notes: ['theme-fallback'] };
    throw new ForbiddenException(siteError('THEME_LOCKED', 'That theme is not designed for your kind of business.'));
  }
  return { themeId: theme.id, source: 'stored', notes: [] };
}
