import { ArrowUpRight } from 'lucide-react';
import type { Product } from '@/data/site';

export default function ProductCard({ p }: { p: Product }) {
  return (
    <a href={p.href} target="_blank" rel="noopener noreferrer" className="card group relative flex flex-col overflow-hidden p-6 md:p-7">
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
        <ArrowUpRight className="h-5 w-5 flex-shrink-0 text-[var(--muted)] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--muted)]">{p.blurb}</p>
      <div className="mt-5 font-mono text-xs text-[var(--muted)]">{p.domain}</div>
    </a>
  );
}
