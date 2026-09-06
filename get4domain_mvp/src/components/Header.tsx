'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn, ChevronDown } from 'lucide-react';
import Button from './ui/Button';
import { INDUSTRIES } from '@/data/industries-list';

const centerLinks = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the mega-menu on route change.
  useEffect(() => { setIndustriesOpen(false); }, [pathname]);

  const openMenu = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setIndustriesOpen(true); };
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setIndustriesOpen(false), 140); };

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-40 border-b transition-colors duration-200 ${
        scrolled ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-200/70 bg-white'
      }`}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex flex-shrink-0 items-center" aria-label="Get4Domain home">
            <img src="/logo.png" alt="Get4Domain" className="h-16 w-auto object-contain md:h-[72px]" />
          </Link>

          {/* Desktop center nav — Industries is a category mega-menu */}
          <div className="hidden items-center gap-1 md:flex">
            <div className="relative" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
              <button
                type="button"
                aria-expanded={industriesOpen}
                onClick={() => setIndustriesOpen((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith('/industries') ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Industries <ChevronDown className={`h-3.5 w-3.5 transition-transform ${industriesOpen ? 'rotate-180' : ''}`} />
              </button>

              {industriesOpen && (
                <div className="absolute left-1/2 top-full z-50 mt-1 w-[44rem] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pick your industry</span>
                    <Link href="/industries" className="text-xs font-semibold text-blue-600 hover:text-blue-700">See all →</Link>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {INDUSTRIES.map((ind) => (
                      <Link
                        key={ind.id}
                        href={`/industries/${ind.id}`}
                        className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-50"
                      >
                        <span className="text-lg">{ind.icon}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-blue-600">{ind.name}</span>
                          <span className="block truncate text-[11px] text-slate-400">{ind.records} · {ind.contacts}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {centerLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="hidden md:block">
              <Button size="md" leftIcon={<LogIn className="h-4 w-4" />}>Login</Button>
            </Link>
            <Link href="/login" className="md:hidden">
              <Button size="sm" leftIcon={<LogIn className="h-3.5 w-3.5" />}>Login</Button>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
