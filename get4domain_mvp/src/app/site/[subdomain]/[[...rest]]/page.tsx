import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Star } from 'lucide-react';
import { getCategory } from '@/data/demo-site';
import { resolveCatalog, type CategoryCatalog, type DemoListing } from '@/data/demo-catalog';
import { getListingFields } from '@/data/listing-fields';
import DemoSiteNav from '@/components/DemoSiteNav';
import DemoContactSection from '@/components/DemoContactSection';
import DemoCatalogGrid from '@/components/DemoCatalogGrid';
import ChatBot from '@/components/ChatBot';
import { canonicalIndustryId } from '@/data/demo-site';
import { getEngineIndustry } from '@/engine/registry';
import type { EngineSiteData } from '@/engine/types';

// Live vendor sites are per-vendor and change whenever the vendor edits — never static.
export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

interface VendorProduct {
  id: string; name: string; description: string | null; price: string | null;
  image: string | null; category: string | null; customFields: Record<string, string> | null;
}
interface SiteData {
  vendor: { id: string; businessName: string; industry: string; subdomain: string | null };
  cms: {
    businessName: string | null; tagline: string | null; about: string | null;
    logo: string | null; banner: string | null; phone: string | null; whatsapp: string | null;
    email: string | null; address: string | null; seoTitle: string | null; seoDesc: string | null;
    seoKeywords: string | null;
  } | null;
  products: VendorProduct[];
}

/** Fetch the live site for a subdomain (real, non-sandbox vendors only). */
async function fetchSite(subdomain: string): Promise<SiteData | null> {
  try {
    const res = await fetch(`${API_BASE}/cms/site/${encodeURIComponent(subdomain)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as SiteData;
  } catch {
    return null;
  }
}

const priceStr = (p: string | null): string | undefined => {
  if (!p) return undefined;
  const t = p.trim();
  if (!t) return undefined;
  return /^[₹$]/.test(t) ? t : `₹${t}`;
};

/** Build the same CategoryCatalog shape the demo grid renders — from real products. */
function buildCatalog(site: SiteData): CategoryCatalog {
  const industry = site.vendor.industry;
  const base = resolveCatalog(industry);
  const fieldDefs = getListingFields(industry);
  const items: DemoListing[] = site.products.map((p) => {
    const cf = p.customFields ?? {};
    const fields = fieldDefs
      .filter((f) => typeof cf[f.key] === 'string' && cf[f.key].trim())
      .map((f) => ({ label: f.label, value: cf[f.key] }));
    const tags = typeof cf.tags === 'string' && cf.tags.trim()
      ? cf.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;
    return {
      name: p.name,
      price: priceStr(p.price),
      desc: p.description ?? undefined,
      image: p.image ?? undefined,
      fields: fields.length ? fields : undefined,
      tags,
    };
  });
  return {
    flow: base?.flow ?? 'enquire',
    ctaLabel: base?.ctaLabel ?? 'Enquire Now',
    catalogNoun: base?.catalogNoun ?? 'services',
    items,
  };
}

interface Params { subdomain: string; rest?: string[] }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { subdomain } = await params;
  const site = await fetchSite(subdomain);
  if (!site) return { title: 'Site not found' };
  const name = site.cms?.businessName || site.vendor.businessName;
  const title = site.cms?.seoTitle || `${name} — ${site.cms?.tagline ?? 'Official Website'}`;
  const description = site.cms?.seoDesc || site.cms?.about || `${name} — official website.`;
  return {
    title,
    description,
    keywords: site.cms?.seoKeywords ?? undefined,
    openGraph: { title, description, type: 'website', images: site.cms?.banner ? [site.cms.banner] : [] },
  };
}

export default async function VendorSitePage({ params }: { params: Promise<Params> }) {
  const { subdomain, rest = [] } = await params;
  const site = await fetchSite(subdomain);
  if (!site) notFound();

  // Industry-switch: if this vendor's industry has a bespoke engine site (Real
  // Estate today), render THAT — a genuinely different information architecture and
  // conversion journey. Every other industry keeps the existing generic renderer
  // untouched, so nothing regresses while industries are migrated one at a time.
  const engineIndustry = getEngineIndustry(canonicalIndustryId(site.vendor.industry));
  if (engineIndustry && (rest.length === 0 || rest[0] === 'home')) {
    const EngineSite = engineIndustry.Site;
    return <EngineSite site={site as unknown as EngineSiteData} subdomain={subdomain} />;
  }

  const page = rest[0] ?? 'home';
  if (!['home', 'listings', 'contact'].includes(page)) notFound();

  const cat = getCategory(site.vendor.industry);
  const brand = site.cms?.businessName || site.vendor.businessName;
  const catalog = buildCatalog(site);
  const coverImage = site.cms?.banner || cat?.coverImage || '';
  const base = `/site/${subdomain}`;
  const nounCap = catalog.catalogNoun.charAt(0).toUpperCase() + catalog.catalogNoun.slice(1);
  const sections = [
    { slug: 'listings', label: nounCap, type: 'catalog' as const },
    { slug: 'contact', label: 'Contact', type: 'contact' as const },
  ];
  const industryLabel = cat?.name ?? 'business';
  const hasListings = catalog.items.length > 0;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness',
    name: brand, description: site.cms?.about ?? site.cms?.tagline ?? undefined,
    image: coverImage || undefined, telephone: site.cms?.phone ?? undefined,
    address: site.cms?.address ?? undefined, url: `https://get4domain.com${base}`, areaServed: 'IN',
  };

  return (
    <div className="min-h-screen bg-white pb-16 md:pb-0">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DemoSiteNav business={brand} base={base} sections={sections} />

      {/* Banner */}
      <section className="relative overflow-hidden">
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt={brand} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-primary-900/70 to-primary-700/60" />
        <div className="relative mx-auto max-w-5xl px-5 py-14 text-white sm:py-20">
          {site.cms?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.cms.logo} alt={`${brand} logo`} className="mb-4 h-14 w-14 rounded-xl bg-white/90 object-contain p-1" />
          )}
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
            {page === 'listings' ? nounCap : page === 'contact' ? 'Contact Us' : brand}
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">
            {page === 'home' ? (site.cms?.tagline ?? `Welcome to ${brand}`) : (site.cms?.tagline ?? '')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {hasListings && (
              <Link href={`${base}/listings`} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary-700 hover:bg-white/90">
                Browse {catalog.catalogNoun}
              </Link>
            )}
            {site.cms?.whatsapp && (
              <a href={`https://wa.me/${site.cms.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-success-500 px-5 py-3 text-sm font-bold text-white hover:bg-success-600">
                Chat on WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-12">
        {page === 'home' && (
          <div className="space-y-12">
            {site.cms?.about && (
              <section>
                <h2 className="text-2xl font-bold text-slate-900">About {brand}</h2>
                <p className="mt-3 whitespace-pre-line text-slate-600">{site.cms.about}</p>
              </section>
            )}
            {hasListings ? (
              <section>
                <div className="flex items-end justify-between">
                  <h2 className="text-2xl font-bold text-slate-900">Our {catalog.catalogNoun}</h2>
                  <Link href={`${base}/listings`} className="text-sm font-semibold text-primary-600 hover:text-primary-700">View all →</Link>
                </div>
                <div className="mt-5">
                  <DemoCatalogGrid catalog={catalog} business={brand} industryLabel={industryLabel} coverImage={coverImage} limit={6} />
                </div>
              </section>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
                <Star className="mx-auto mb-2 h-6 w-6 text-amber-400" />
                This site is being set up. Please check back soon.
              </div>
            )}
          </div>
        )}

        {page === 'listings' && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Our {catalog.catalogNoun}</h2>
            <div className="mt-6">
              {hasListings ? (
                <DemoCatalogGrid catalog={catalog} business={brand} industryLabel={industryLabel} coverImage={coverImage} />
              ) : (
                <p className="text-slate-500">Nothing listed yet.</p>
              )}
            </div>
          </div>
        )}

        {page === 'contact' && (
          <div>
            <h2 className="text-center text-2xl font-bold text-slate-900">Get in touch</h2>
            {(site.cms?.phone || site.cms?.email || site.cms?.address) && (
              <div className="mx-auto mt-4 max-w-lg space-y-1 text-center text-sm text-slate-600">
                {site.cms?.phone && <p>Phone: <span className="font-semibold text-slate-800">{site.cms.phone}</span></p>}
                {site.cms?.email && <p>Email: <span className="font-semibold text-slate-800">{site.cms.email}</span></p>}
                {site.cms?.address && <p>{site.cms.address}</p>}
              </div>
            )}
            <div className="mt-6"><DemoContactSection business={brand} industryLabel={industryLabel} /></div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} {brand}. All rights reserved.</p>
        <p className="mt-1">Powered by <Link href="/" className="font-semibold text-primary-600">Get4Domain</Link></p>
      </footer>

      <ChatBot />
    </div>
  );
}
