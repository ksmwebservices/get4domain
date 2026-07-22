'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBookingModal } from './BookingModalContext';

const TABS = [
  { key: 'home', icon: '🏠', label: 'Home', href: '/' },
  { key: 'packages', icon: '🗺️', label: 'Packages', href: '/packages' },
  { key: 'fleet', icon: '🚗', label: 'Fleet', href: '/fleet' },
  { key: 'contact', icon: '📞', label: 'Contact', href: '/contact' },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { openModal } = useBookingModal();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-stretch">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
              active ? 'text-accent' : 'text-[#1a3a5c]'
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
      <button
        onClick={() => openModal()}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium text-[#1a3a5c]"
      >
        <span className="text-lg">📅</span>
        <span>Book</span>
      </button>
    </nav>
  );
}
