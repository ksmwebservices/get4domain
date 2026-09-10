import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Code2, BrainCircuit, Cloud, Globe, Smartphone, Workflow } from 'lucide-react';
import Reveal from '@/components/Reveal';
import ProductCard from '@/components/ProductCard';
import Faq from '@/components/Faq';
import { PRODUCTS, CAPABILITIES, STATS, SITE } from '@/data/site';

export const metadata: Metadata = {
  // Self-referencing canonical (root layout deliberately sets none — avoids the
  // global-canonical bug that de-indexed get4domain.com's inner pages). No openGraph
  // override here so the page inherits the layout's full OG (url = homepage + banner image).
  alternates: { canonical: SITE.url },
};

const ICONS = { Code2, BrainCircuit, Cloud, Globe, Smartphone, Workflow } as const;

const HOME_FAQ = [
  { q: 'What does KSM Quantum Technologies do?', a: 'We build and operate our own software products, AI-powered platforms and digital business solutions. We are a product company — we design, engineer and run the software ourselves, rather than doing one-off outsourced projects.' },
  { q: 'What products does KSM Quantum Technologies own?', a: 'Four: Get4Domain (business technology platform), SignBot (AI trading technology platform), NextBOS (next-generation business operating system) and HiDude (AI-powered digital assistant).' },
  { q: 'When and where was the company founded?', a: 'KSM Quantum Technologies was established in 2014 and is based in Chennai, India, at Tidel Park, Tharamani.' },
  { q: 'Who founded KSM Quantum Technologies?', a: 'It was founded by K. S. Murugavel, who leads the company as Founder & CEO.' },
];

export default function HomePage() {
  return (
    <>
      {/* ── HERO ── */}
      <section className="relative">
        <div className="container-x pb-16 pt-20 md:pb-24 md:pt-28">
          <Reveal>
            <div className="eyebrow">Established {SITE.founded} · {SITE.city}</div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 max-w-4xl font-display text-[2.6rem] font-bold leading-[1.04] tracking-tight md:text-6xl lg:text-7xl">
              Technology that builds <span className="text-gradient">what&apos;s next.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)] md:text-xl">
              {SITE.name} builds software products, AI-powered platforms and digital business
              solutions that help organizations operate, innovate and grow.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/products" className="btn-primary">Explore our products <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/contact" className="btn-ghost">Get in touch</Link>
            </div>
          </Reveal>

          {/* Brand banner — framed inside the hero (below the CTAs). */}
          <Reveal delay={300}>
            <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--border)] shadow-[0_30px_80px_-40px_rgba(109,108,255,0.5)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/ksm-hero-banner.jpg"
                alt="KSM Quantum Technologies — AI-powered solutions and its four products: Get4Domain, SignBot, NextBOS and HiDude"
                width={1200}
                height={447}
                className="w-full"
                loading="eager"
              />
            </div>
          </Reveal>

          {/* Stats — hairline row */}
          <Reveal delay={320}>
            <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="bg-[var(--bg)] px-5 py-6">
                  <div className="font-display text-2xl font-bold text-white md:text-3xl">{s.value}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PRODUCTS ── */}
      <section className="container-x py-20 md:py-28">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Our products</div>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">Four platforms, built and run in-house.</h2>
            </div>
            <Link href="/products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-cyan)] hover:text-white">
              All products <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.name} delay={i * 60}><ProductCard p={p} /></Reveal>
          ))}
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section className="border-y border-[var(--border)] bg-[rgba(255,255,255,0.015)]">
        <div className="container-x py-20 md:py-28">
          <Reveal>
            <div className="eyebrow">What we do</div>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">Engineering across the full modern stack.</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c, i) => {
              const Icon = ICONS[c.icon as keyof typeof ICONS] ?? Code2;
              return (
                <Reveal key={c.title} delay={i * 50}>
                  <div className="card h-full p-6">
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--accent-cyan)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 font-display text-lg font-semibold">{c.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{c.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── APPROACH ── */}
      <section className="container-x py-20 md:py-28">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <Reveal>
            <div>
              <div className="eyebrow">Why a product company</div>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">We don&apos;t just ship code. We run the products it becomes.</h2>
              <p className="mt-5 text-[15px] leading-relaxed text-[var(--muted)]">
                Because we build and operate our own platforms, every product is engineered for the
                long run — reliability, security and real-world usage, not a demo. What we learn
                running one platform makes the next one better.
              </p>
              <Link href="/about" className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-cyan)] hover:text-white">
                Read our story <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { k: 'Owned & operated', v: 'We run what we build in production, 24/7.' },
                { k: 'AI-native', v: 'Applied intelligence built into real workflows.' },
                { k: 'Engineered to scale', v: 'Typed, containerised, observable systems.' },
                { k: 'Chennai-built', v: 'A focused team shipping since 2014.' },
              ].map((f) => (
                <div key={f.k} className="card p-5">
                  <div className="font-display text-base font-semibold">{f.k}</div>
                  <p className="mt-1.5 text-sm text-[var(--muted)]">{f.v}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <Faq items={HOME_FAQ} />

      {/* ── CTA ── */}
      <section className="container-x pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] p-10 text-center md:p-16">
            <span
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(60% 120% at 50% 0%, rgba(109,108,255,0.22), transparent 70%)' }}
              aria-hidden
            />
            <h2 className="relative font-display text-3xl font-bold tracking-tight md:text-5xl">Let&apos;s build what&apos;s next, together.</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-[var(--muted)]">
              Partner with a team that designs, engineers and runs its own technology.
            </p>
            <div className="relative mt-8 flex justify-center">
              <Link href="/contact" className="btn-primary">Contact KSM Quantum <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
