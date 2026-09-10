import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Code2, BrainCircuit, Cloud, Globe, Smartphone, Workflow } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { CAPABILITIES, SITE, OG_IMAGE } from '@/data/site';

const ICONS = { Code2, BrainCircuit, Cloud, Globe, Smartphone, Workflow } as const;

export const metadata: Metadata = {
  title: 'Technology — Software, AI, Cloud, Web, Mobile & Automation',
  description:
    'How KSM Quantum Technologies builds: software engineering, applied artificial intelligence, cloud & infrastructure, web platforms, mobile experiences and workflow automation.',
  alternates: { canonical: `${SITE.url}/technology` },
  openGraph: { title: 'Technology at KSM Quantum Technologies', description: 'Software engineering, AI, cloud, web, mobile and automation.', url: `${SITE.url}/technology`, type: 'website', images: [OG_IMAGE] },
};

const STACK = ['TypeScript', 'Next.js', 'NestJS', 'React', 'Node.js', 'PostgreSQL', 'Prisma', 'Docker', 'Nginx', 'Cloud', 'Applied AI', 'PWA'];

export default function TechnologyPage() {
  return (
    <>
      <section className="container-x pb-14 pt-16 md:pb-20 md:pt-24">
        <Reveal><div className="eyebrow">Technology &amp; engineering</div></Reveal>
        <Reveal delay={80}>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.06] tracking-tight md:text-6xl">
            Built on a <span className="text-gradient">modern, proven</span> stack.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            The disciplines behind every product {SITE.name} builds — engineered to scale, secured
            by default and run reliably in production.
          </p>
        </Reveal>
      </section>

      <section className="container-x pb-16 md:pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c, i) => {
            const Icon = ICONS[c.icon as keyof typeof ICONS] ?? Code2;
            return (
              <Reveal key={c.title} delay={i * 50}>
                <div className="card h-full p-7">
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--accent-cyan)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="mt-5 font-display text-xl font-semibold">{c.title}</h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--muted)]">{c.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Stack marquee-ish chip row */}
      <section className="border-y border-[var(--border)] bg-[rgba(255,255,255,0.015)]">
        <div className="container-x py-16 md:py-20">
          <Reveal>
            <div className="eyebrow">The toolkit</div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">Technologies we build with.</h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {STACK.map((t) => (
                <span key={t} className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 font-mono text-[13px] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-white">
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Principles */}
      <section className="container-x py-16 md:py-24">
        <Reveal>
          <div className="eyebrow">How we engineer</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">Principles that hold across every product.</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { n: '01', t: 'Typed end to end', d: 'Strict TypeScript from database to UI — fewer surprises, safer change.' },
            { n: '02', t: 'Operated, not shipped-and-gone', d: 'Containerised, observable deployments we run and watch in production.' },
            { n: '03', t: 'AI where it earns its place', d: 'Applied intelligence embedded in real workflows — useful, not decorative.' },
          ].map((p, i) => (
            <Reveal key={p.n} delay={i * 60}>
              <div className="card h-full p-7">
                <div className="font-mono text-sm text-[var(--accent-cyan)]">{p.n}</div>
                <h3 className="mt-3 font-display text-lg font-semibold">{p.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-x pb-24">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] p-8 md:p-10">
            <div>
              <h2 className="font-display text-2xl font-bold md:text-3xl">Have a project in mind?</h2>
              <p className="mt-2 text-[var(--muted)]">Let&apos;s talk about what we can build.</p>
            </div>
            <Link href="/contact" className="btn-primary">Get in touch <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
