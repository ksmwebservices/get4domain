import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { type PlanTerm, formatINR } from '@/lib/pricing';
import { buildMatrix, type Cell } from '@/data/platform-features';

/**
 * One table, four products: Workspace | BOS | DomainCampaign | Managed Services.
 * Same row/group pattern as the earlier plan table (grouped rows, tinted BOS column), widened to
 * four columns. Column widths are compact on phones so all four products fit without sideways
 * scrolling; short column names replace the long ones below the `sm` breakpoint.
 */

const COLS = 'grid-cols-[minmax(6.25rem,1.8fr)_repeat(4,minmax(3.3rem,1fr))] sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]';

function CellView({ value, bos }: { value: Cell; bos?: boolean }) {
  if (value === true) return <Check aria-label="Included" className={`mx-auto h-4 w-4 ${bos ? 'text-primary-600' : 'text-success-500'}`} />;
  if (value === false) return <Minus aria-label="Not part of this product" className="mx-auto h-4 w-4 text-slate-300" />;
  return <span className={`block text-[10px] font-semibold leading-tight sm:text-xs ${bos ? 'text-primary-700' : 'text-slate-800'}`}>{value}</span>;
}

export default function ProductComparison({ workspace, bos }: { workspace: PlanTerm; bos: PlanTerm }) {
  const groups = buildMatrix(workspace, bos, formatINR);
  const heads = [
    { name: 'Workspace', short: 'Work-space', sub: `${workspace.headline}/mo`, bos: false },
    { name: 'BOS', short: 'BOS', sub: `${bos.headline}/mo`, bos: true },
    { name: 'DomainCampaign', short: 'Campaign', sub: 'from ₹2,000/mo', bos: false },
    { name: 'Managed Services', short: 'Managed', sub: 'custom quote', bos: false },
  ];
  return (
    <section id="compare" className="scroll-mt-24 border-t border-slate-200 bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl px-1 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Compare everything</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Every feature, every product, one table</h2>
          <p className="mt-3 text-slate-600">What each Get4Domain product includes — side by side. DomainApp plans are your software; DomainCampaign and Managed Services are our team working for you.</p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mt-10">
          {/* column heads */}
          <div className={`grid ${COLS} items-end gap-x-1 border-b border-slate-200 bg-slate-50`}>
            <div className="px-2 py-3 sm:px-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">Feature</p></div>
            {heads.map((h) => (
              <div key={h.name} className={`px-0.5 py-3 text-center ${h.bos ? 'bg-primary-50' : ''}`}>
                <p className={`text-[9px] font-bold uppercase leading-tight tracking-tight sm:text-xs sm:tracking-wide ${h.bos ? 'text-primary-700' : 'text-slate-700'}`}>
                  <span className="sm:hidden">{h.short}</span><span className="hidden sm:inline">{h.name}</span>
                </p>
                <p className="mt-0.5 text-[9px] leading-tight text-slate-500 sm:text-[11px]">{h.sub}</p>
              </div>
            ))}
          </div>

          {groups.map((g) => (
            <div key={g.title}>
              <div className="border-b border-slate-200 bg-slate-100/70 px-2 py-2 sm:px-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 sm:text-xs">{g.title}</p>
              </div>
              {g.rows.map((r) => (
                <div key={r.feature} className={`grid ${COLS} items-center gap-x-1 border-b border-slate-100 last:border-b-0`}>
                  <p className="px-2 py-2.5 text-[12px] leading-snug text-slate-700 sm:px-5 sm:text-sm">{r.feature}</p>
                  <div className="px-0.5 text-center"><CellView value={r.ws} /></div>
                  <div className="self-stretch bg-primary-50/50 px-0.5 py-2.5 text-center"><CellView value={r.bos} bos /></div>
                  <div className="px-0.5 text-center"><CellView value={r.dc} /></div>
                  <div className="px-0.5 text-center"><CellView value={r.ms} /></div>
                </div>
              ))}
            </div>
          ))}

          {/* price + billing */}
          <div className={`grid ${COLS} items-center gap-x-1 border-t-2 border-slate-200 bg-slate-50`}>
            <p className="px-2 py-3 text-[12px] font-bold leading-snug text-slate-800 sm:px-5 sm:text-sm">Price (excl. 18% GST)</p>
            <p className="px-0.5 text-center text-[10px] font-bold leading-tight text-slate-900 sm:text-xs">{formatINR(workspace.baseAmount)}/yr</p>
            <p className="self-stretch bg-primary-50 px-0.5 py-3 text-center text-[10px] font-bold leading-tight text-primary-700 sm:text-xs">{formatINR(bos.baseAmount)}/yr</p>
            <p className="px-0.5 text-center text-[10px] font-bold leading-tight text-slate-900 sm:text-xs">₹2,000–10,000/mo</p>
            <p className="px-0.5 text-center text-[10px] font-bold leading-tight text-slate-900 sm:text-xs">Per proposal</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="#domainapp" className="font-semibold text-primary-700 hover:underline">Choose Workspace or BOS →</Link>
          <Link href="#domain-campaign" className="font-semibold text-primary-700 hover:underline">DomainCampaign fees →</Link>
          <Link href="#managed-services" className="font-semibold text-amber-700 hover:underline">Get a custom quote →</Link>
        </div>
      </div>
    </section>
  );
}
