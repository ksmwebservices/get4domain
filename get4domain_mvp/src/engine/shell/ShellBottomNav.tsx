'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Building2, CalendarCheck, Camera, Dumbbell, FileText, GraduationCap, Home, Images, Info, LayoutGrid, Menu as MenuIcon, MapPin, MessageCircle, MessageSquare, Percent, Phone, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, UtensilsCrossed, Users } from 'lucide-react';
import { useCart } from '../components/EngineCart';
import { Sheet, useShell } from './ShellProvider';
import { SocialLinks } from './SocialLinks';
import type { ShellNavSlot } from './types';

const ICONS: Record<string, typeof Home> = {
  home: Home, grid: LayoutGrid, book: CalendarCheck, users: Users, more: MenuIcon, menu: UtensilsCrossed, order: ShoppingBag, cart: ShoppingCart, offers: Percent, building: Building2, enquiry: MessageSquare,
  visit: MapPin, courses: GraduationCap, programs: Dumbbell, contact: Phone, gallery: Images, services: Sparkles, products: ShoppingBag, info: Info, camera: Camera, quote: FileText, plans: ShieldCheck,
};

/**
 * The mobile bottom navigation: fixed, below the tablet breakpoint only (md and up hides it), five slots at most, the centre slot the raised primary action, icons with labels,
 * an active state, safe-area padding and 44 px targets. "More" opens a sheet with the other pages, call, WhatsApp and the social links. Slots come from the category pack and the vendor.
 */
export default function ShellBottomNav() {
  const shell = useShell();
  const cart = useCart();
  const path = usePathname();
  const [more, setMore] = useState(false);
  const [hash, setHash] = useState('#top');
  const slots = shell?.runtime.bottomNav ?? [];

  useEffect(() => {
    const ids = slots.map((s) => s.href).filter((h): h is string => !!h && h.startsWith('#')).map((h) => h.slice(1));
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => { const v = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (v) setHash(`#${v.target.id}`); }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.1, 0.5, 1] });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [slots]);

  if (!shell || slots.length === 0) return null;
  const { runtime } = shell;
  const isActive = (s: ShellNavSlot): boolean => {
    if (!s.href) return false;
    if (s.href.startsWith('#')) return hash === s.href;
    const clean = s.href.split('#')[0];
    return clean === runtime.base ? path === runtime.base || path === `${runtime.base}/` : path === clean || path.startsWith(`${clean}/`);
  };
  const cell = 'flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium';
  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid border-t border-[var(--sh-border)] bg-[var(--sh-bg)] px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 md:hidden" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}>
        {slots.map((s, i) => {
          const Icon = ICONS[s.icon] ?? Info;
          const centre = i === Math.floor(slots.length / 2) && (s.kind === 'action' || s.kind === 'cart');
          const body = centre
            ? <><span className="-mt-6 flex h-14 w-14 items-center justify-center bg-[var(--sh-accent)] text-[var(--sh-accent-fg)] shadow-lg" style={{ borderRadius: '9999px' }}><Icon className="h-6 w-6" /></span><span className="font-semibold text-[var(--sh-accent)]">{s.label}</span></>
            : <><span className="relative"><Icon className="h-5 w-5" />{s.kind === 'cart' && cart.count > 0 && <span className="absolute -right-2 -top-1.5 rounded-full bg-[var(--sh-accent)] px-1 text-[9px] text-[var(--sh-accent-fg)]">{cart.count}</span>}</span><span>{s.label}</span></>;
          const cls = `${cell} ${isActive(s) ? 'text-[var(--sh-accent)]' : 'text-[var(--sh-muted)]'}`;
          if (s.kind === 'link') return <a key={s.key} href={s.href} className={cls} aria-current={isActive(s) ? 'page' : undefined}>{body}</a>;
          if (s.kind === 'more') return <button key={s.key} type="button" className={cls} onClick={() => setMore(true)} aria-haspopup="dialog">{body}</button>;
          if (s.kind === 'cart') return <button key={s.key} type="button" className={cls} onClick={() => cart.openCheckout()}>{body}</button>;
          return <a key={s.key} href={runtime.flowPath} data-g4d-open="primary" className={cls}>{body}</a>;
        })}
      </nav>
      {more && (
        <Sheet title="More" onClose={() => setMore(false)}>
          <ul className="divide-y divide-[var(--sh-border)]">
            {runtime.more.map((l) => <li key={`${l.label}${l.href}`}><a href={l.href} onClick={() => setMore(false)} {...(l.external ? { target: l.href.startsWith('tel:') ? undefined : '_blank', rel: 'noopener noreferrer' } : {})} className="flex min-h-[48px] items-center py-2 text-base">{l.label}</a></li>)}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            {runtime.business.phone && <a href={`tel:${runtime.business.phone}`} className="inline-flex min-h-[44px] items-center gap-2 border border-[var(--sh-border)] px-4 text-sm" style={{ borderRadius: 'var(--sh-radius)' }}><Phone className="h-4 w-4" />Call</a>}
            {runtime.social.whatsapp && <a href={runtime.social.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 border border-[var(--sh-border)] px-4 text-sm" style={{ borderRadius: 'var(--sh-radius)' }}><MessageCircle className="h-4 w-4" />WhatsApp</a>}
          </div>
          <div className="mt-5"><SocialLinks social={runtime.social} /></div>
        </Sheet>
      )}
    </>
  );
}
