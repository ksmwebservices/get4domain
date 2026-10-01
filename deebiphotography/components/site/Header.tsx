'use client';

import { useEffect, useState } from 'react';
import { Camera, Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useBooking } from '@/components/site/BookingModal';

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Services', href: '/services' },
  { label: 'Portfolio', href: '#portfolio' },
  { label: 'Stories', href: '#testimonials' },
  { label: 'Contact', href: '#contact' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { openBooking } = useBooking();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = (href: string) => {
    setMenuOpen(false);
    if (href === '/services') {
      router.push('/services');
      return;
    }
    if (href.startsWith('#') && pathname !== '/') {
      router.push(`/${href}`);
      return;
    }
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className={cn('fixed top-0 left-0 right-0 z-50 transition-all duration-500', scrolled ? 'bg-ink/95 backdrop-blur-md border-b border-gold/20 py-3' : 'bg-transparent py-5')}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between">
        <a href="/" onClick={(event) => { event.preventDefault(); pathname === '/' ? handleNav('#home') : router.push('/'); }} className="flex items-center gap-3 group">
          <span className="w-10 h-10 rounded-full border border-gold/60 flex items-center justify-center group-hover:bg-gold transition-colors">
            <Camera className="w-5 h-5 text-gold group-hover:text-ink transition-colors" />
          </span>
          <span className="leading-none">
            <span className="block font-cinzel text-lg sm:text-xl tracking-[0.2em] text-cream font-semibold">DEEBI</span>
            <span className="block text-[9px] sm:text-[10px] tracking-[0.35em] text-gold/80 uppercase mt-0.5">Wedding Stories</span>
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => <a key={link.href} href={link.href} onClick={(event) => { event.preventDefault(); handleNav(link.href); }} className="text-sm tracking-wide text-warm/80 hover:text-gold transition-colors duration-300 relative group">{link.label}<span className="absolute -bottom-1 left-0 w-0 h-px bg-gold group-hover:w-full transition-all duration-300" /></a>)}
        </nav>

        <button onClick={() => openBooking()} className="hidden lg:inline-flex items-center px-6 py-2.5 border border-gold/50 text-gold text-sm tracking-wide hover:bg-gold hover:text-ink transition-all duration-300 rounded-sm">Book Now</button>
        <button className="lg:hidden text-cream" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
      </div>

      {menuOpen && <div className="lg:hidden absolute top-full left-0 right-0 bg-ink/98 backdrop-blur-lg border-b border-gold/20 animate-fade-in"><nav className="flex flex-col px-6 py-4">{navLinks.map((link) => <a key={link.href} href={link.href} onClick={(event) => { event.preventDefault(); handleNav(link.href); }} className="py-3 text-warm/90 hover:text-gold border-b border-white/5 text-sm tracking-wide transition-colors">{link.label}</a>)}<button onClick={() => { setMenuOpen(false); openBooking(); }} className="mt-4 mb-2 py-3 border border-gold/50 text-gold text-sm tracking-wide hover:bg-gold hover:text-ink transition-all rounded-sm">Book Now</button></nav></div>}
    </header>
  );
}
