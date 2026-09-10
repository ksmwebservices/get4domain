import Link from 'next/link';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { productHref, type Product } from '@/data/site';

export default function ProductCard({ p }: { p: Product }) {
  const href = productHref(p);

  const inner = (
    <>
      {/* per-product accent line at the top edge */}
      <span
        className="absolute inset-x-0 top-0 h-px opacity-60 transition-opacity group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)` }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold tracking-tight md:text-2xl">{p.name}</h3>
          <div className="mt-1 text-[13px] font-medium" style={{ color: p.accent }}>{p.category}</div>
        </div>
        {p.comingSoon
          ? <ArrowRight className="h-5 w-5 flex-shrink-0 text-[var(--muted)] transition-all group-hover:translate-x-0.5 group-hover:text-white" />
          : <ArrowUpRight className="h-5 w-5 flex-shrink-0 text-[var(--muted)] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />}
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--muted)]">{p.blurb}</p>
      <div className="mt-5 flex items-center gap-2">
        {p.comingSoon
          ? <span className="rounded-full border border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/10 px-2.5 py-1 font-mono text-[11px] tracking-wide text-[var(--accent-cyan)]">Coming soon</span>
          : <span className="font-mono text-xs text-[var(--muted)]">{p.domain}</span>}
      </div>
    </>
  );

  const cls = 'card group relative flex flex-col overflow-hidden p-6 md:p-7';

  // Coming-soon → in-site page (same tab). Live → external product, new tab (unchanged).
  return p.comingSoon ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  );
}
