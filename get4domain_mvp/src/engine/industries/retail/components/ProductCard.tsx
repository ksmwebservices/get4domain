'use client';

/** Ported from the reference design's `components/product/ProductCard.tsx`: whole card
 *  opens the product, a hover "Quick add" adds the default variant straight from the
 *  grid, badges for New/Bestseller/discount, colour swatches as small dots. Rebuilt
 *  against engine tokens (`--eng-*`) instead of shadcn `Card`/Radix, so it re-themes
 *  automatically for any industry palette — no colour is hardcoded here. */
import { Plus, Star } from 'lucide-react';
import type { RetailProduct } from '../types';
import { useRetailCart } from '../cart-context';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function ProductCard({ product, onOpen }: { product: RetailProduct; onOpen: (p: RetailProduct) => void }) {
  const cart = useRetailCart();
  const discount = product.originalPrice && product.price ? Math.round(100 - (product.price / product.originalPrice) * 100) : 0;

  const quickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    cart.addToCart(product, { size: product.sizes?.[Math.floor(product.sizes.length / 2)], color: product.colors?.[0]?.name });
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      className="group flex flex-col overflow-hidden text-left transition-transform hover:-translate-y-0.5"
      style={{ borderRadius: 'var(--eng-radius)', border: '1px solid var(--eng-border)', background: 'var(--eng-surface)' }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--eng-bg)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        {(product.badge || discount > 0 || !product.inStock) && (
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {!product.inStock && <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Out of stock</span>}
            {product.inStock && discount > 0 && <span className="rounded-full bg-[var(--eng-accent2)] px-2 py-0.5 text-[10px] font-bold text-white">{discount}% off</span>}
            {product.inStock && !discount && product.badge && <span className="rounded-full bg-[var(--eng-accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--eng-accent-fg)]">{product.badge}</span>}
          </div>
        )}
        {product.inStock && product.price !== null && (
          <span
            onClick={quickAdd}
            role="button"
            aria-label={`Quick add ${product.name}`}
            className="absolute bottom-2 right-2 flex h-9 w-9 translate-y-12 items-center justify-center rounded-full bg-[var(--eng-accent)] text-[var(--eng-accent-fg)] opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <Plus className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.category && <span className="text-[11px] uppercase tracking-wide text-[var(--eng-muted)]">{product.category}</span>}
        <span className="line-clamp-2 text-sm font-semibold text-[var(--eng-fg)]">{product.name}</span>
        {typeof product.rating === 'number' && (
          <span className="flex items-center gap-1 text-xs text-[var(--eng-muted)]">
            <Star className="h-3 w-3 fill-current text-[var(--eng-accent2)]" /> {product.rating.toFixed(1)}
            {product.reviews ? ` (${product.reviews})` : ''}
          </span>
        )}
        {product.colors && (
          <div className="mt-0.5 flex items-center gap-1">
            {product.colors.slice(0, 4).map((c) => (
              <span key={c.name} title={c.name} className="h-3.5 w-3.5 rounded-full ring-1 ring-[var(--eng-border)]" style={{ backgroundColor: c.hex }} />
            ))}
          </div>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          {product.price !== null ? (
            <>
              <span className="font-[family-name:var(--eng-fontDisplay)] text-base font-bold text-[var(--eng-fg)]">{rupees(product.price)}</span>
              {product.originalPrice && <span className="text-xs text-[var(--eng-muted)] line-through">{rupees(product.originalPrice)}</span>}
            </>
          ) : (
            <span className="text-sm font-semibold text-[var(--eng-accent)]">{product.priceLabel}</span>
          )}
        </div>
      </div>
    </button>
  );
}
