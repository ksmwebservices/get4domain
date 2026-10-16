import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ThemeSite from '@/engine/themepack/site';
import type { ThemePackageData } from '@/engine/themepack/data';
import type { EngineSiteData } from '@/engine/types';

/**
 * A theme filled with one category's starter content, for the admin Theme marketplace, the vendor's "try before you buy" and the lint report. Never indexed, never sends
 * anything (the popup and the forms show their success step but write nothing), and holds no vendor data. ?category=<pack key>&token=<private link token for a draft theme>.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
type Query = { category?: string; token?: string; sent?: string; e?: string; popup?: string };

async function load(id: string, category: string, token?: string): Promise<{ site: EngineSiteData & { pagesLimit?: number }; theme: ThemePackageData } | null> {
  try {
    const url = `${API_BASE}/themes/sample/${encodeURIComponent(id)}?category=${encodeURIComponent(category)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    return (j.data ?? j) as { site: EngineSiteData & { pagesLimit?: number }; theme: ThemePackageData };
  } catch { return null; }
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string; rest?: string[] }>; searchParams: Promise<Query> }): Promise<Metadata> {
  const { id } = await params; const q = await searchParams;
  const d = await load(id, q.category ?? '', q.token);
  return { title: d ? `${d.theme.name} (preview)` : 'Theme preview', robots: { index: false, follow: false } };
}

export default async function ThemePackPreview({ params, searchParams }: { params: Promise<{ id: string; rest?: string[] }>; searchParams: Promise<Query> }) {
  const { id, rest = [] } = await params; const q = await searchParams;
  const d = await load(id, q.category ?? '', q.token);
  if (!d) notFound();
  const keep = `category=${encodeURIComponent(q.category ?? '')}${q.token ? `&token=${encodeURIComponent(q.token)}` : ''}`;
  const site = { ...d.site, pagesLimit: 40, preview: true } as EngineSiteData;
  return (
    <>
      <div role="status" className="fixed left-1/2 top-2 z-[80] -translate-x-1/2 rounded-full bg-amber-300 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-lg">Theme preview with sample content. Nothing here is real.</div>
      <ThemeSite site={site} pkg={d.theme} rest={rest} subdomain="preview" opts={{ base: `/theme-pack/${id}`, mode: 'sample', shop: false, checkoutMode: 'ONLINE', keep, flash: { sent: q.sent === '1', error: q.e } }} />
    </>
  );
}
