'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Play, ChevronDown, Globe, LayoutGrid, Megaphone, Sparkles, LogIn } from 'lucide-react';
import Button from './ui/Button';

const productDropdown = [
  { label: 'Industry Website', href: '/domain-app', icon: Globe, desc: 'Professional website for your business', badge: null as string | null },
  { label: 'Business Workspace', href: '/domain-app', icon: LayoutGrid, desc: 'CRM, invoicing, contacts, operations', badge: null as string | null },
  { label: 'Campaigns', href: '/domain-campaign', icon: Megaphone, desc: 'Landing pages, social media, lead generation', badge: null as string | null },
  { label: 'AI Studio', href: '/pricing', icon: Sparkles, desc: 'Posters, reels, content, documents', badge: null as string | null },
];

const centerLinks = [
  { label: 'Industries', href: '/industries' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setProductsOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-40 border-b backdrop-blur transition-all duration-300 ${
        scrolled ? 'border-slate-200 bg-white/90 shadow-sm' : 'border-slate-200/60 bg-white/80'
      }`}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex flex-shrink-0 items-center" aria-label="Get4Domain home">
            <img
              src="/logo.png"
              alt="Get4Domain"
              className="h-16 w-auto object-contain md:h-[72px]"
            />
          </Link>

          {/* Desktop center nav */}
          <div className="hidden items-center gap-1 md:flex">
            <div
              className="relative"
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <button
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith('/domain')
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Products <ChevronDown className={`h-3.5 w-3.5 transition-transform ${productsOpen ? 'rotate-180' : ''}`} />
              </button>
              {productsOpen && (
                <div className="absolute left-0 top-full w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  {productDropdown.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.label} href={item.href} className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50">
                        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 transition-colors group-hover:bg-blue-100">
                          <Icon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                            {item.badge && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">{item.badge}</span>}
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                        </div>
                      </Link>
                    );
                  })}
                  <div className="mt-1 border-t border-slate-100 pt-2">
                    <Link href="/pricing" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50">
                      View all plans &amp; pricing →
                    </Link>
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

          {/* Right CTAs (both desktop and mobile) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              aria-label="Login"
              title="Login"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600"
            >
              <LogIn className="h-4 w-4" />
            </Link>
            <Link href="/demo/clinic" className="hidden md:block">
              <Button size="md" leftIcon={<Play className="h-4 w-4" />}>Visit Demo</Button>
            </Link>
            <Link href="/demo/clinic" className="md:hidden">
              <Button size="sm" leftIcon={<Play className="h-3.5 w-3.5" />}>Visit Demo</Button>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
