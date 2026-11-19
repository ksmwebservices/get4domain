import { siteApiBase } from '@/lib/v3-public/site-state';
import type { ThemePackageData } from './data';

/** A live theme package, cached for five minutes and refreshed when the theme changes (the tag is dropped on import). */
export async function fetchThemePackage(id: string): Promise<ThemePackageData | null> {
  try {
    const res = await fetch(`${siteApiBase()}/themes/package/${encodeURIComponent(id)}`, { next: { tags: [`theme:${id}`], revalidate: 300 } });
    if (!res.ok) return null;
    const j = await res.json();
    return (j.data ?? j) as ThemePackageData;
  } catch { return null; }
}
