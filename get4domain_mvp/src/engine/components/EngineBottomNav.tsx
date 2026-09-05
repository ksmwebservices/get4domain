'use client';

import { useEffect, useState } from 'react';
import {
  Home, LayoutGrid, CalendarCheck, Users, Menu as MenuIcon, UtensilsCrossed, ShoppingBag,
  ShoppingCart, Percent, Truck, Building2, MessageSquare, MapPin, GraduationCap, Dumbbell,
  CalendarDays, Landmark, Scale, ShieldCheck, Camera, Phone, Sparkles, FileText, Info, Images,
} from 'lucide-react';
import type { BottomNavItem } from '../kit/model';

// Compact icon set for the mobile nav (kept small so the client bundle stays lean).
const NAV_ICONS: Record<string, typeof Home> = {
  home: Home, grid: LayoutGrid, book: CalendarCheck, users: Users, more: MenuIcon,
  menu: UtensilsCrossed, order: ShoppingBag, cart: ShoppingCart, offers: Percent, track: Truck,
  building: Building2, enquiry: MessageSquare, visit: MapPin, map: MapPin, courses: GraduationCap,
  programs: Dumbbell, schedule: CalendarDays, loans: Landmark, eligibility: FileText, plans: ShieldCheck,
  quote: FileText, practice: Scale, contact: Phone, gallery: Images, services: Sparkles,
  products: ShoppingBag, admission: GraduationCap, join: Dumbbell, info: Info, camera: Camera,
};

export interface BottomNavConfig {
  items: BottomNavItem[];
}

/**
 * Base engine feature (Section 9 of the reference): a genuinely mobile-first fixed
 * bottom navigation EVERY industry site gets automatically. 4–5 industry-specific items,
 * icon + label, active state (scroll-spy), safe-area inset, an optionally emphasized
 * primary action. Hidden on md+ (desktop uses the top nav, per Section 10). Themed from
 * the industry's `--eng-*` tokens.
 */
export default function EngineBottomNav({ items }: BottomNavConfig) {
  const [active, setActive] = useState('#top');

  useEffect(() => {
    const ids = items.map((i) => i.href).filter((h) => h.startsWith('#')).map((h) => h.slice(1));
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) setActive('#' + vis.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.1, 0.5, 1] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-[var(--eng-border)] bg-[var(--eng-bg)]/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      aria-label="Site navigation"
    >
      {items.map((it) => {
        const Icon = NAV_ICONS[it.icon] ?? Info;
        const isActive = active === it.href;
        if (it.emphasis) {
          return (
            <a key={it.label} href={it.href} className="flex flex-col items-center justify-end gap-0.5 px-1" aria-label={it.label}>
              <span className="-mt-4 flex h-11 w-11 items-center justify-center bg-[var(--eng-accent)] text-[var(--eng-accent-fg)] shadow-lg" style={{ borderRadius: 'var(--eng-radius)' }}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-semibold text-[var(--eng-accent)]">{it.label}</span>
            </a>
          );
        }
        return (
          <a key={it.label} href={it.href} className={`flex flex-col items-center justify-center gap-0.5 py-1 transition-colors ${isActive ? 'text-[var(--eng-accent)]' : 'text-[var(--eng-muted)]'}`}>
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{it.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
