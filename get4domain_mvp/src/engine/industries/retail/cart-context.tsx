'use client';

/**
 * Retail shopping cart — ported from the reference design's `lib/cart-context.tsx`
 * (composite line identity by size/colour, localStorage persistence, auto-open-on-add)
 * but rewired to get4domain's REAL checkout: `engine.checkout.order` / `.confirm` via
 * `api.engineDispatchPublic`, the exact same backend contract `EngineCart.tsx` already
 * uses elsewhere in the engine (Razorpay order → vendor pays in → PosSale + stock
 * decrement + CRM lead). Money still goes straight to the vendor; nothing here is mocked.
 *
 * Browsing (add/remove/view cart) is ALWAYS interactive, in demo mode too, so the
 * shopping experience is genuinely explorable. Only the final PAY step requires a real
 * vendor identity (`live` mode + a subdomain + payments turned on) — a demo category
 * page has no vendor to charge, so it shows an honest explanation instead of faking a
 * charge (see CheckoutPanel in components/CartDrawer.tsx).
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RetailCartLine, RetailProduct } from './types';

interface RetailCartCtx {
  lines: RetailCartLine[];
  canCheckout: boolean;
  subdomain: string;
  brandName: string;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: RetailProduct, opts?: { size?: string; color?: string; qty?: number }) => void;
  setQty: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const Ctx = createContext<RetailCartCtx | null>(null);

export function useRetailCart(): RetailCartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Never expected outside RetailCartProvider (RetailSite always wraps its tree), but
    // fail soft rather than crash the page.
    return {
      lines: [], canCheckout: false, subdomain: '', brandName: '', isOpen: false,
      openCart: () => {}, closeCart: () => {}, addToCart: () => {}, setQty: () => {},
      remove: () => {}, clear: () => {}, count: 0, subtotal: 0,
    };
  }
  return ctx;
}

const lineKey = (productId: string, size?: string, color?: string) => `${productId}__${size ?? ''}__${color ?? ''}`;

export function RetailCartProvider({
  vendorId, canCheckout, subdomain, brandName, children,
}: {
  vendorId: string;
  canCheckout: boolean;
  subdomain: string;
  brandName: string;
  children: ReactNode;
}) {
  const storageKey = `g4d_retail_cart_${vendorId}`;
  const [lines, setLines] = useState<RetailCartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on mount (client only; guarded so we never write
  // back the empty initial state over a real saved cart before the read completes).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setLines(JSON.parse(raw));
    } catch { /* corrupt/unavailable storage — start empty */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(lines)); } catch { /* private mode, quota, etc. */ }
  }, [lines, hydrated, storageKey]);

  const value = useMemo<RetailCartCtx>(() => {
    const count = lines.reduce((s, l) => s + l.qty, 0);
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    return {
      lines, canCheckout, subdomain, brandName, isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addToCart: (product, opts) => {
        if (product.price === null) return; // enquiry-only product — no cart line to add
        const size = opts?.size, color = opts?.color, qty = opts?.qty ?? 1;
        const id = lineKey(product.id, size, color);
        setLines((cur) => {
          const i = cur.findIndex((l) => l.lineId === id);
          if (i >= 0) { const next = [...cur]; next[i] = { ...next[i], qty: next[i].qty + qty }; return next; }
          const variantName = [product.name, [size, color].filter(Boolean).join(' / ')].filter(Boolean).join(' — ');
          return [...cur, {
            lineId: id, productId: product.id, catalogItemId: product.isRealProduct ? product.id : undefined,
            name: variantName, price: product.price!, image: product.image, size, color, qty,
          }];
        });
        setIsOpen(true);
      },
      setQty: (lineId, qty) => setLines((cur) => (qty <= 0 ? cur.filter((l) => l.lineId !== lineId) : cur.map((l) => (l.lineId === lineId ? { ...l, qty } : l)))),
      remove: (lineId) => setLines((cur) => cur.filter((l) => l.lineId !== lineId)),
      clear: () => setLines([]),
      count, subtotal,
    };
  }, [lines, canCheckout, subdomain, brandName, isOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
