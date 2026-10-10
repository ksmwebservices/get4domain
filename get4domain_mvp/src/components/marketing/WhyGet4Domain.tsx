import Link from 'next/link';
import { Check, Zap, Layers, IndianRupee, LifeBuoy, ArrowRight } from 'lucide-react';
import { WHY_ROWS } from '@/data/platform-features';

/**
 * "Why Get4Domain" — the argument and the cost table. General positioning only: it compares
 * against *categories* (website builders + separate tools, agencies / custom development),
 * never named competitors. `tone` lets the same section sit on the dark homepage and the light
 * pricing page.
 */

const ARGUMENTS = [
  { icon: Zap, title: 'Live in 24 hours, not months', body: 'Your site deploys instantly on a ready-made industry template and is customized to your brand within 24 hours. No discovery phase, no six-month build.' },
  { icon: Layers, title: 'One login instead of ten subscriptions', body: 'Website, CRM, accounting, HRM, inventory, WhatsApp, SMS, email, AI content and SEO share one dashboard and one set of customer data — nothing to stitch together.' },
  { icon: IndianRupee, title: 'Priced for Indian businesses', body: 'GST invoicing, UPI and card payments, WhatsApp-first communication and 20+ industry setups, from ₹999/month — a fraction of piecemeal tools or a custom build.' },
  { icon: LifeBuoy, title: 'We run it, and we can run it for you', body: 'Hosting, updates and support are ours. When you want more than software, Managed Ads runs your ads and Managed Services builds what no template can.' },
];

export default function WhyGet4Domain({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  const t = {
    section: dark ? 'relative py-16 sm:py-20' : 'border-t border-slate-200 bg-slate-50 py-16 md:py-20',
    eyebrow: dark ? 'text-primary-300' : 'text-primary-600',
    h2: dark ? 'text-white' : 'text-slate-900',
    sub: dark ? 'text-slate-400' : 'text-slate-600',
    card: dark ? 'border-white/5 bg-slate-800/60 backdrop-blur-xl' : 'border-slate-200 bg-white shadow-sm',
    cardTitle: dark ? 'text-white' : 'text-slate-900',
    cardBody: dark ? 'text-slate-400' : 'text-slate-600',
    iconBox: dark ? 'bg-gradient-to-br from-primary-400 to-primary-600 text-white' : 'bg-primary-50 text-primary-600',
    tableWrap: dark ? 'border-white/5 bg-slate-800/60 backdrop-blur-xl' : 'border-slate-200 bg-white shadow-sm',
    head: dark ? 'border-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600',
    row: dark ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-100',
    feature: dark ? 'text-slate-300' : 'text-slate-700',
    us: dark ? 'text-primary-300' : 'text-primary-700',
    them: dark ? 'text-slate-400' : 'text-slate-500',
    note: dark ? 'text-slate-500' : 'text-slate-500',
  };
  return (
    <section id="why-get4domain" className={`scroll-mt-24 ${t.section}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className={`text-xs font-bold uppercase tracking-wider ${t.eyebrow}`}>Why Get4Domain</p>
          <h2 className={`mt-2 text-3xl font-bold tracking-tight md:text-4xl ${t.h2}`}>Why Get4Domain beats builders, agencies and piecemeal tools</h2>
          <p className={`mt-3 ${t.sub}`}>A website builder gives you a site and sends you elsewhere for everything else. An agency gives you one build and a monthly invoice. Get4Domain gives you the whole business — live in a day.</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ARGUMENTS.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.title} className={`rounded-2xl border p-5 ${t.card}`}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.iconBox}`}><Icon className="h-5 w-5" /></span>
                <p className={`mt-3 text-base font-bold ${t.cardTitle}`}>{a.title}</p>
                <p className={`mt-1.5 text-sm leading-relaxed ${t.cardBody}`}>{a.body}</p>
              </div>
            );
          })}
        </div>

        <h3 className={`mt-14 text-center text-xl font-semibold ${t.h2}`}>
          Get4Domain vs. the usual alternatives
        </h3>
        <div className={`mt-6 overflow-x-auto rounded-2xl border ${t.tableWrap}`}>
          <div className="min-w-[620px]">
            <div className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 border-b px-4 py-3 text-xs font-semibold sm:px-5 ${t.head}`}>
              <span>What you need</span>
              <span className={t.us}>Get4Domain</span>
              <span>Website builder + separate tools</span>
              <span>Agency / custom development</span>
            </div>
            {WHY_ROWS.map((r) => (
              <div key={r.feature} className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center gap-2 border-b px-4 py-2.5 text-xs transition-colors last:border-0 sm:px-5 ${t.row}`}>
                <span className={t.feature}>{r.feature}</span>
                <span className={`flex items-center gap-1 font-semibold ${t.us}`}>{r.us === true ? <Check className="h-4 w-4" /> : r.us}</span>
                <span className={t.them}>{r.builders}</span>
                <span className={t.them}>{r.agency}</span>
              </div>
            ))}
          </div>
        </div>
        <p className={`mt-3 text-center text-[11px] ${t.note}`}>Alternatives are shown as general categories using typical Indian SMB pricing ranges, for comparison. Actual costs vary by provider and scope.</p>

        <div className="mt-8 text-center">
          <Link href="/book-demo" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-warning-400 px-7 py-3.5 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber">
            See it live — book a demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
