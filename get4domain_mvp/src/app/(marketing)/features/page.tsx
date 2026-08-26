import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Play, Globe, LayoutGrid, Phone, Bot, MessageCircle, Megaphone, Wallet, BarChart3, UserRound, Check, type LucideIcon } from 'lucide-react';
import PlatformSection from '@/components/marketing/home/PlatformSection';
import DashboardPreview from '@/components/marketing/home/DashboardPreview';
import CommunicationHub from '@/components/marketing/home/CommunicationHub';
import AIStudio from '@/components/marketing/home/AIStudio';

export const metadata: Metadata = {
  title: 'Features — Everything in DomainApp ₹999/month | Get4Domain',
  description: 'Every DomainApp feature in detail: industry website, Workplace, CRM & TeleCRM, AI Studio, Communication Hub, Growth Hub & campaigns, wallet, analytics and the client PWA — with what is included vs. pay-per-use.',
  alternates: { canonical: 'https://get4domain.com/features' },
};

type Tag = 'Included' | 'Pay-per-use' | 'Included + pay-per-use';

const GROUPS: { icon: LucideIcon; name: string; tag: Tag; blurb: string; bullets: string[] }[] = [
  { icon: Globe, name: 'Industry Website', tag: 'Included', blurb: 'A lead-generation website on your Get4Domain subdomain, deployed instantly on a ready-made template and customized within 24 hours.', bullets: ['Subdomain + hosting + SSL', 'SEO-optimized pages', 'Enquiry & lead forms', 'WhatsApp & call CTAs', 'Easy CMS for updates'] },
  { icon: LayoutGrid, name: 'Workplace', tag: 'Included', blurb: 'Your central business workspace — contacts, catalog, bookings/orders and invoicing, tailored to your industry.', bullets: ['Contacts (industry-labeled)', 'Products/Services catalog', 'Bookings / Orders / Appointments', 'GST invoicing', 'Accounts — expenses, P&L & GST'] },
  { icon: Phone, name: 'CRM + TeleCRM', tag: 'Included', blurb: 'Move every lead through a clear pipeline with calling, follow-ups and full customer history.', bullets: ['Lead pipeline (Kanban)', 'Follow-up reminders', 'Call queue & call records', 'Lead assignment', 'Customer history'] },
  { icon: Bot, name: 'AI Studio', tag: 'Pay-per-use', blurb: 'Create posters, reels, captions and documents with AI. ₹499 free credit included; further usage is paid from your wallet.', bullets: ['Reel maker', 'Poster designer', 'Content & captions', '₹499 free credit included', 'No unlimited claims — pay per use'] },
  { icon: MessageCircle, name: 'Communication Hub', tag: 'Included + pay-per-use', blurb: 'WhatsApp Business API (no monthly platform fee), transactional & promotional SMS, and email — from one unified inbox.', bullets: ['WhatsApp API — no monthly fee', 'Transactional SMS', 'Promotional SMS', 'Email', 'Unified inbox (variable usage from wallet)'] },
  { icon: Megaphone, name: 'Growth Hub & Campaigns', tag: 'Included + pay-per-use', blurb: 'Build a campaign, generate a shareable landing page and track results. Tools are included; paid distribution is pay-per-use.', bullets: ['Campaign builder', 'Shareable campaign link', 'Audience segments', 'Scheduling', 'Result tracking'] },
  { icon: Wallet, name: 'Wallet & Billing', tag: 'Pay-per-use', blurb: 'A prepaid wallet powers all variable usage with fully transparent, per-service pricing — you always see what consumed it.', bullets: ['Add money & top-ups', 'Usage & transaction history', 'Per-service & per-campaign cost', 'Low-balance warnings'] },
  { icon: BarChart3, name: 'Analytics', tag: 'Included', blurb: 'Connect the whole journey — website visitors to leads to customers to campaign results — in one view.', bullets: ['Website visitors', 'Enquiries & lead sources', 'Contacted / qualified leads', 'Conversion', 'Revenue where available'] },
  { icon: UserRound, name: 'Client App (PWA)', tag: 'Included', blurb: 'Your customers get their own installable app to book, pay, track orders and chat with you — from any phone.', bullets: ['Book & pay online', 'Order/booking tracking', 'WhatsApp chat', 'Push notifications', 'Installable PWA'] },
];

const TAG_STYLE: Record<Tag, string> = {
  'Included': 'bg-success-500/15 text-success-300 border-success-400/20',
  'Pay-per-use': 'bg-warning-500/15 text-warning-300 border-warning-400/20',
  'Included + pay-per-use': 'bg-primary-500/15 text-primary-300 border-primary-400/20',
};

export default function FeaturesPage() {
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
          Features
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Everything DomainApp does, <span className="text-gradient-hero">in one platform.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          One ₹999/month subscription unlocks the whole platform. Here&apos;s every capability in detail — and exactly what&apos;s included vs. paid per use from your wallet.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/book-demo" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
            Buy Now — ₹999/mo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/demo/clinic" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-slate-800/60 px-6 py-3 font-medium text-slate-100 backdrop-blur-xl transition-all hover:bg-slate-800/80 sm:w-auto">
            <Play className="h-4 w-4 text-primary-300" /> Visit Demo
          </Link>
        </div>
      </section>

      {/* FEATURE GROUPS — detailed, with included vs pay-per-use */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => {
            const Icon = g.icon;
            return (
              <div key={g.name} className="flex flex-col rounded-2xl border border-white/5 bg-slate-800/60 p-6 backdrop-blur-xl transition-all hover:border-primary-400/20 hover:shadow-glow">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${TAG_STYLE[g.tag]}`}>{g.tag}</span>
                </div>
                <h2 className="mt-4 text-lg font-bold text-white">{g.name}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{g.blurb}</p>
                <ul className="mt-4 space-y-1.5">
                  {g.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[13px] text-slate-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-400" />{b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-slate-500">
          <span className="font-semibold text-success-300">Included</span> = in your ₹999 subscription ·{' '}
          <span className="font-semibold text-warning-300">Pay-per-use</span> = billed from your wallet only when you use it. Custom domain is a separate, optional service.
        </p>
      </section>

      {/* SEE IT IN ACTION — reuse the existing animated mockups */}
      <div className="relative border-t border-white/5">
        <div className="mx-auto max-w-3xl px-4 pt-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">See the key features in action</h2>
          <p className="mt-3 text-slate-400">The same interactive mockups from the homepage — explore the apps, dashboard, communication and AI tools.</p>
        </div>
        <PlatformSection />
        <DashboardPreview />
        <CommunicationHub />
        <AIStudio />
      </div>

      {/* CTA */}
      <section className="relative border-t border-white/5 py-16 text-center">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">One plan, every feature above.</h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-400">₹999/month or ₹9,999/year. Instant deploy, live in 24 hours.</p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/book-demo" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
              Buy Now — ₹999/mo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/pricing" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-slate-800/60 px-6 py-3 font-medium text-slate-100 backdrop-blur-xl transition-all hover:bg-slate-800/80 sm:w-auto">
              See full pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
