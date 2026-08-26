'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Sparkles, Building2, CalendarDays, MessageCircle } from 'lucide-react';
import { OPEN_CHAT_EVENT } from './ChatWidget';

const TABS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Features', href: '/features', icon: Sparkles },
  { label: 'Industries', href: '/industries', icon: Building2 },
  { label: 'Demo', href: '/book-demo', icon: CalendarDays },
];

/**
 * Mobile-only bottom nav for the marketing pages. The 5th "Chat" tab opens the
 * existing floating chatbot inline (via OPEN_CHAT_EVENT) instead of navigating —
 * it replaces the floating launcher on mobile. Desktop keeps the floating widget.
 */
export default function MarketingBottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-slate-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] md:hidden">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-primary-600' : 'text-slate-500'}`}
          >
            <Icon className="h-5 w-5" />
            {tab.label}
          </Link>
        );
      })}
      <button
        onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}
        aria-label="Open chat"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"
      >
        <MessageCircle className="h-5 w-5" />
        Chat
      </button>
    </nav>
  );
}
