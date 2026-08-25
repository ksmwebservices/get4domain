'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, LayoutDashboard, Phone, Sparkles, Megaphone, Wallet, Globe, UserRound, CalendarCheck, Receipt, AlertTriangle, Bell, type LucideProps } from 'lucide-react';
import { SHOWCASE, type Tone, type VendorDash, type ClientDash, type DashRow, type ShowcaseCategory } from '@/data/hero-showcase';
import InstallPwaButton from './InstallPwaButton';

/**
 * Homepage product showcase. Real website screenshots (Website view) + two
 * SIMULATED views per industry (Vendor App, Client App) rendered from rich
 * per-industry sample data — no real vendor/customer data, no backend.
 *
 * Two purpose-built layouts, chosen by `variant` (the page renders the mobile one
 * inside `lg:hidden` and the desktop one inside `hidden lg:block`):
 *   - mobile: an app-like TWO-SCREEN flow. Screen 1 (fills the viewport): compact
 *     title + price, the compact view switcher ABOVE the left-aligned mockup, and
 *     the install button BELOW it (nothing overlaps the mockup). Screen 2 (on
 *     scroll): description + Buy Now / Visit Demo.
 *   - desktop: the overlapping composition (phone primary, laptop companion, Buy
 *     Now product card, per-category CTA).
 */

const VIEWS = [
  { key: 'website', label: 'Website', Icon: Globe },
  { key: 'vendor', label: 'Vendor App', Icon: LayoutDashboard },
  { key: 'client', label: 'Client App', Icon: UserRound },
];

const DESCRIPTION =
  'Get4Domain turns your website into a full business app — capture leads, run CRM & TeleCRM, manage bookings, send invoices and create AI content, all from your phone. One platform, your whole business.';

type Icon = ComponentType<LucideProps>;
const toneBadge: Record<Tone, string> = {
  blue: 'bg-primary-500/15 text-primary-300', gold: 'bg-warning-400/15 text-warning-300',
  green: 'bg-success-500/15 text-success-300', red: 'bg-error-500/15 text-error-300', slate: 'bg-white/10 text-slate-300',
};

export default function HeroMockup({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const [cat, setCat] = useState(0);
  const [view, setView] = useState(0);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (interacted) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setView((v) => {
        const nv = (v + 1) % VIEWS.length;
        if (nv === 0) setCat((c) => (c + 1) % SHOWCASE.length);
        return nv;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [interacted]);

  const c = SHOWCASE[cat];
  const stop = () => setInteracted(true);
  const selectCat = (i: number) => { setCat(i); setView(0); stop(); };
  const selectView = (i: number) => { setView(i); stop(); };

  if (variant === 'mobile') {
    return (
      <div className="w-full">
        {/* ── SCREEN 1 — fills the viewport, app-like ─────────────────────────── */}
        <section className="flex min-h-[82svh] flex-col">
          {/* compact title + price */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-300">Get4Domain · Domain App</div>
              <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-white">Your Business, in One App</div>
            </div>
            <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-right">
              <div className="text-base font-bold leading-none text-white">₹999<span className="text-[10px] font-medium text-slate-400">/mo</span></div>
              <div className="mt-0.5 text-[9px] text-slate-400">or ₹9,999/yr</div>
            </div>
          </div>

          {/* category slider (compact) */}
          <CategorySlider cat={cat} onSelect={selectCat} className="mt-3" />

          {/* view switcher (compact) — ABOVE the mockup */}
          <div className="mt-2.5"><ViewSwitcher view={view} onSelect={selectView} /></div>

          {/* mockup — LEFT aligned; phone primary (left), laptop companion (behind-right) */}
          <div className="mt-4 flex justify-start">
            <div className="relative h-[330px] w-[94%] max-w-[340px]">
              <div className="absolute right-0 top-1/2 w-[60%] max-w-[206px] -translate-y-1/2">
                <LaptopFrame c={c} view={view} />
              </div>
              <div className="absolute left-0 top-1/2 z-10 w-[46%] max-w-[158px] -translate-y-1/2">
                <PhoneFrame c={c} view={view} />
              </div>
            </div>
          </div>

          {/* install button — BELOW the mockup, never overlapping it */}
          <div className="mt-auto pt-5">
            <InstallPwaButton className="w-full" />
          </div>
        </section>

        {/* ── SCREEN 2 — reached by scrolling ─────────────────────────────────── */}
        <section className="pb-4 pt-12">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Not just a website — <span className="bg-gradient-to-r from-primary-400 via-warning-300 to-error-400 bg-clip-text text-transparent">your whole business, in one app.</span>
          </h2>
          <p className="mt-3 text-base text-slate-300">{DESCRIPTION}</p>
          <div className="mt-6 flex gap-3">
            <Link href="/book-demo" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-500">
              <ShoppingBag className="h-4 w-4" /> Buy Now
            </Link>
            <Link href={`/demo/${c.key}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Visit Demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <style>{`@keyframes hmFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      </div>
    );
  }

  /* ── DESKTOP ─────────────────────────────────────────────────────────────── */
  return (
    <div className="w-full">
      <CategorySlider cat={cat} onSelect={selectCat} className="mb-4" />
      <div className="mb-4"><ViewSwitcher view={view} onSelect={selectView} /></div>

      {/* Overlapping composition: phone primary (right), laptop companion (left), card. */}
      <div className="relative h-[440px]">
        <div className="absolute right-4 top-1/2 z-10 w-[52%] max-w-[200px] -translate-y-1/2">
          <PhoneFrame c={c} view={view} />
        </div>
        <div className="absolute left-0 top-1/2 z-0 w-[58%] max-w-[268px] -translate-y-1/2">
          <LaptopFrame c={c} view={view} />
        </div>
        <div className="absolute bottom-0 left-0 z-20 w-60">
          <BuyNowCard />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Link href={`/book-demo?industry=${c.key}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-500">
          Book a {c.label} demo <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href={`/demo/${c.key}`} className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">
          or see the live site →
        </Link>
      </div>

      <style>{`@keyframes hmFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

/* ── Shared controls ─────────────────────────────────────────────────────────── */
function CategorySlider({ cat, onSelect, className = '' }: { cat: number; onSelect: (i: number) => void; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:justify-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SHOWCASE.map((s, i) => {
          const on = i === cat;
          return (
            <button
              key={s.key}
              onClick={() => onSelect(i)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                on ? 'border-primary-400/40 bg-primary-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>{s.icon}</span>{s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ViewSwitcher({ view, onSelect }: { view: number; onSelect: (i: number) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
      {VIEWS.map((v, i) => {
        const on = i === view;
        return (
          <button
            key={v.key}
            onClick={() => onSelect(i)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              on ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <v.Icon className="h-3.5 w-3.5" />{v.label}
          </button>
        );
      })}
    </div>
  );
}

function BuyNowCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-300">Get4Domain</div>
          <div className="text-base font-extrabold tracking-tight text-white">DOMAIN APP</div>
        </div>
        <div className="text-right">
          <div className="whitespace-nowrap text-lg font-bold text-white">₹999<span className="text-xs font-medium text-slate-400">/month</span></div>
          <div className="text-[11px] text-slate-400">or ₹9,999/year</div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {['WebApp', 'Vendor App', 'Client App'].map((t) => (
          <span key={t} className="rounded-full border border-primary-400/20 bg-primary-500/10 px-2 py-0.5 text-[10px] font-semibold text-primary-200">{t}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Link href="/book-demo" className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-500">
          <ShoppingBag className="h-4 w-4" /> Buy Now
        </Link>
        <InstallPwaButton className="w-full" />
      </div>
    </div>
  );
}

/* ── Device frames (reused by both variants) ─────────────────────────────────── */
function PhoneFrame({ c, view }: { c: ShowcaseCategory; view: number }) {
  return (
    <div className="relative rounded-[2.2rem] border border-slate-700/80 bg-gradient-to-b from-slate-800 to-slate-900 p-[5px] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
      <div className="absolute -left-[2px] top-[22%] h-9 w-[3px] rounded-l bg-slate-700" />
      <div className="absolute -right-[2px] top-[30%] h-12 w-[3px] rounded-r bg-slate-700" />
      <div className="relative overflow-hidden rounded-[1.85rem] bg-slate-950 ring-1 ring-black/40">
        <div className="pointer-events-none absolute left-1/2 top-1.5 z-20 h-3.5 w-16 -translate-x-1/2 rounded-full bg-slate-900" />
        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-br from-white/8 via-transparent to-transparent" />
        <div key={`p-${c.key}-${view}`} className="aspect-[9/19] w-full animate-[hmFade_0.45s_ease]">
          {view === 0
            ? <img src={`/hero-shots/${c.key}-mobile.webp`} alt={`${c.label} on mobile`} width={480} height={1040} loading="eager" className="h-full w-full object-cover object-top" />
            : <MobileApp view={view} vendor={c.vendor} client={c.client} />}
        </div>
      </div>
    </div>
  );
}

function LaptopFrame({ c, view }: { c: ShowcaseCategory; view: number }) {
  return (
    <div>
      <div className="rounded-lg border-[5px] border-slate-800 bg-slate-800 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
        <div className="overflow-hidden rounded-[3px] bg-slate-950">
          <div className="flex items-center gap-1 border-b border-white/5 bg-slate-900 px-1.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-error-500/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-warning-400/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-success-500/70" />
            <div className="ml-1 flex-1 truncate rounded bg-slate-800 px-1.5 py-0.5 text-[7px] text-slate-500">
              {view === 0 ? `${c.key}.get4domain.com` : view === 1 ? 'app…/dashboard' : 'app…/portal'}
            </div>
          </div>
          <div key={`l-${c.key}-${view}`} className="aspect-[16/10] w-full animate-[hmFade_0.45s_ease] bg-slate-950">
            {view === 0 && <img src={`/hero-shots/${c.key}-home.webp`} alt={`${c.label} website`} width={1280} height={800} loading="eager" className="h-full w-full object-cover object-top" />}
            {view === 1 && <VendorScreen d={c.vendor} />}
            {view === 2 && <ClientScreen d={c.client} />}
          </div>
        </div>
      </div>
      <div className="mx-auto h-1.5 w-full rounded-b-lg bg-slate-700 shadow-lg" />
    </div>
  );
}

/* ── Simulated Vendor Dashboard (laptop) — sidebar nav + header ──────────────── */
function VendorScreen({ d }: { d: VendorDash }) {
  const nav: [Icon, string][] = [[LayoutDashboard, 'Home'], [Phone, 'TeleCRM'], [Sparkles, 'AI'], [Megaphone, 'Growth'], [Wallet, 'Wallet']];
  return (
    <div className="flex h-full text-left">
      <div className="flex w-[30%] shrink-0 flex-col gap-0.5 border-r border-white/5 bg-slate-900/80 p-1">
        <div className="mb-0.5 truncate px-0.5 text-[6px] font-bold text-white">{d.brand}</div>
        {nav.map(([N, label], i) => (
          <div key={label} className={`flex items-center gap-0.5 rounded px-1 py-0.5 ${i === 0 ? 'bg-primary-600 text-white' : 'text-slate-500'}`}>
            <N className="h-2 w-2 shrink-0" /><span className="truncate text-[5px] font-medium">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 space-y-1 overflow-hidden p-1.5">
        <div className="flex items-center justify-between border-b border-white/5 pb-1">
          <span className="text-[8px] font-semibold text-white">Dashboard</span>
          <span className="text-[10px] font-bold text-success-400">{d.revenue}</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {d.stats.map((s) => (
            <div key={s.label} className="rounded border border-white/5 bg-slate-900/70 px-1 py-1 text-center">
              <div className="text-[9px] font-bold text-white">{s.value}</div>
              <div className="text-[6px] text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="text-[6px] font-semibold uppercase tracking-wide text-slate-500">{d.recordsTitle}</div>
        <div className="space-y-0.5">{d.records.slice(0, 3).map((r, i) => <Row key={i} r={r} tiny />)}</div>
        <HighlightCard h={d.highlight} />
      </div>
    </div>
  );
}

/* ── Simulated Client Portal (laptop) — header + bottom tabs ─────────────────── */
function ClientScreen({ d }: { d: ClientDash }) {
  const tab = d.title.replace(/^Your\s+/, '');
  const nav: [Icon, string][] = [[LayoutDashboard, 'Home'], [CalendarCheck, tab], [Receipt, 'Bills'], [UserRound, 'Account']];
  return (
    <div className="flex h-full flex-col text-left">
      <div className="flex items-center justify-between border-b border-white/5 px-1.5 py-1">
        <div className="min-w-0">
          <div className="truncate text-[6px] text-slate-500">{d.brand} · Portal</div>
          <div className="text-[9px] font-bold text-white">{d.greeting} 👋</div>
        </div>
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-600/20 text-primary-300"><UserRound className="h-2.5 w-2.5" /></div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-hidden p-1.5">
        <div className="text-[6px] font-semibold uppercase tracking-wide text-slate-500">{d.title}</div>
        {d.items.map((r, i) => <Row key={i} r={r} tiny />)}
        <div className="flex items-center justify-between rounded border border-white/5 bg-slate-900/70 px-1.5 py-1">
          <span className="flex items-center gap-1 text-[7px] text-slate-300"><Receipt className="h-2.5 w-2.5 text-slate-400" />{d.invoice.label}</span>
          <span className="flex items-center gap-1"><span className="text-[8px] font-bold text-white">{d.invoice.amount}</span><span className={`rounded-full px-1 py-0.5 text-[6px] font-semibold ${toneBadge[d.invoice.tone]}`}>{d.invoice.status}</span></span>
        </div>
      </div>
      <div className="flex items-center justify-around border-t border-white/5 bg-slate-900 px-1 py-1">
        {nav.map(([N, label], i) => (
          <div key={label} className="flex flex-col items-center gap-px">
            <N className={`h-2.5 w-2.5 ${i === 0 ? 'text-primary-400' : 'text-slate-600'}`} />
            <span className={`max-w-[42px] truncate text-[5px] ${i === 0 ? 'text-primary-400' : 'text-slate-600'}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ r, tiny }: { r: DashRow; tiny?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded bg-slate-900/60 px-1.5 py-0.5">
      <div className="min-w-0">
        <div className={`truncate font-medium text-slate-200 ${tiny ? 'text-[7px]' : 'text-[10px]'}`}>{r.primary}</div>
        <div className={`truncate text-slate-500 ${tiny ? 'text-[6px]' : 'text-[9px]'}`}>{r.secondary}</div>
      </div>
      <span className={`ml-1.5 shrink-0 rounded-full px-1 py-0.5 font-semibold ${tiny ? 'text-[6px]' : 'text-[8px]'} ${toneBadge[r.tone]}`}>{r.status}</span>
    </div>
  );
}

function HighlightCard({ h }: { h: VendorDash['highlight'] }) {
  const HIcon = h.kind === 'ai' ? Sparkles : h.kind === 'campaign' ? Megaphone : AlertTriangle;
  const accent = h.kind === 'ai' ? 'from-warning-400/20 to-warning-600/10' : h.kind === 'campaign' ? 'from-error-500/20 to-primary-500/10' : 'from-error-500/20 to-error-700/10';
  return (
    <div className={`flex items-center gap-1.5 rounded border border-white/5 bg-gradient-to-r ${accent} px-1.5 py-1`}>
      <HIcon className="h-2.5 w-2.5 shrink-0 text-warning-300" />
      <div className="min-w-0">
        <div className="truncate text-[7px] font-semibold text-white">{h.title}</div>
        <div className="truncate text-[6px] text-slate-400">{h.subtitle}</div>
      </div>
    </div>
  );
}

/* ── Phone app (primary) — header, sub-tabs, content, labeled bottom nav ──────── */
function MobileApp({ view, vendor, client }: { view: number; vendor: VendorDash; client: ClientDash }) {
  const isVendor = view === 1;
  const clientTab = client.title.replace(/^Your\s+/, '');
  const subTabs = isVendor ? ['Today', 'Week', 'Month'] : ['Active', 'History'];
  const bottom: [Icon, string][] = isVendor
    ? [[LayoutDashboard, 'Home'], [Phone, 'Leads'], [Sparkles, 'Studio'], [Wallet, 'Wallet']]
    : [[LayoutDashboard, 'Home'], [CalendarCheck, clientTab], [Receipt, 'Bills'], [UserRound, 'Account']];

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <div className="flex items-center justify-between px-3 pt-2 text-[8px] font-medium text-slate-400">
        <span>9:41</span>
        <span className="tracking-tighter">●●● ▮</span>
      </div>
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold text-white">{isVendor ? vendor.brand : `${client.greeting} 👋`}</div>
          <div className="truncate text-[8px] text-slate-500">{isVendor ? `${vendor.revenueLabel} overview` : `${client.brand} · Portal`}</div>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-slate-300"><Bell className="h-3 w-3" /></div>
      </div>
      <div className="mx-3 mb-1.5 flex gap-0.5 rounded-lg bg-white/5 p-0.5">
        {subTabs.map((t, i) => (
          <span key={t} className={`flex-1 rounded-md py-0.5 text-center text-[7px] font-semibold ${i === 0 ? 'bg-primary-600 text-white' : 'text-slate-400'}`}>{t}</span>
        ))}
      </div>
      <div className="flex-1 space-y-1.5 overflow-hidden px-3">
        {isVendor ? (
          <>
            <div className="rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 p-2.5 text-white shadow-lg">
              <div className="text-[8px] text-white/70">{vendor.revenueLabel} revenue</div>
              <div className="text-lg font-bold leading-tight">{vendor.revenue}</div>
              <div className="mt-1 flex gap-1.5">
                {vendor.stats.map((s) => (
                  <div key={s.label} className="flex-1 rounded-md bg-white/10 px-1 py-1 text-center">
                    <div className="text-[10px] font-bold">{s.value}</div>
                    <div className="text-[6px] text-white/70">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">{vendor.recordsTitle}</div>
            {vendor.records.slice(0, 3).map((r, i) => <Row key={i} r={r} />)}
            <HighlightCard h={vendor.highlight} />
          </>
        ) : (
          <>
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-2.5">
              <div className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">{client.title}</div>
              {client.items.map((r, i) => (
                <div key={i} className={`flex items-center justify-between ${i > 0 ? 'mt-1.5 border-t border-white/5 pt-1.5' : ''}`}>
                  <div className="min-w-0"><div className="truncate text-[10px] font-medium text-slate-100">{r.primary}</div><div className="truncate text-[8px] text-slate-500">{r.secondary}</div></div>
                  <span className={`ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${toneBadge[r.tone]}`}>{r.status}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-2.5 py-2">
              <span className="flex items-center gap-1.5 text-[9px] text-slate-300"><Receipt className="h-3 w-3 text-slate-400" />{client.invoice.label}</span>
              <span className="flex items-center gap-1.5"><span className="text-[10px] font-bold text-white">{client.invoice.amount}</span><span className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${toneBadge[client.invoice.tone]}`}>{client.invoice.status}</span></span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg bg-primary-600 py-1.5 text-center text-[9px] font-semibold text-white">{client.cta}</div>
              <div className="rounded-lg border border-white/10 py-1.5 text-center text-[9px] font-medium text-slate-300">Support</div>
            </div>
          </>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-around border-t border-white/5 bg-slate-900 px-1 py-1.5">
        {bottom.map(([N, label], i) => (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <N className={`h-3.5 w-3.5 ${i === 0 ? 'text-primary-400' : 'text-slate-600'}`} />
            <span className={`max-w-[46px] truncate text-[6px] font-medium ${i === 0 ? 'text-primary-400' : 'text-slate-600'}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
