import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import { buildThemeSrcDoc, RawThemeFrame } from '@/engine/raw-theme-frame';

// TEMP multi-page fidelity demo: renders the real clinic-demo theme through the raw-theme
// iframe pipeline, fully navigable (index + services + all service pages). Proves the
// exact design + working inter-page navigation. Safe to delete after verification.
export const dynamic = 'force-dynamic';

const DIR = 'public/theme-samples/clinic-demo';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

function read(p: string): string {
  try { return fs.readFileSync(path.join(process.cwd(), DIR, p), 'utf8'); } catch { return ''; }
}

function loadPages(): { pages: { slug: string; title: string; html: string }[]; css: string; js: string; fonts: string[] } {
  let files: string[] = [];
  try { files = fs.readdirSync(path.join(process.cwd(), DIR)).filter((f) => /\.html?$/i.test(f)); } catch { /* none */ }
  files.sort((a, b) => (/^index\.html?$/i.test(a) ? 0 : 1) - (/^index\.html?$/i.test(b) ? 0 : 1) || a.localeCompare(b));
  const fonts = new Set<string>();
  const pages = files.map((f, i) => {
    const text = read(f);
    for (const m of text.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css[^"]+)"/g)) fonts.add(m[1]);
    const bodyM = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const base = f.replace(/\.html?$/i, '').toLowerCase();
    const titleM = text.match(/<title>([^<]*)<\/title>/i);
    return {
      slug: i === 0 || base === 'index' ? 'home' : base,
      title: (titleM?.[1] ?? base).trim(),
      html: bodyM ? bodyM[1] : text,
    };
  });
  return { pages, css: read('css/styles.css'), js: read('js/main.js'), fonts: [...fonts] };
}

export default async function ThemeLocalTest({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const { pages, css, js, fonts } = loadPages();
  if (pages.length === 0) notFound();
  const requested = slug[0] || 'home';
  const srcDoc = buildThemeSrcDoc(
    { pages, css, js, fonts },
    { vendor: { businessName: 'Yogaanand Physiotherapy Clinic', subdomain: null }, cms: null },
    { subdomain: 'preview', rest: [requested], apiBase: API_BASE, base: '/theme-local-test' },
  );
  return <RawThemeFrame srcDoc={srcDoc} title="Clinic theme — multi-page fidelity test" />;
}
