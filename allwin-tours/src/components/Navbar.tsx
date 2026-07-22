'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NAV_LINKS } from '@/lib/constants';
import { useBookingModal } from './BookingModalContext';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openModal } = useBookingModal();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-900/90 transition-shadow ${
        scrolled ? 'shadow-lg shadow-black/30' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
          <img
            src="/logo.png"
            alt="Allwin Tours & Travels"
            className="h-16 w-auto object-contain"
          />
          <span>Allwin Tours &amp; Travels</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-text-light hover:text-accent transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-slate-900 font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            📅 Book Now
          </button>
        </div>

        <button
          className="md:hidden text-white text-2xl"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-slate-900 border-l border-slate-800 p-6 animate-slide-down flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <span className="font-bold text-white">Menu</span>
              <button
                className="text-white text-2xl"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-text-light hover:text-accent transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <button
              onClick={() => {
                setMobileOpen(false);
                openModal();
              }}
              className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-900 font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              📅 Book Now
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
