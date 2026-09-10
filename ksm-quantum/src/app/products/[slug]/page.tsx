import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Mail, FlaskConical } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { PRODUCTS, SITE } from '@/data/site';

// Coming Soon pages exist only for not-yet-launched products (NextBOS, HiDude).
export function generateStaticParams() {
  return PRODUCTS.filter((p) => p.comingSoon).map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false; // any other slug (live products) → 404, no internal page

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const p = PRODUCTS.find((x) => x.slug === slug && x.comingSoon);
  if (!p) return {};
  const url = `${SITE.url}/products/${p.slug}`;
  const description = `${p.name} — ${p.category}. In research & development at KSM Quantum Technologies. ${p.blurb}`;
  return {
    title: `${p.name} — ${p.category} (Coming Soon)`,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${p.name} — Coming Soon`, description, url, type: 'website' },
  };
}

export default async function ComingSoonProduct(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const p = PRODUCTS.find((x) => x.slug === slug && x.comingSoon);
  if (!p) notFound();

  const mailto = `mailto:${SITE.email}?subject=${encodeURIComponent(`Interested in ${p.name}`)}&body=${encodeURIComponent(`Hi KSM Quantum team,\n\nI'd like to hear more about ${p.name} (${p.category}) when it's available.\n\n`)}`;

  return (
    <section className="relative">
      {/* product-accent glow, contained (matches the site's motif, not a blur-blob) */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{ background: `radial-gradient(60% 100% at 50% 0%, ${p.accent}22, transparent 70%)` }}
        aria-hidden
      />
      <div className="container-x relative flex min-h-[70vh] flex-col justify-center py-20 md:py-28">
        <Reveal>
          <Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All products
          </Link>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-8 inline-flex items-center gap-2 self-start rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5">
            <FlaskConical className="h-3.5 w-3.5" style={{ color: p.accent }} />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: p.accent }}>In Research &amp; Development</span>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">{p.name}</h1>
          <div className="mt-3 font-display text-lg font-medium md:text-2xl" style={{ color: p.accent }}>{p.category}</div>
        </Reveal>

        <Reveal delay={200}>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">{p.about ?? p.blurb}</p>
        </Reveal>

        <Reveal delay={280}>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href={mailto} className="btn-primary"><Mail className="h-4 w-4" /> Register your interest</a>
            <Link href="/products" className="btn-ghost">See our live products <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <p className="mt-5 max-w-xl text-sm text-[var(--muted)]">
            {p.name} is being built by {SITE.name}. Want early access or updates? Email us at{' '}
            <a href={`mailto:${SITE.email}`} className="text-[var(--accent-cyan)] hover:text-white">{SITE.email}</a> and we&apos;ll keep you posted.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
