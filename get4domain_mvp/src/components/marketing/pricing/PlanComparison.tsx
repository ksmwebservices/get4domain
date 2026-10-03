import Link from 'next/link';
import { Check, Minus, ArrowRight, Sparkles } from 'lucide-react';
import { type PlanTerm, formatINR, gstOn, totalWithGst } from '@/lib/pricing';

/**
 * DomainApp: Workspace vs BOS, feature by feature. One table, both plans side by side — no
 * toggle, so a prospect never has to flip between plans to compare them. Numbers that vary
 * by plan (AI Studio credit, SEO keywords, theme changes, price) come from the live
 * PlanTerm objects; the rest mirrors the confirmed 01-Oct-2026 plan restructure.
 * HRM and Office management are NOT built yet and are always labelled "coming soon".
 */

type Cell = boolean | string | { soon: string };

interface Row { feature: string; ws: Cell; bos: Cell; note?: string }
interface Group { title: string; rows: Row[] }

function groups(ws: PlanTerm, bos: PlanTerm): Group[] {
  return [
    {
      title: 'Website & hosting',
      rows: [
        { feature: 'Professional industry website', ws: true, bos: true },
        { feature: 'Free subdomain (yourname.get4domain.com)', ws: true, bos: true },
        { feature: 'Free hosting + SSL', ws: true, bos: true },
        { feature: 'Mobile responsive, SEO optimized', ws: true, bos: true },
        { feature: 'Basic CMS for content updates', ws: true, bos: true },
        { feature: 'Theme changes per year', ws: String(ws.themeChangesPerYear), bos: String(bos.themeChangesPerYear) },
        { feature: 'Live in 24 hours (instant deploy + setup)', ws: true, bos: true },
      ],
    },
    {
      title: 'Workplace — running the business',
      rows: [
        { feature: 'Contacts management (industry-labeled)', ws: true, bos: true },
        { feature: 'Products / services catalog', ws: true, bos: true },
        { feature: 'Bookings, orders & appointments', ws: true, bos: true },
        { feature: 'GST invoicing', ws: true, bos: true },
        { feature: 'Expense management', ws: 'Basic', bos: 'Basic + full books' },
        { feature: 'Full GST + P&L accounting', ws: false, bos: true },
        { feature: 'Staff dashboard management', ws: true, bos: true },
        { feature: 'Task management & assigning', ws: false, bos: true },
        { feature: 'HRM', ws: false, bos: { soon: 'Coming soon' } },
        { feature: 'Office management', ws: false, bos: { soon: 'Coming soon' } },
      ],
    },
    {
      title: 'CRM, TeleCRM & customer replies',
      rows: [
        { feature: 'Lead pipeline (Kanban)', ws: true, bos: true },
        { feature: 'TeleCRM with call queue', ws: true, bos: true },
        { feature: 'Follow-up reminders', ws: true, bos: true },
        { feature: 'Website auto-bot reply', ws: true, bos: true },
        { feature: 'WhatsApp bot reply', ws: false, bos: true },
      ],
    },
    {
      title: 'Growth hub',
      rows: [
        { feature: 'Free SEO keywords', ws: String(ws.freeSeoKeywords), bos: String(bos.freeSeoKeywords) },
        { feature: 'SEO / GEO / AEO bundle (blog, social, GMB, directory listings, 20 backlinks)', ws: true, bos: true },
      ],
    },
    {
      title: 'AI Studio & wallet',
      rows: [
        { feature: 'One-time AI Studio credit included', ws: formatINR(ws.welcomeCredit), bos: formatINR(bos.welcomeCredit) },
        { feature: 'Text, images, posters, reels & documents', ws: true, bos: true },
        { feature: 'Pay-per-use wallet (AI, WhatsApp, SMS, email, domains)', ws: true, bos: true },
      ],
    },
    {
      title: 'Team & support',
      rows: [
        { feature: 'Team access with roles', ws: true, bos: true },
        { feature: 'Instant AI support assistant (human callback if needed)', ws: true, bos: true },
      ],
    },
  ];
}

function CellView({ value, highlight }: { value: Cell; highlight?: boolean }) {
  if (value === true) return <Check aria-label="Included" className={`mx-auto h-4 w-4 ${highlight ? 'text-primary-600' : 'text-success-500'}`} />;
  if (value === false) return <Minus aria-label="Not included" className="mx-auto h-4 w-4 text-slate-300" />;
  if (typeof value === 'object') {
    return <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{value.soon}</span>;
  }
  return <span className={`text-xs font-semibold sm:text-sm ${highlight ? 'text-primary-700' : 'text-slate-800'}`}>{value}</span>;
}

function PlanCard({ plan, bos }: { plan: PlanTerm; bos?: boolean }) {
  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${bos ? 'border-primary-300 ring-1 ring-primary-200' : 'border-slate-200'}`}>
      {bos && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-warning-400 px-3 py-1 text-[11px] font-semibold text-slate-900">
          <Sparkles className="h-3 w-3" /> Best value
        </span>
      )}
      <p className="text-xs font-bold uppercase tracking-wider text-primary-600">{plan.label}</p>
      <p className="mt-1 text-sm text-slate-500">{bos ? 'The full back office for growing businesses' : 'Website, CRM and growth tools to get going'}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-slate-900">{plan.headline}</span>
        <span className="text-sm text-slate-500">{plan.headlinePeriod}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-700">{plan.billingNote}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {formatINR(plan.baseAmount)} + {formatINR(gstOn(plan.baseAmount))} GST = <span className="font-semibold text-slate-700">{formatINR(totalWithGst(plan.baseAmount))}</span> {plan.cycleLabel}
      </p>
      <Link
        href="/book-demo?product=app"
        className={`group mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all ${bos ? 'bg-warning-400 text-slate-900 hover:bg-warning-300' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
      >
        {plan.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

export default function PlanComparison({ workspace, bos }: { workspace: PlanTerm; bos: PlanTerm }) {
  const all = groups(workspace, bos);
  return (
    <section id="domainapp" className="scroll-mt-24 border-t border-slate-200 bg-white py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-600">1 · DomainApp</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Workspace vs BOS, feature by feature</h2>
          <p className="mt-3 text-slate-600">Your industry website plus the software to run the business. Two annual plans — everything in Workspace is in BOS, and BOS adds the full back office.</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <PlanCard plan={workspace} />
          <PlanCard plan={bos} bos />
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {all.map((g) => (
            <div key={g.title}>
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:px-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">{g.title}</p>
                <p className="text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">Workspace</p>
                <p className="text-center text-[11px] font-bold uppercase tracking-wide text-primary-600">BOS</p>
              </div>
              {g.rows.map((r, i) => (
                <div
                  key={r.feature}
                  className={`grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2 border-b border-slate-100 px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:px-5 ${i % 2 ? 'bg-white' : 'bg-white'}`}
                >
                  <p className="text-sm text-slate-700">{r.feature}</p>
                  <div className="text-center"><CellView value={r.ws} /></div>
                  <div className="rounded-lg bg-primary-50/50 py-1 text-center"><CellView value={r.bos} highlight /></div>
                </div>
              ))}
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2 border-t-2 border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:px-5">
            <p className="text-sm font-bold text-slate-800">Price (billed annually, + 18% GST)</p>
            <p className="text-center text-xs font-bold text-slate-900 sm:text-sm">{formatINR(workspace.baseAmount)}</p>
            <p className="text-center text-xs font-bold text-primary-700 sm:text-sm">{formatINR(bos.baseAmount)}</p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          HRM and Office management are on the BOS roadmap and are not available yet. Cancel anytime — your site stays live until the year you have paid for ends.
        </p>
      </div>
    </section>
  );
}
