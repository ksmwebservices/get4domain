'use client';

/** Ported from the reference design's `app/product/[slug]/page.tsx`: image gallery with
 *  thumbnail selection, colour/size selectors, quantity stepper, related products. Runs
 *  as an overlay rather than its own route — this is a single-page engine site (sections
 *  are anchors, like every other industry here), and a dedicated route per product would
 *  also force `generateStaticParams` across every demo sub-category's whole catalogue for
 *  no real benefit. The gallery itself is real: it's just 1 image for most vendor
 *  products today (Step 3 — no parallel multi-upload UI was built), and thumbnails only
 *  render when there's more than one shot to switch between. */
import { useState } from 'react';
import { X, Minus, Plus, Star, ShieldCheck } from 'lucide-react';
import type { RetailProduct } from '../types';
import { useRetailCart } from '../cart-context';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function ProductDetail({
  product, related, onClose, onOpenRelated,
}: {
  product: RetailProduct;
  related: RetailProduct[];
  onClose: () => void;
  onOpenRelated: (p: RetailProduct) => void;
}) {
  const cart = useRetailCart();
  const [activeImage, setActiveImage] = useState(0);
  const [size, setSize] = useState<string | undefined>(product.sizes?.[0]);
  const [color, setColor] = useState<string | undefined>(product.colors?.[0]?.name);
  const [qty, setQty] = useState(1);
  const [needsSize, setNeedsSize] = useState(false);
  const gallery = product.gallery.length ? product.gallery : [product.image];

  const add = () => {
    if (product.sizes && !size) { setNeedsSize(true); return; }
    cart.addToCart(product, { size, color, qty });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-[var(--eng-surface)] text-[var(--eng-fg)] sm:max-h-[85vh]"
        style={{ borderRadius: 'var(--eng-radius)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--eng-border)] px-5 py-3.5 sm:hidden">
          <span className="text-sm font-bold">Product details</span>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-[var(--eng-muted)]"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="relative">
            <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 hidden rounded-full bg-[var(--eng-surface)]/90 p-1.5 text-[var(--eng-muted)] shadow sm:block">
              <X className="h-4 w-4" />
            </button>
            <div className="aspect-square w-full overflow-hidden bg-[var(--eng-bg)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gallery[activeImage]} alt={product.name} className="h-full w-full object-cover" />
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 p-3">
                {gallery.map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={g + i} src={g} alt="" onClick={() => setActiveImage(i)}
                    className={`h-14 w-14 cursor-pointer rounded-lg object-cover ring-2 transition ${i === activeImage ? 'ring-[var(--eng-accent)]' : 'ring-transparent'}`} />
                ))}
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6">
            {product.category && <span className="text-[11px] uppercase tracking-wide text-[var(--eng-muted)]">{product.category}</span>}
            <h2 className="mt-1 font-[family-name:var(--eng-fontDisplay)] text-xl font-bold">{product.name}</h2>
            {typeof product.rating === 'number' && (
              <span className="mt-1 flex items-center gap-1 text-xs text-[var(--eng-muted)]">
                <Star className="h-3.5 w-3.5 fill-current text-[var(--eng-accent2)]" /> {product.rating.toFixed(1)} {product.reviews ? `(${product.reviews} reviews)` : ''}
              </span>
            )}
            <div className="mt-3 flex items-baseline gap-2">
              {product.price !== null ? (
                <>
                  <span className="text-2xl font-bold">{rupees(product.price)}</span>
                  {product.originalPrice && <span className="text-sm text-[var(--eng-muted)] line-through">{rupees(product.originalPrice)}</span>}
                </>
              ) : (
                <span className="text-lg font-bold text-[var(--eng-accent)]">{product.priceLabel}</span>
              )}
            </div>
            {product.description && <p className="mt-3 text-sm leading-relaxed text-[var(--eng-muted)]">{product.description}</p>}

            {product.colors && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold text-[var(--eng-muted)]">Colour{color ? ` — ${color}` : ''}</div>
                <div className="flex gap-2">
                  {product.colors.map((c) => (
                    <button key={c.name} onClick={() => setColor(c.name)} title={c.name}
                      className={`h-8 w-8 rounded-full ring-2 transition ${color === c.name ? 'ring-[var(--eng-accent)]' : 'ring-[var(--eng-border)]'}`}
                      style={{ backgroundColor: c.hex }} />
                  ))}
                </div>
              </div>
            )}

            {product.sizes && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold text-[var(--eng-muted)]">Size{size ? ` — ${size}` : ''}</div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button key={s} onClick={() => { setSize(s); setNeedsSize(false); }}
                      className="px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{ borderRadius: 'var(--eng-radius)', border: `1px solid ${size === s ? 'var(--eng-accent)' : 'var(--eng-border)'}`, background: size === s ? 'var(--eng-accent)' : 'transparent', color: size === s ? 'var(--eng-accent-fg)' : 'var(--eng-fg)' }}>
                      {s}
                    </button>
                  ))}
                </div>
                {needsSize && <p className="mt-1.5 text-xs text-red-500">Please pick a size.</p>}
              </div>
            )}

            {product.price !== null && (
              <div className="mt-4 flex items-center gap-3">
                <div className="flex items-center gap-1" style={{ borderRadius: 'var(--eng-radius)', border: '1px solid var(--eng-border)' }}>
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2 text-[var(--eng-fg)]"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)} className="p-2 text-[var(--eng-fg)]"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <span className="text-xs text-[var(--eng-muted)]">{product.inStock ? 'In stock' : 'Currently out of stock'}</span>
              </div>
            )}

            <button
              onClick={add}
              disabled={!product.inStock}
              className="mt-5 flex w-full items-center justify-center gap-2 py-3 text-sm font-bold disabled:opacity-50"
              style={{ borderRadius: 'var(--eng-radius)', background: 'var(--eng-accent)', color: 'var(--eng-accent-fg)' }}
            >
              {product.price !== null ? <><ShieldCheck className="h-4 w-4" /> Add to cart</> : 'Enquire about this product'}
            </button>
          </div>
        </div>

        {related.length > 0 && (
          <div className="border-t border-[var(--eng-border)] p-5">
            <div className="mb-3 text-sm font-bold">You may also like</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {related.map((r) => (
                <button key={r.id} onClick={() => onOpenRelated(r)} className="text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image} alt={r.name} className="aspect-square w-full rounded-lg object-cover" />
                  <div className="mt-1.5 line-clamp-1 text-xs font-semibold">{r.name}</div>
                  {r.price !== null && <div className="text-xs text-[var(--eng-muted)]">{rupees(r.price)}</div>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
