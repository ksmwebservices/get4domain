import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Star, Users, MessageCircle } from 'lucide-react';
import {
  getCategory, getSubcategory, getSubcategories, getSections, getSection, CATEGORY_IDS,
} from '@/data/demo-site';
import { resolveCatalog } from '@/data/demo-catalog';
import DemoSiteNav from '@/components/DemoSiteNav';
import DemoContactSection from '@/components/DemoContactSection';
import DemoCatalogGrid from '@/components/DemoCatalogGrid';
import ChatBot from '@/components/ChatBot';
import TourNav from '@/components/TourNav';

interface Params { category: string; rest?: string[] }
const SAMPLE_NAMES = ['Ravi Kumar', 'Priya Sharma', 'Arjun Menon', 'Sneha Reddy', 'Imran Khan', 'Deepa Nair'];

export function generateStaticParams(): { category: string; rest: string[] }[] {
  const out: { category: string; rest: string[] }[] = [];
  for (const id of CATEGORY_IDS) {
    out.push({ category: id, rest: [] });
    for (const s of getSections(id)) out.push({ category: id, rest: [s.slug] });
    for (const sub of getSubcategories(id)) {
      if (sub.id === 'general') continue;
      out.push({ category: id, rest: [sub.id] });
      for (const s of getSections(id)) out.push({ category: id, rest: [sub.id, s.slug] });
    }
  }
  return out;
}

/** rest → { subId, sectionSlug }, or null if the path is unknown. */
function parse(categoryId: string, rest: string[]): { subId?: string; sectionSlug?: string } | null {
  const sections = getSections(categoryId);
  const subs = getSubcategories(categoryId);
  if (rest.length === 0) return {};
  if (rest.length === 1) {
    if (subs.some((s) => s.id === rest[0] && s.id !== 'general')) return { subId: rest[0] };
    if (sections.some((s) => s.slug === rest[0])) return { sectionSlug: rest[0] };
    return null;
  }
  if (rest.length === 2) {
    if (!subs.some((s) => s.id === rest[0])) return null;
    if (!sections.some((s) => s.slug === rest[1])) return null;
    return { subId: rest[0], sectionSlug: rest[1] };
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, rest = [] } = await params;
  const cat = getCategory(category);
  const parsed = cat ? parse(category, rest) : null;
  if (!cat || !parsed) return { title: 'Demo — Get4Domain' };
  const sub = getSubcategory(category, parsed.subId);
  const section = parsed.sectionSlug ? getSection(category, parsed.sectionSlug) : undefined;
  const isSub = Boolean(parsed.subId && parsed.subId !== 'general');
  const siteName = isSub ? `${sub.name} ${cat.name}` : cat.name;
  // Root layout adds "| Get4Domain" via title.template — don't repeat it here.
  const title = section
    ? `${section.label} · ${siteName} Demo`
    : `${siteName} Website Demo — ${cat.tagline}`;
  const description = section
    ? `${section.label} for a ${cat.name.toLowerCase()} business. ${cat.shortDesc}`
    : cat.shortDesc;
  const ogTitle = `${title} | Get4Domain`;
  return {
    title,
    description,
    keywords: cat.seoKeywords,
    openGraph: {
      title: ogTitle, description, type: 'website',
      images: [{ url: cat.coverImage, width: 800, height: 600, alt: `${cat.name} website` }],
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description, images: [cat.coverImage] },
  };
}

export default async function DemoPage({ params }: { params: Promise<Params> }) {
  const { category, rest = [] } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();
  const parsed = parse(category, rest);
  if (!parsed) notFound();

  const sub = getSubcategory(category, parsed.subId);
  const sections = getSections(category);
  const section = parsed.sectionSlug ? getSection(category, parsed.sectionSlug) : undefined;
  const base = parsed.subId && parsed.subId !== 'general' ? `/demo/${category}/${parsed.subId}` : `/demo/${category}`;
  const brand = sub.name;
  const isSub = Boolean(parsed.subId && parsed.subId !== 'general');
  const catalog = resolveCatalog(category, isSub ? parsed.subId : undefined);
  const catalogSection = sections.find((s) => s.type === 'catalog');
  const waText = encodeURIComponent(`Hi ${brand}, I saw your ${cat.name.toLowerCase()} website and I'm interested. Could you share details?`);

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness',
    name: `${brand} — ${cat.name}`, description: cat.shortDesc, image: cat.coverImage,
    url: `https://get4domain.com${base}${section ? `/${section.slug}` : ''}`,
    areaServed: 'IN', priceRange: '₹₹',
  };

  return (
    <div className="min-h-screen bg-white pb-16 md:pb-0">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DemoSiteNav business={brand} base={base} sections={sections} />

      {/* Banner */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cat.coverImage} alt={cat.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-primary-900/70 to-primary-700/60" />
        <div className="relative mx-auto max-w-5xl px-5 py-14 text-white sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{cat.name}{parsed.subId && parsed.subId !== 'general' ? ` · ${sub.name}` : ''}</span>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">{section ? section.label : cat.sampleContent.heroHeadline}</h1>
          <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">{section ? cat.shortDesc : cat.sampleContent.heroSubline}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {catalog && catalogSection && (
              <Link href={`${base}/${catalogSection.slug}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary-700 hover:bg-white/90">
                Browse {catalog.catalogNoun} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-success-500 px-5 py-3 text-sm font-bold text-white hover:bg-success-600">
              <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-12">
        {!section ? (
          // ── Home ──────────────────────────────────────────────
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Explore</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map((s) => (
                  <Link key={s.slug} href={`${base}/${s.slug}`} className="rounded-2xl border border-slate-200 p-5 transition-shadow hover:shadow-md">
                    <h3 className="flex items-center justify-between font-bold text-slate-900">{s.label}<ArrowRight className="h-4 w-4 text-primary-500" /></h3>
                    <p className="mt-1 text-sm text-slate-500">View our {s.label.toLowerCase()}.</p>
                  </Link>
                ))}
              </div>
            </div>
            {catalog && (
              <div>
                <div className="flex items-end justify-between">
                  <h2 className="text-2xl font-bold text-slate-900">Popular {catalog.catalogNoun}</h2>
                  {catalogSection && <Link href={`${base}/${catalogSection.slug}`} className="text-sm font-semibold text-primary-600 hover:text-primary-700">View all →</Link>}
                </div>
                <p className="mt-1 text-sm text-slate-500">{cat.sampleContent.highlight}</p>
                <div className="mt-5">
                  <DemoCatalogGrid catalog={catalog} business={brand} industryLabel={cat.name} coverImage={cat.coverImage} limit={3} />
                </div>
              </div>
            )}
            <div className="rounded-2xl bg-slate-50 p-6 text-center">
              <p className="text-slate-600">{cat.fullDesc}</p>
              {sections.find((s) => s.type === 'contact') && (
                <Link href={`${base}/${sections.find((s) => s.type === 'contact')!.slug}`} className="mt-4 inline-flex rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700">Enquire now</Link>
              )}
            </div>
          </div>
        ) : section.type === 'contact' ? (
          <DemoContactSection business={brand} industryLabel={cat.name} />
        ) : section.type === 'about' ? (
          <div className="prose max-w-none">
            <h2 className="text-2xl font-bold text-slate-900">About {brand}</h2>
            <p className="mt-3 text-slate-600">{cat.fullDesc}</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {cat.whatYouGet.slice(0, 6).map((w) => <li key={w} className="flex items-start gap-2 text-sm text-slate-700"><Star className="mt-0.5 h-4 w-4 text-amber-400" />{w}</li>)}
            </ul>
          </div>
        ) : section.type === 'team' ? (
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{section.label}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {(catalog?.team ?? SAMPLE_NAMES.slice(0, 3).map((n) => ({ name: n, role: cat.name, note: undefined }))).map((m) => (
                <div key={m.name} className="rounded-2xl border border-slate-200 p-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700"><Users className="h-7 w-7" /></div>
                  <h3 className="mt-3 font-bold text-slate-900">{m.name}</h3>
                  <p className="text-sm text-primary-600">{m.role}</p>
                  {m.note && <p className="mt-0.5 text-xs text-slate-400">{m.note}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : section.type === 'gallery' ? (
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{section.label}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={cat.coverImage} alt={`${cat.name} ${i + 1}`} className="h-40 w-full rounded-xl object-cover" />
              ))}
            </div>
          </div>
        ) : section.type === 'booking' ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">{section.label}</h2>
            <p className="mt-2 text-slate-500">Send us your details and we&apos;ll confirm on WhatsApp.</p>
            <div className="mt-6"><DemoContactSection business={brand} industryLabel={cat.name} /></div>
          </div>
        ) : (
          // catalog (menu / services / packages / listings / products …)
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{section.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{cat.sampleContent.highlight}</p>
            <div className="mt-6">
              {catalog ? (
                <DemoCatalogGrid catalog={catalog} business={brand} industryLabel={cat.name} coverImage={cat.coverImage} />
              ) : (
                <p className="text-slate-500">Details coming soon.</p>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <p>{brand} — a Get4Domain demo site.</p>
        <Link href="/book-demo" className="mt-1 inline-block font-semibold text-primary-600">Build your own with Get4Domain →</Link>
      </footer>

      <ChatBot />
      <TourNav />
    </div>
  );
}
