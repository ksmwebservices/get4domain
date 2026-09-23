'use client';

/** Ported from the reference design's `components/layout/Header.tsx`: fixed header,
 *  scroll-aware backdrop, cart icon with a live item-count badge, mobile hamburger
 *  menu. Rebuilt with a plain slide-down panel instead of shadcn `Sheet` (no Radix
 *  dependency), on engine tokens. */
import { useEffect, useState } from 'react';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { useRetailCart } from '../cart-context';

export default function RetailNav({ brand, logo, links }: { brand: string; logo?: string; links: { href: string; label: string }[] }) {
  const cart = useRetailCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      id="top"
      className="sticky top-0 z-30 transition-colors"
      style={{ background: scrolled ? 'var(--eng-surface)' : 'transparent', borderBottom: scrolled ? '1px solid var(--eng-border)' : '1px solid transparent', backdropFilter: scrolled ? 'blur(8px)' : undefined }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2 font-[family-name:var(--eng-fontDisplay)] text-lg font-bold text-[var(--eng-fg)]">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={brand} className="h-8 w-8 rounded-lg object-cover" />
          )}
          {brand}
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-[var(--eng-fg)] transition-colors hover:text-[var(--eng-accent)]">{l.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={cart.openCart} aria-label="Open cart" className="relative rounded-full p-2 text-[var(--eng-fg)] transition-colors hover:bg-[var(--eng-bg)]">
            <ShoppingBag className="h-5 w-5" />
            {cart.count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold" style={{ background: 'var(--eng-accent)', color: 'var(--eng-accent-fg)' }}>
                {cart.count}
              </span>
            )}
          </button>
          <button onClick={() => setMenuOpen((v) => !v)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} className="rounded-full p-2 text-[var(--eng-fg)] md:hidden">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-[var(--eng-border)] bg-[var(--eng-surface)] px-5 py-3 md:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-[var(--eng-fg)]">{l.label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}
