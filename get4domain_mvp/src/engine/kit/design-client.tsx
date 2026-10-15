'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import type { KitBeforeAfter, KitItem } from './model';
import { Heading } from './sections';
import { MenuLine, VegMark, groupByCategory } from './design-sections';
import { AddToCartButton } from '../components/EngineCart';

/** The interactive parts of the industry designs: product filter and search, the tabbed menu, and the before/after slider. Everything else is server-rendered. */
const Img = ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />;
const priceNum = (s?: string): number => { const n = parseFloat((s ?? '').replace(/,/g, '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };

const chip = (on: boolean): string => `rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${on ? 'border-[var(--eng-accent)] bg-[var(--eng-accent)] text-[var(--eng-accent-fg)]' : 'border-[var(--eng-border)] text-[var(--eng-muted)] hover:text-[var(--eng-fg)]'}`;

/* ── Product grid with categories and search ── */
export function Catalog({ id, variant, eyebrow, title, sub, items, categories }: { id: string; variant: 'grid' | 'list' | 'compact'; eyebrow: string; title: string; sub?: string; items: KitItem[]; categories: string[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((p) => (!cat || p.subtitle === cat) && (!needle || `${p.title} ${p.desc ?? ''} ${p.subtitle ?? ''}`.toLowerCase().includes(needle)));
  }, [items, q, cat]);
  const filters = items.length > 6 || categories.length > 1;
  return (
    <section id={id} className="scroll-mt-24 px-5 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        {filters && (
          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                <button type="button" className={chip(cat === '')} aria-pressed={cat === ''} onClick={() => setCat('')}>All</button>
                {categories.map((c) => <button key={c} type="button" className={chip(cat === c)} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
              </div>
            )}
            <label className="relative block md:w-64">
              <span className="sr-only">Search {title}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--eng-muted)]" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-full border border-[var(--eng-border)] bg-[var(--eng-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--eng-fg)] placeholder:text-[var(--eng-muted)]" style={{ borderRadius: 'var(--eng-radius)' }} />
            </label>
          </div>
        )}
        {shown.length === 0 && <p className="mt-10 text-sm text-[var(--eng-muted)]">Nothing matches your search. Try another word, or ask us.</p>}
        {variant === 'grid' && (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {shown.map((p) => (
              <article key={p.title} className="group flex flex-col overflow-hidden border border-[var(--eng-border)] bg-[var(--eng-surface)]" style={{ borderRadius: 'var(--eng-radius)' }}>
                <figure className="aspect-square overflow-hidden bg-[var(--eng-bg)]">{p.image ? <Img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : null}</figure>
                <div className="flex flex-1 flex-col p-3.5">
                  {p.subtitle && <p className="text-[10px] uppercase tracking-wider text-[var(--eng-muted)]">{p.subtitle}</p>}
                  <h3 className="mt-0.5 text-sm font-medium leading-snug">{p.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-[var(--eng-accent)]">{p.price ?? ''}</p>
                  <div className="mt-auto flex items-center gap-2 pt-1"><AddToCartButton name={p.title} price={priceNum(p.price)} productId={p.id} /><a href="#enquiry" className="mt-3 text-xs font-semibold text-[var(--eng-accent)]">Enquire</a></div>
                </div>
              </article>
            ))}
          </div>
        )}
        {variant === 'list' && (
          <ul className="mt-8 divide-y divide-[var(--eng-border)] border-y border-[var(--eng-border)]">
            {shown.map((p) => (
              <li key={p.title} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 py-4 sm:grid-cols-[6rem_1fr_auto]">
                <figure className="aspect-square overflow-hidden bg-[var(--eng-surface)]" style={{ borderRadius: 'var(--eng-radius)' }}>{p.image ? <Img src={p.image} alt={p.title} className="h-full w-full object-cover" /> : null}</figure>
                <div className="min-w-0"><h3 className="font-medium">{p.title}</h3>{p.desc && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--eng-muted)]">{p.desc}</p>}{p.subtitle && <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--eng-muted)]">{p.subtitle}</p>}</div>
                <div className="text-right"><p className="font-semibold text-[var(--eng-accent)]">{p.price ?? ''}</p><AddToCartButton name={p.title} price={priceNum(p.price)} productId={p.id} /></div>
              </li>
            ))}
          </ul>
        )}
        {variant === 'compact' && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <a key={p.title} href="#enquiry" className="flex items-center gap-3 border border-[var(--eng-border)] bg-[var(--eng-surface)] p-3 transition-colors hover:border-[var(--eng-accent)]" style={{ borderRadius: 'var(--eng-radius)' }}>
                <span className="block h-16 w-16 shrink-0 overflow-hidden bg-[var(--eng-bg)]" style={{ borderRadius: 'var(--eng-radius)' }}>{p.image ? <Img src={p.image} alt={p.title} className="h-full w-full object-cover" /> : null}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.title}</span><span className="block text-sm font-semibold text-[var(--eng-accent)]">{p.price ?? ''}</span></span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--eng-muted)]" />
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Tabbed menu ── */
export function MenuTabs({ id, eyebrow, title, sub, items, categories }: { id: string; eyebrow: string; title: string; sub?: string; items: KitItem[]; categories: string[] }) {
  const groups = groupByCategory(items, categories);
  const [active, setActive] = useState(0);
  const list = groups[Math.min(active, groups.length - 1)]?.[1] ?? items;
  return (
    <section id={id} className="scroll-mt-24 px-5 py-16 md:py-20">
      <div className="mx-auto max-w-3xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        {groups.length > 1 && (
          <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Menu sections">
            {groups.map(([c], i) => <button key={c} type="button" role="tab" aria-selected={active === i} className={chip(active === i)} onClick={() => setActive(i)}>{c}</button>)}
          </div>
        )}
        <div className="mt-8 space-y-5" role="tabpanel">
          {list.map((p) => <MenuLine key={p.title} p={p} />)}
        </div>
        {items.some((i) => i.veg) && <p className="mt-6 flex flex-wrap items-center gap-4 text-xs text-[var(--eng-muted)]"><span className="inline-flex items-center gap-1.5"><VegMark v="veg" /> Veg</span><span className="inline-flex items-center gap-1.5"><VegMark v="nonveg" /> Non-veg</span><span className="inline-flex items-center gap-1.5"><VegMark v="egg" /> Egg</span></p>}
      </div>
    </section>
  );
}

/* ── Before and after slider ── */
function Slider({ it, label }: { it: KitBeforeAfter; label: string }) {
  const [pos, setPos] = useState(50);
  return (
    <figure>
      <div className="relative aspect-[4/3] select-none overflow-hidden" style={{ borderRadius: 'var(--eng-radius)' }}>
        <Img src={it.after} alt={`${label}: after`} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}><Img src={it.before} alt={`${label}: before`} className="h-full w-full object-cover" /></div>
        <div aria-hidden className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} />
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label={`Compare before and after: ${label}`} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
        <span className="absolute left-2 top-2 eng-surface-85 px-2 py-0.5 text-[11px] uppercase tracking-wider">Before</span>
        <span className="absolute right-2 top-2 bg-[var(--eng-accent)] px-2 py-0.5 text-[11px] uppercase tracking-wider text-[var(--eng-accent-fg)]">After</span>
      </div>
      {it.caption && <figcaption className="mt-2 text-sm text-[var(--eng-muted)]">{it.caption}</figcaption>}
    </figure>
  );
}

export function BeforeAfterSlider({ id, eyebrow, title, items }: { id: string; eyebrow: string; title: string; items: KitBeforeAfter[] }) {
  return (
    <section id={id} className="scroll-mt-24 px-5 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} />
        <div className="mt-10 grid gap-8 md:grid-cols-2">{items.map((it, i) => <Slider key={`${it.before}${i}`} it={it} label={it.caption || title} />)}</div>
      </div>
    </section>
  );
}
