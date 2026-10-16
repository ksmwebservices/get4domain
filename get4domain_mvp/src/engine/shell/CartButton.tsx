'use client';

import { ShoppingCart } from 'lucide-react';
import { useCart } from '../components/EngineCart';

/** The cart button a theme places with <g4d-cart>: shows the count and opens the engine's own checkout. Draws nothing when the site has no live cart. */
export default function CartButton({ label = 'Cart', className = '' }: { label?: string; className?: string }) {
  const cart = useCart();
  if (!cart.enabled) return null;
  return (
    <button type="button" onClick={() => cart.openCheckout()} className={className || 'inline-flex items-center gap-2 text-sm font-medium'} aria-label={`${label}, ${cart.count} items`}>
      <ShoppingCart className="h-4 w-4" />{label}{cart.count > 0 && <span className="rounded-full bg-[var(--sh-accent)] px-1.5 text-xs text-[var(--sh-accent-fg)]">{cart.count}</span>}
    </button>
  );
}
