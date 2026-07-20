'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Rocket, ChevronDown, Globe, Megaphone, LayoutGrid } from 'lucide-react';
import Button from './ui/Button';
import { navLinks } from '@/constants/site';

const productDropdown = [
  {
    label: 'DomainApp',
    href: '/domain-app',
    icon: Globe,
    desc: 'Business OS — Website + CRM + HR + Accounting',
    badge: null,
  },
  {
    label: 'DomainCampaign',
    href: '/domain-campaign',
    icon: Megaphone,
    desc: 'Managed Digital Marketing — We run your campaigns',
    badge: 'Managed',
  },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
    setProductsOpen(false);
  }, [pathname]);

  const showSolid = scrolled || !isHome;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        showSolid ? 'glass border-b border-slate-200/60 shadow-sm' : 'bg-transparent'
      }`}
    >
      <nav className="container-mx container-px">
        <div className="flex h-16 items-center justify-between lg:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt="Get4Domain"
                width={200}
                height={250}
                style={{
                  height: '250px',
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-0.5 xl:flex">
            {/* Products dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <button
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith('/domain') || pathname === '/products'
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Products <ChevronDown className={`h-3.5 w-3.5 transition-transform ${productsOpen ? 'rotate-180' : ''}`} />
              </button>
              {productsOpen && (
                <div className="absolute top-full left-0 mt-1 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-premium animate-fade-in">
                  {productDropdown.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-start gap-3 rounded-xl p-3 hover:bg-slate-50 transition-colors group"
                      >
                        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 group-hover:bg-primary-100 transition-colors">
                          <Icon className="h-4.5 w-4.5 text-primary-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                            {item.badge && (
                              <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-700">{item.badge}</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                        </div>
                      </Link>
                    );
                  })}
                  <div className="mt-1 border-t border-slate-100 pt-2">
                    <Link href="/pricing" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-primary-600 font-medium hover:bg-primary-50 transition-colors">
                      View all plans & pricing →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Other nav links */}
            {navLinks.filter(l => l.label !== 'Products' && l.label !== 'DomainApp' && l.label !== 'DomainCampaign').map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 xl:flex">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-600 hover:text-primary-600 transition-colors"
            >
              Login
            </Link>
            <Link href="/book-demo">
              <Button size="md" leftIcon={<Rocket className="h-4 w-4" />}>
                Book a Demo
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 xl:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="xl:hidden">
          <div className="glass border-t border-slate-200/60 px-5 py-4 space-y-1 animate-slide-down">
            <div className="pb-2 mb-2 border-b border-slate-100">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Products</p>
              {productDropdown.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Icon className="h-4 w-4 text-primary-600" />
                    {item.label}
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-secondary-100 px-2 py-0.5 text-xs text-secondary-700">{item.badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
            {navLinks.filter(l => l.label !== 'Products' && l.label !== 'DomainApp' && l.label !== 'DomainCampaign').map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-primary-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
              <Link
                href="/login"
                className="flex-1 text-center text-sm font-semibold text-slate-600 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                Login
              </Link>
              <Link href="/book-demo" className="flex-1">
                <Button size="md" fullWidth leftIcon={<Rocket className="h-4 w-4" />}>
                  Book Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
