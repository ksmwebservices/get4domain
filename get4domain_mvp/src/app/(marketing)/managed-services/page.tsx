import type { Metadata } from 'next';
import { ArrowRight, Code2, Smartphone, Database, Target, Share2, Film, Users2, Clapperboard, type LucideIcon } from 'lucide-react';
import Faq from '@/components/marketing/Faq';
import ManagedServicesForm from '@/components/marketing/ManagedServicesForm';

export const metadata: Metadata = {
  title: 'Managed Services — Custom Software & Marketing, Built for You',
  description: 'Bespoke web and mobile applications, full SME software builds, and ongoing managed marketing — paid ads, content, influencer collaborations and commercial production. Scoped and priced per project.',
  alternates: { canonical: 'https://get4domain.com/managed-services' },
};

const MANAGED_SERVICES_FAQ = [
  { q: 'How is this different from a DomainApp plan (Workspace from ₹999/month, BOS from ₹1,999/month)?', a: 'DomainApp is a subscription product — an industry website and business workspace on our shared platform. Managed Services is custom work beyond what any subscription tier covers: a bespoke mobile app, a full CRM/ERP build, or an ongoing managed marketing engagement. It\'s scoped, built and priced per client, not a fixed monthly plan.' },
  { q: 'Do I need to already be a Get4Domain / DomainApp customer?', a: 'No. Managed Services is a separate engagement — you can work with us on a custom build or managed marketing program whether or not you use DomainApp.' },
  { q: 'How is pricing worked out?', a: 'Every engagement is scoped individually. Tell us what you need below, and our team will come back with an itemized, custom quote — no fixed price list, because the work itself isn\'t fixed.' },
  { q: 'What happens after I submit the form?', a: 'Our team reviews your requirements and follows up directly to understand scope in more detail, then sends a formal proposal with itemized pricing for your review.' },
];

const SERVICES: { icon: LucideIcon; name: string; blurb: string }[] = [
  { icon: Code2, name: 'Custom Web Application', blurb: 'Bespoke web platforms built to your exact requirements — beyond what a template site can do.' },
  { icon: Smartphone, name: 'Mobile Application', blurb: 'Native or cross-platform iOS/Android apps for your business or your customers.' },
  { icon: Database, name: 'Full SME Software', blurb: 'Complete bespoke CRM, ERP or business operating system builds, tailored to how you actually work.' },
  { icon: Target, name: 'Managed Paid Ads', blurb: 'Meta and Google Ads, set up, run and optimized by our team on an ongoing basis.' },
  { icon: Share2, name: 'Social Media Management', blurb: 'Day-to-day management of your social presence — planning, posting, and community response.' },
  { icon: Film, name: 'Content Creation', blurb: 'Posts, reels and creative assets produced on a monthly retainer, built around your brand.' },
  { icon: Users2, name: 'Influencer Collaboration', blurb: 'Sourcing, negotiating and managing influencer partnerships for your brand.' },
  { icon: Clapperboard, name: 'Commercial Ad Production', blurb: 'Fully produced commercial and brand films, from concept through final edit.' },
];

export default function ManagedServicesPage() {
  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-100">
      {/* HERO */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60rem]">
        <div className="absolute -left-20 -top-32 h-[36rem] w-[36rem] rounded-full bg-primary-600/15 blur-[130px]" />
        <div className="absolute right-0 top-16 h-[28rem] w-[28rem] rounded-full bg-warning-500/10 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <section className="relative mx-auto max-w-3xl px-4 pb-6 pt-16 text-center sm:px-6 md:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
          Managed Services
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          When your business needs <span className="text-gradient-hero">more than a subscription.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          Custom web and mobile applications, full bespoke business software, and ongoing managed marketing — scoped, built and priced for your specific project. This is work beyond any DomainApp plan, delivered by our team end to end.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#quote" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
            Get a Custom Quote <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </section>

      {/* SERVICES */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.name} className="flex flex-col rounded-2xl border border-white/5 bg-slate-800/60 p-6 backdrop-blur-xl transition-all hover:border-primary-400/20 hover:shadow-glow">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h2 className="mt-4 text-base font-bold text-white">{s.name}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.blurb}</p>
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-slate-500">
          Every engagement is custom-scoped and custom-priced — there&apos;s no fixed price list because the work itself isn&apos;t fixed.
        </p>
      </section>

      {/* QUOTE FORM */}
      <section id="quote" className="relative border-t border-white/5 py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Tell us what you need.</h2>
            <p className="mt-3 text-slate-400">Our team will come back with a custom, itemized quote.</p>
          </div>
          <ManagedServicesForm />
        </div>
      </section>

      <Faq items={MANAGED_SERVICES_FAQ} subtitle="Managed Services, explained." />
    </div>
  );
}
