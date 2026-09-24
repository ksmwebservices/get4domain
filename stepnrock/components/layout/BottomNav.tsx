'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Footprints, Search, ShoppingBag, MessageCircle } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/shop', label: 'Shop', icon: Footprints },
  { href: '/shop', label: 'Search', icon: Search, isSearch: true },
  { href: '/cart', label: 'Cart', icon: ShoppingBag, isCart: true },
  { href: '/contact', label: 'Support', icon: MessageCircle },
];

export function BottomNav() {
  const pathname = usePathname();
  const { count } = useCart();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-background/95 backdrop-blur-lg border-t border-border shadow-lg">
        <div className="flex items-center justify-around h-16 px-2">
          {items.map((item, idx) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (item.isCart) {
              return (
                <Link
                  key={idx}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <div className="relative">
                    <Icon className="h-5 w-5" />
                    {count > 0 && (
                      <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={idx}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
