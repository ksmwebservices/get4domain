'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Play, LogIn } from 'lucide-react';
import Button from './ui/Button';

const centerLinks = [
  { label: 'Features', href: '/features' },
  { label: 'Industries', href: '/industries' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
