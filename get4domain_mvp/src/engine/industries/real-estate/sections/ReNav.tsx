'use client';

import { useEffect, useState } from 'react';
import { Menu, X, Phone } from 'lucide-react';

const LINKS = [
  { href: '#featured', label: 'Projects' },
  { href: '#types', label: 'What we build' },
  { href: '#location', label: 'Location' },
  { href: '#amenities', label: 'Amenities' },
  { href: '#gallery', label: 'Gallery' },
];

/**
 * RE nav — a refined, transparent-over-hero bar that condenses to a solid ground
 * on scroll, with a persistent "Book a site visit" CTA. Distinct from the demo
 * template's simple top+bottom nav: this is a developer-brand nav.
 */
export default function ReNav({ brand, phone }: { brand: string; logo?: string; phone?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${scrolled ? 'border-b border-[var(--eng-border)] eng-surface-95 backdrop-blur' : 'bg-transparent'}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#top" className="font-[family-name:var(--eng-fontDisplay)] text-lg tracking-wide text-[var(--eng-fg)]">
          {brand}
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-[var(--eng-muted)] transition-colors hover:text-[var(--eng-fg)]">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {phone && (
            <a href={`tel:${phone}`} className="hidden items-center gap-1.5 text-sm text-[var(--eng-muted)] hover:text-[var(--eng-fg)] sm:flex">
              <Phone className="h-3.5 w-3.5" /> {phone}
            </a>
          )}
          <a href="#enquiry" className="hidden bg-[var(--eng-accent)] px-4 py-2 text-sm font-semibold text-[var(--eng-accent-fg)] md:inline-block" style={{ borderRadius: 'var(--eng-radius)' }}>
            Book a site visit
          </a>
          <button className="text-[var(--eng-fg)] md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-[var(--eng-border)] bg-[var(--eng-bg)] px-5 py-4 md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-[var(--eng-muted)]">{l.label}</a>
          ))}
          <a href="#enquiry" onClick={() => setOpen(false)} className="mt-2 block bg-[var(--eng-accent)] px-4 py-3 text-center text-sm font-semibold text-[var(--eng-accent-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>
            Book a site visit
          </a>
        </div>
      )}
    </header>
  );
}
