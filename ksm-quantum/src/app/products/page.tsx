import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import ProductCard from '@/components/ProductCard';
import { PRODUCTS, SITE, OG_IMAGE } from '@/data/site';

export const metadata: Metadata = {
  title: 'Products — Get4Domain, SignBot, NextBOS, HiDude',
  description:
    'The software products KSM Quantum Technologies builds and operates: Get4Domain (business technology platform), SignBot (AI trading platform), NextBOS (business operating system) and HiDude (AI digital assistant).',
  alternates: { canonical: `${SITE.url}/products` },
  openGraph: { title: 'Products by KSM Quantum Technologies', description: 'Get4Domain, SignBot, NextBOS and HiDude — built and operated in-house.', url: `${SITE.url}/products`, type: 'website', images: [OG_IMAGE] },
};

export default function ProductsPage() {
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: PRODUCTS.map((p, i) => ({
      '@type': 'ListItem', position: i + 1, name: p.name, description: p.category, url: p.href,
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <section className="container-x pb-14 pt-16 md:pb-20 md:pt-24">
        <Reveal><div className="eyebrow">Our products</div></Reveal>
        <Reveal delay={80}>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.06] tracking-tight md:text-6xl">
            Software we build <span className="text-gradient">and operate.</span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Four platforms across business technology, AI trading, business operating systems and
            digital assistants — each designed, engineered and run by {SITE.name}.
          </p>
        </Reveal>
      </section>

      <section className="container-x pb-16 md:pb-24">
        <div className="grid gap-4 md:grid-cols-2">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.name} delay={i * 60}><ProductCard p={p} /></Reveal>
          ))}
        </div>
      </section>

      {/* Deeper detail rows */}
      <section className="border-t border-[var(--border)]">
        <div className="container-x divide-y divide-[var(--border)]">
          {PRODUCTS.map((p) => (
            <Reveal key={p.name}>
              <div className="grid gap-4 py-10 md:grid-cols-[0.5fr_1fr_auto] md:items-center md:gap-8 md:py-12">
                <div>
                  <h2 className="font-display text-2xl font-bold" style={{ color: p.accent }}>{p.name}</h2>
                  <div className="mt-1 text-[13px] text-[var(--muted)]">{p.category}</div>
                </div>
                <p className="text-[15px] leading-relaxed text-[var(--muted)]">{p.blurb}</p>
                {p.comingSoon ? (
                  <Link href={`/products/${p.slug}`} className="btn-ghost justify-center whitespace-nowrap md:justify-start">
                    Learn more <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="btn-ghost justify-center whitespace-nowrap md:justify-start">
                    Visit {p.domain} <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
