import { siteApiBase } from '../site-state';
import { themeForSite } from './resolver';
import { buildWebManifest, iconLetter } from './pwa';
import { categoryLabel } from './view';

/** What the vendor's web app manifest and icon need: the name, the theme's colours and the first letter. Read from the same public site answer the page uses (cached for a minute). */
export interface AppIdentity { name: string; accent: string; accentFg: string; background: string; letter: string; description: string | null; logo: string | null }

export async function fetchAppIdentity(subdomain: string): Promise<AppIdentity | null> {
  if (!/^[a-z0-9-]{1,63}$/.test(subdomain)) return null;
  try {
    const res = await fetch(`${siteApiBase()}/cms/site/${encodeURIComponent(subdomain)}`, { next: { tags: [`site:${subdomain}`], revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    const site = (json.data ?? json) as { vendor?: { businessName?: string; industry?: string }; cms?: { businessName?: string | null; tagline?: string | null; logo?: string | null } | null; pack?: { key?: string; name?: string } | null };
    const name = (site.cms?.businessName || site.vendor?.businessName || '').trim();
    if (!name) return null;
    const { theme } = themeForSite(site);
    return { name, accent: theme.colors.accent, accentFg: theme.colors.accentFg, background: theme.colors.bg, letter: iconLetter(name), description: site.cms?.tagline ?? categoryLabel(site.vendor?.industry, site.pack?.name ?? null, site.pack?.key ?? null), logo: /^https?:\/\//i.test(site.cms?.logo ?? '') ? (site.cms?.logo as string) : null };
  } catch { return null; }
}

export const manifestFor = (id: AppIdentity): Record<string, unknown> => buildWebManifest({ name: id.name, description: id.description, accent: id.accent, background: id.background });
