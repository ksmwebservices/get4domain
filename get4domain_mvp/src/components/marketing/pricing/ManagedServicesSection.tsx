import Link from 'next/link';
import { ArrowRight, Code2, Smartphone, Database, Target, Share2, Film, Users2, Clapperboard, MessageSquareQuote, type LucideIcon } from 'lucide-react';

/**
 * Managed Services on /pricing — deliberately the loudest block on the page: a full-width dark
 * band (the rest of the page below the hero is light), the complete scope list, how a quote
 * works, and a large "Get a Custom Quote" CTA at both the top and bottom of the section.
 * Scope mirrors /managed-services. Work is custom-quoted — there is no fixed price list.
 */

const BUILD: { icon: LucideIcon; name: string; blurb: string }[] = [
  { icon: Code2, name: 'Custom web application', blurb: 'Bespoke web platforms built to your exact requirements — beyond what a template site can do.' },
  { icon: Smartphone, name: 'Mobile application', blurb: 'Native or cross-platform iOS / Android apps for your business or your customers.' },
  { icon: Database, name: 'Bespoke CRM / ERP / business software', blurb: 'Complete CRM, ERP or business-operating-system builds, tailored to how you actually work.' },
];

const GROW: { icon: LucideIcon; name: string; blurb: string }[] = [
  { icon: Target, name: 'Managed paid ads', blurb: 'Meta and Google Ads planned, run and optimized by our team on an ongoing basis.' },
  { icon: Share2, name: 'Social media management', blurb: 'Day-to-day management of your social presence — planning, posting and community response.' },
  { icon: Film, name: 'Content creation', blurb: 'Posts, reels and creative assets produced on a monthly retainer, built around your brand.' },
  { icon: Users2, name: 'Influencer collaboration', blurb: 'Sourcing, negotiating and managing influencer partnerships for your brand.' },
  { icon: Clapperboard, name: 'Commercial ad production', blurb: 'Fully produced commercial and brand films, from concept through final edit.' },
];

const STEPS = [
  { n: '1', t: 'Tell us what you need', d: 'A short form — what you want built or run, and your timeline.' },
  { n: '2', t: 'We scope it with you', d: 'Our team follows up directly to understand the work in detail.' },
  { n: '3', t: 'Itemized proposal', d: 'You receive a formal proposal with itemized pricing to review.' },
  { n: '4', t: 'Approve and we deliver', d: 'Built or run end to end by our team, to the scope you approved.' },
];

function ServiceCard({ s }: { s: { icon: LucideIcon; name: string; blurb: string } }) {
  const Icon = s.icon;
  return (
    <div className="flex flex-col rounded-2xl border border-white/5 bg-slate-800/60 p-5 backdrop-blur-xl transition-all hover:border-primary-400/20">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600"><Icon className="h-5 w-5 text-white" /></div>
      <p className="mt-3 text-base font-bold text-white">{s.name}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.blurb}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-warning-300">Custom-quoted</p>
    </div>
  );
}

export default function ManagedServicesSection() {
  return (
    <section id="managed-services" className="relative scroll-mt-24 overflow-hidden bg-slate-950 py-16 text-slate-100 md:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary-600/15 blur-[120px]" />
        <div className="absolute -right-10 bottom-0 h-[26rem] w-[26rem] rounded-full bg-warning-500/10 blur-[110px]" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-warning-300">3 · Managed Services</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">When you need it built — or run — for you</h2>
          <p className="mt-3 text-slate-400">Custom software and ongoing managed marketing, delivered end to end by our team. This is work beyond any subscription tier, so it is <span className="font-semibold text-white">scoped and quoted per project</span> — there is no fixed price list, because the work itself isn&apos;t fixed.</p>
        </div>

        {/* PRIMARY CTA — the unmissable one */}
        <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-warning-400/40 bg-gradient-to-br from-warning-400/15 via-slate-900/80 to-primary-500/10 p-6 shadow-glow-amber sm:p-10">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-warning-400 text-slate-900"><MessageSquareQuote className="h-8 w-8" /></span>
            <div className="flex-1">
              <p className="text-2xl font-bold text-white sm:text-3xl">Tell us what you need. Get an itemized quote.</p>
              <p className="mt-2 text-slate-300">Free to ask, no commitment. Our team reviews your requirements and comes back with a custom, itemized proposal.</p>
            </div>
            <Link href="/managed-services#quote" className="group inline-flex w-full flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-warning-400 px-8 py-4 text-lg font-bold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber md:w-auto">
              Get a Custom Quote <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* SCOPE */}
        <h3 className="mt-14 text-lg font-bold text-white">Build</h3>
        <p className="text-sm text-slate-400">Software made specifically for your business.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{BUILD.map((s) => <ServiceCard key={s.name} s={s} />)}</div>

        <h3 className="mt-10 text-lg font-bold text-white">Grow</h3>
        <p className="text-sm text-slate-400">Ongoing managed marketing and production.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{GROW.map((s) => <ServiceCard key={s.name} s={s} />)}</div>

        {/* HOW A QUOTE WORKS */}
        <h3 className="mt-14 text-center text-lg font-bold text-white">How a custom quote works</h3>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl border border-white/5 bg-slate-800/40 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warning-400 text-sm font-bold text-slate-900">{s.n}</span>
              <p className="mt-3 text-sm font-bold text-white">{s.t}</p>
              <p className="mt-1 text-sm text-slate-400">{s.d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/managed-services#quote" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-8 py-4 text-lg font-bold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
            Get a Custom Quote <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/managed-services" className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 px-8 py-4 font-medium text-white hover:bg-slate-800 sm:w-auto">
            See all Managed Services
          </Link>
        </div>
      </div>
    </section>
  );
}
