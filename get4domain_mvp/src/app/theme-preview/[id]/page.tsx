'use client';

import { use, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { templateFromThemeRow } from '@/engine/kit/template';
import { renderKitTemplate } from '@/engine/registry';
import { themePages } from '@/engine/raw-html-site';
import { buildThemeSrcDoc, RawThemeFrame } from '@/engine/raw-theme-frame';
import { IMG } from '@/engine/kit/content';
import type { EngineSiteData } from '@/engine/types';

interface ThemeRowFull {
  id: string; name: string; industry: string | null;
  cssVars?: unknown; layout?: unknown; pages?: unknown; css?: string | null; js?: string | null; fonts?: unknown; price?: number | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

/**
 * Admin theme preview — renders a saved theme through the SAME renderers used for real
 * vendor sites (KitRenderer for section-kit `layout`, renderRawHtmlSite for uploaded
 * `pages`), filled with neutral SAMPLE content. No vendor, no login, no data: lets KSM
 * see the real visual result before ever assigning a theme. Mode 'preview' disables
 * form submissions, so nothing is written.
 */
function sampleSite(industry: string): EngineSiteData {
  const pool = (IMG as Record<string, string[]>)[industry] ?? IMG.professional;
  const products = [
    { name: 'Signature Offering', desc: 'A flagship product or service — your real catalogue replaces this once live.', price: '₹1,999' },
    { name: 'Popular Choice', desc: 'Customers love this one. Your own items, images and prices appear here.', price: '₹999' },
    { name: 'Starter Option', desc: 'An entry-level pick to show range.', price: '₹499' },
    { name: 'Premium Package', desc: 'The top-tier option for discerning customers.', price: '₹4,999' },
  ].map((p, i) => ({
    id: `sample-${i}`, name: p.name, description: p.desc, price: p.price,
    image: pool[i % pool.length] ?? null, category: 'Sample', customFields: null,
  }));
  return {
    vendor: { id: 'preview', businessName: 'Your Business', industry, subdomain: null },
    cms: {
      businessName: 'Your Business Name', tagline: 'Your tagline appears here',
      about: 'This is sample preview text. When a vendor selects this theme, their own About content, logo, photos, catalogue and contact details fill the design automatically — nothing is re-entered.',
      logo: null, banner: pool[0] ?? null, phone: '+91 90000 00000', whatsapp: '+919000000000',
      email: 'hello@yourbusiness.in', address: '123 Main Road, Your City', seoTitle: null, seoDesc: null,
      seoKeywords: null, businessHours: 'Mon–Sat, 9am–8pm',
    },
    products,
    paymentsEnabled: false,
  };
}

export default function ThemePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [theme, setTheme] = useState<ThemeRowFull | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    let done = false;
    // Public active list first; fall back to the admin all-list for inactive themes.
    const find = async (): Promise<ThemeRowFull | null> => {
      const pub = await api.websiteThemes().then((r) => (r.data ?? []) as ThemeRowFull[]).catch(() => []);
      const hit = pub.find((t) => t.id === id);
      if (hit) return hit;
      const all = await api.websiteThemesAll().then((r) => (r.data ?? []) as ThemeRowFull[]).catch(() => []);
      return all.find((t) => t.id === id) ?? null;
    };
    find().then((t) => { if (!done) { setTheme(t); setStatus(t ? 'ready' : 'notfound'); } });
    return () => { done = true; };
  }, [id]);

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading preview…</div>;
  }
  if (status === 'notfound' || !theme) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Theme not found (it may be inactive — sign in as admin to preview inactive themes).</div>;
  }

  const industry = theme.industry ?? 'professional';
  const site = sampleSite(industry);

  // Priority mirrors the live site route: uploaded raw pages → section-kit layout → note.
  const pages = themePages(theme);
  if (pages.length > 0) {
    const fonts = Array.isArray(theme.fonts) ? (theme.fonts as string[]) : [];
    const srcDoc = buildThemeSrcDoc(
      { pages, css: theme.css ?? '', js: theme.js ?? '', fonts },
      { vendor: { businessName: site.vendor.businessName, subdomain: null }, cms: site.cms },
      { subdomain: 'preview', rest: [], apiBase: API_BASE },
    );
    return (
      <div>
        <PreviewBar name={theme.name} kind="Uploaded HTML" />
        <RawThemeFrame srcDoc={srcDoc} title={theme.name} />
      </div>
    );
  }
  const template = templateFromThemeRow(theme);
  if (template) {
    return (
      <div>
        <PreviewBar name={theme.name} kind="Section-kit" />
        {renderKitTemplate(template, site, { kind: 'preview' })}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-center text-slate-300">
      <PreviewBar name={theme.name} kind="Colours only" />
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm">This is a <strong>colours-only</strong> theme — it re-skins the vendor&apos;s industry default layout, so there&apos;s no standalone design to preview. Assign it to a vendor to see it applied, or upload an HTML theme / convert to a catalog theme for a full previewable design.</p>
      </div>
    </div>
  );
}

function PreviewBar({ name, kind }: { name: string; kind: string }) {
  return (
    <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 bg-slate-900 px-4 py-2 text-xs text-slate-200">
      <span>Preview · <strong>{name}</strong> <span className="text-slate-400">({kind}, sample content)</span></span>
      <span className="text-slate-500">Admin preview — no vendor assigned, submissions disabled</span>
    </div>
  );
}
