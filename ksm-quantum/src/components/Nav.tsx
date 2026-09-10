'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NAV, SITE } from '@/data/site';

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'border-b border-[var(--border)] bg-[rgba(7,7,12,0.72)] backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <nav className="container-x flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="KSM Quantum Technologies — home">
          {/* Real brand mark on a white tile (the icon is designed navy-on-white). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ksm-icon.png" alt="KSM Quantum Technologies logo" width={32} height={32} className="h-8 w-8 rounded-lg bg-white p-0.5 ring-1 ring-white/10" />
          <span className="font-display text-[15px] font-bold tracking-tight">
            KSM<span className="text-[var(--muted)]"> Quantum</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive(n.href) ? 'text-white' : 'text-[var(--muted)] hover:text-white'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:block">
          <Link href="/contact" className="btn-primary !py-2 !text-sm">Get in touch</Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="rounded-lg p-2 text-[var(--muted)] hover:text-white md:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-[var(--border)] bg-[rgba(7,7,12,0.96)] backdrop-blur-xl md:hidden">
          <div className="container-x flex flex-col py-3">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-3 text-base font-medium ${
                  isActive(n.href) ? 'text-white' : 'text-[var(--muted)]'
                }`}
              >
                {n.label}
              </Link>
            ))}
            <Link href="/contact" className="btn-primary mt-2 justify-center">Get in touch</Link>
            <p className="mt-4 px-3 text-xs text-[var(--muted)]">{SITE.tagline}</p>
          </div>
        </div>
      )}
    </header>
  );
}
