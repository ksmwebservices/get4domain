'use client';

/** Ported from the reference design's `app/shop/page.tsx` filtering logic (category
 *  chips, client-side `useMemo` filter) — simplified from its full price-range/sort
 *  Radix `Slider` UI, which needs no new dependency to make the point: browse a real
 *  product grid, filter by category, open a product. */
import { useMemo, useState } from 'react';
import type { RetailProduct } from '../types';
import ProductCard from './ProductCard';
import ProductDetail from './ProductDetail';

export default function ProductGrid({ products, title, sub }: { products: RetailProduct[]; title: string; sub?: string }) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return Array.from(set);
  }, [products]);
  const [active, setActive] = useState<string | null>(null);
  const [opened, setOpened] = useState<RetailProduct | null>(null);

  const shown = active ? products.filter((p) => p.category === active) : products;

  return (
    <section id="shop" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <div className="text-center md:text-left">
        <div className="eng-eyebrow text-xs font-bold uppercase tracking-[0.14em] text-[var(--eng-accent)]">Shop</div>
        <h2 className="mt-2 font-[family-name:var(--eng-fontDisplay)] text-2xl font-bold text-[var(--eng-fg)] md:text-3xl">{title}</h2>
        {sub && <p className="mt-2 max-w-xl text-sm text-[var(--eng-muted)] md:mx-0 mx-auto">{sub}</p>}
      </div>

      {categories.length > 1 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start">
          <button
            onClick={() => setActive(null)}
            className="px-3.5 py-1.5 text-xs font-semibold transition-colors"
            style={{ borderRadius: 'var(--eng-radius)', border: '1px solid var(--eng-border)', background: active === null ? 'var(--eng-accent)' : 'transparent', color: active === null ? 'var(--eng-accent-fg)' : 'var(--eng-fg)' }}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className="px-3.5 py-1.5 text-xs font-semibold transition-colors"
              style={{ borderRadius: 'var(--eng-radius)', border: '1px solid var(--eng-border)', background: active === c ? 'var(--eng-accent)' : 'transparent', color: active === c ? 'var(--eng-accent-fg)' : 'var(--eng-fg)' }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--eng-muted)]">No products in this category yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {shown.map((p) => <ProductCard key={p.id} product={p} onOpen={setOpened} />)}
        </div>
      )}

      {opened && <ProductDetail product={opened} related={products.filter((p) => p.id !== opened.id && p.category === opened.category).slice(0, 4)} onClose={() => setOpened(null)} onOpenRelated={setOpened} />}
    </section>
  );
}
