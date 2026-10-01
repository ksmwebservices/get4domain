'use client';

import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, Camera, Home, Layers3 } from 'lucide-react';
import { useBooking } from '@/components/site/BookingModal';

const items = [
  { label: 'Home', icon: Home, href: '/' },
  { label: 'Services', icon: Layers3, href: '/services' },
  { label: 'Portfolio', icon: Camera, href: '/#portfolio' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { openBooking } = useBooking();

  const goTo = (href: string) => {
    if (href === '/#portfolio' && pathname === '/') {
      document.querySelector('#portfolio')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    router.push(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-ink/95 backdrop-blur-lg border-t border-gold/20 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4 items-center px-2 py-2">
        {items.map((item) => {
          const active = item.href === '/services' ? pathname.startsWith('/services') : item.href === '/' ? pathname === '/' : false;
          return <button key={item.label} onClick={() => goTo(item.href)} className={`flex flex-col items-center gap-1 py-1.5 relative ${active ? 'text-gold' : 'text-warm/50'}`}><item.icon className="w-5 h-5" /><span className="text-[10px] tracking-wide">{item.label}</span>{active && <span className="absolute -top-2 w-6 h-0.5 bg-gold rounded-full" />}</button>;
        })}
        <button onClick={() => openBooking()} className="flex flex-col items-center gap-1 text-gold py-1.5"><span className="w-11 h-11 -mt-6 rounded-full border-4 border-ink bg-gold flex items-center justify-center shadow-lg shadow-gold/20"><CalendarDays className="w-5 h-5 text-ink" /></span><span className="text-[10px] tracking-wide font-medium">Book Now</span></button>
      </div>
    </nav>
  );
}
