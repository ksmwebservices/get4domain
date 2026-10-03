import Link from 'next/link';
import { Check, ArrowRight, Sparkles } from 'lucide-react';
import { type PlanTerm, formatINR, gstOn, totalWithGst } from '@/lib/pricing';

/**
 * DomainApp plan cards: Workspace and BOS side by side with price, billing and the full
 * included-feature list. The cross-product feature-by-feature table is ProductComparison.
 */

function PlanCard({ plan, bos }: { plan: PlanTerm; bos?: boolean }) {
  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${bos ? 'border-primary-300 ring-1 ring-primary-200' : 'border-slate-200'}`}>
      {bos && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-warning-400 px-3 py-1 text-[11px] font-semibold text-slate-900">
          <Sparkles className="h-3 w-3" /> Best value
        </span>
      )}
      <p className="text-xs font-bold uppercase tracking-wider text-primary-600">{plan.label}</p>
      <p className="mt-1 text-sm text-slate-500">{bos ? 'The complete back office, for growing businesses' : 'Website, CRM and growth tools to get going'}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-slate-900">{plan.headline}</span>
        <span className="text-sm text-slate-500">{plan.headlinePeriod}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-700">{plan.billingNote}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {formatINR(plan.baseAmount)} + {formatINR(gstOn(plan.baseAmount))} GST = <span className="font-semibold text-slate-700">{formatINR(totalWithGst(plan.baseAmount))}</span> {plan.cycleLabel}
      </p>
      <ul className="mt-5 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />{f}</li>
        ))}
      </ul>
      <Link
        href="/book-demo?product=app"
        className={`group mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all ${bos ? 'bg-warning-400 text-slate-900 hover:bg-warning-300' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
      >
        {plan.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

export default function PlanComparison({ workspace, bos }: { workspace: PlanTerm; bos: PlanTerm }) {
  return (
    <section id="domainapp" className="scroll-mt-24 border-t border-slate-200 bg-slate-50 py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-600">1 · DomainApp</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Your website and your whole business, in one subscription</h2>
          <p className="mt-3 text-slate-600">Two annual plans. Everything in Workspace is in BOS, and BOS adds the complete back office — accounting, HRM and inventory.</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <PlanCard plan={workspace} />
          <PlanCard plan={bos} bos />
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Prices exclude 18% GST. Cancel anytime — your site stays live until the year you have paid for ends.
        </p>
      </div>
    </section>
  );
}
