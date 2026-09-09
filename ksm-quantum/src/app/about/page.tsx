import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Target, Compass, Building2 } from 'lucide-react';
import Reveal from '@/components/Reveal';
import Faq from '@/components/Faq';
import { SITE } from '@/data/site';

export const metadata: Metadata = {
  title: 'About — Our Story, Founder & Vision',
  description:
    'KSM Quantum Technologies is a Chennai technology company founded in 2014 by K. S. Murugavel. We build and operate our own software products, AI platforms and digital business solutions.',
  alternates: { canonical: `${SITE.url}/about` },
  openGraph: { title: 'About KSM Quantum Technologies', description: 'Founded in 2014 in Chennai. We build and operate our own software products and AI platforms.', url: `${SITE.url}/about`, type: 'website' },
};

const ABOUT_FAQ = [
  { q: 'Is KSM Quantum Technologies an agency or a product company?', a: 'A product company. We build and operate our own platforms — Get4Domain, SignBot, NextBOS and HiDude — rather than delivering one-off outsourced projects.' },
  { q: 'How long has the company been operating?', a: 'Since 2014 — over a decade of building and running software from Chennai, India.' },
  { q: 'Who leads the company?', a: 'K. S. Murugavel, Founder & CEO, leads product direction and engineering.' },
];

export default function AboutPage() {
  return (
    <>
      <section className="container-x pb-14 pt-16 md:pb-20 md:pt-24">
        <Reveal><div className="eyebrow">About the company</div></Reveal>
        <Reveal delay={80}>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.06] tracking-tight md:text-6xl">
            A technology company that <span className="text-gradient">builds and runs</span> its own products.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Established in {SITE.founded} in {SITE.city}, {SITE.name} designs, engineers and operates
            software products, AI-powered platforms and digital business solutions.
          </p>
        </Reveal>
      </section>

      {/* Our Story */}
      <section className="container-x py-14 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div className="eyebrow flex items-center gap-2"><Building2 className="h-4 w-4" /> Our story</div>
          </Reveal>
          <Reveal delay={100}>
            <div className="space-y-5 text-[15px] leading-relaxed text-[var(--muted)]">
              <p>
                KSM Quantum Technologies began in Chennai in 2014 with a simple conviction: software
                is most valuable when the people who build it also stand behind it in production.
              </p>
              <p>
                Rather than take on disposable projects, we set out to build our own platforms and
                operate them for real users — learning, hardening and improving them over years.
                That discipline now spans four products across business technology, AI trading,
                business operating systems and digital assistants.
              </p>
              <p>
                Today we remain a focused, engineering-led team — building what&apos;s next and
                running it reliably for the businesses that depend on it.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Founder */}
      <section className="border-y border-[var(--border)] bg-[rgba(255,255,255,0.015)]">
        <div className="container-x py-16 md:py-24">
          <Reveal><div className="eyebrow">Founder &amp; CEO</div></Reveal>
          <div className="mt-8 grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
            <Reveal>
              <div className="grid h-28 w-28 place-items-center rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent)]/25 to-[var(--accent-cyan)]/15 font-display text-4xl font-bold text-white">
                KM
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div>
                <h2 className="font-display text-2xl font-bold md:text-3xl">K. S. Murugavel</h2>
                <div className="mt-1 text-sm font-medium text-[var(--accent-cyan)]">Founder &amp; CEO</div>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
                  A technology entrepreneur based in Chennai, K. S. Murugavel founded KSM Quantum
                  Technologies in 2014 and leads the company&apos;s product and engineering direction.
                  He focuses on building software products across business platforms, artificial
                  intelligence and automation — and on operating them well for the long term.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="container-x py-16 md:py-24">
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="card h-full p-7 md:p-9">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--accent-cyan)]"><Compass className="h-5 w-5" /></span>
              <h3 className="mt-4 font-display text-xl font-bold">Vision</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
                To be a technology company known for building intelligent, dependable software that
                genuinely advances how organizations operate — not just for the products we ship, but
                for the standard we hold them to.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="card h-full p-7 md:p-9">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--accent-cyan)]"><Target className="h-5 w-5" /></span>
              <h3 className="mt-4 font-display text-xl font-bold">Mission</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
                To build and operate software products and AI-powered platforms that empower
                businesses to work smarter, reach further and grow — engineered to scale and run
                reliably in the real world.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <Faq items={ABOUT_FAQ} eyebrow="About · FAQ" />

      <section className="container-x pb-24">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] p-8 md:p-10">
            <div>
              <h2 className="font-display text-2xl font-bold md:text-3xl">See what we build.</h2>
              <p className="mt-2 text-[var(--muted)]">Four products, built and operated in-house.</p>
            </div>
            <Link href="/products" className="btn-primary">Explore products <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
