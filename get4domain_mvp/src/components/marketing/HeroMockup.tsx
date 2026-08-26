'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, Check, ShoppingBag, LayoutDashboard, Phone, Sparkles, Megaphone, Wallet, Globe, UserRound, CalendarCheck, Receipt, AlertTriangle, Bell, Building2, Users, Star, Clock, MessageCircle, type LucideProps } from 'lucide-react';
import { SHOWCASE, type Tone, type VendorDash, type ClientDash, type DashRow, type ShowcaseCategory } from '@/data/hero-showcase';
import InstallPwaButton from './InstallPwaButton';

// Small proof/feature rows (honest, current claims).
export const TRUST: [ComponentType<LucideProps>, string][] = [
  [Building2, '50+ Businesses'], [Users, '20+ Industries'], [Star, '4.9★ Rating'], [Clock, '24h Support'], [Receipt, 'GST Compliant'],
];
export const QUICK_FEATURES: [ComponentType<LucideProps>, string][] = [
  [MessageCircle, 'WhatsApp'], [Sparkles, 'AI Studio'], [Phone, 'TeleCRM'], [Receipt, 'GST Invoicing'],
];

/**
 * Homepage hero — a DIRECT PORT of the Bolt hero reference (Hero.tsx + HeroMockup.tsx).
 * Reference colors are substituted 1:1 by role: their emerald/teal → our primary blue,
 * their amber → our warning gold, their ink-900/800 → our slate dark/card tokens.
 *
 * Layout comes from the ported `.hero-grid` (globals.css): single column on mobile
 * (header → mockup → cta), two columns at 640px+ with the device mockup spanning both
 * rows on the right. We keep OUR real Playwright website screenshots (Website view) plus
 * two SIMULATED views per industry (Vendor App, Client App) from sample data — no real
 * vendor/customer data, no backend.
 */

const VIEWS = [
  { key: 'website', label: 'Website', Icon: Globe },
  { key: 'vendor', label: 'Vendor App', Icon: LayoutDashboard },
  { key: 'client', label: 'Client App', Icon: UserRound },
];

// Dark glass, ported from the reference `.glass` (their ink-800 → our slate-800).
const GLASS = 'bg-slate-800/60 backdrop-blur-xl border border-white/5';

type Icon = ComponentType<LucideProps>;
const toneBadge: Record<Tone, string> = {
  blue: 'bg-primary-500/15 text-primary-300', gold: 'bg-warning-400/15 text-warning-300',
  green: 'bg-success-500/15 text-success-300', red: 'bg-error-500/15 text-error-300', slate: 'bg-white/10 text-slate-300',
};

export default function HomeHero() {
  const [cat, setCat] = useState(0);
  const [view, setView] = useState(1); // default to Vendor App — this is a business-ops app, not a website
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
  const selectCat = (i: number) => { setCat(i); setView(1); stop(); }; // keep Vendor App as the shown view
  const selectView = (i: number) => { setView(i); stop(); };

  // Subtle cursor-driven 3D tilt on the device stage (hover only).
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const onTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -5, y: ((e.clientX - r.left) / r.width - 0.5) * 7 });
  };
  const resetTilt = () => setTilt({ x: 0, y: 0 });

  return (
    <section className="relative overflow-hidden bg-slate-950">
      {/* Ambient background — ported from the reference, recolored to our blue/gold/red glows. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-40 h-[40rem] w-[40rem] rounded-full bg-primary-600/15 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[30rem] w-[30rem] rounded-full bg-warning-500/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[35rem] w-[35rem] rounded-full bg-error-600/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl overflow-hidden px-4 pb-8 pt-6 sm:px-6 sm:pt-10 lg:px-8 lg:pt-14">
        {/* Top row: headline + mockup side-by-side (reference .hero-grid areas). */}
        <div className="hero-grid gap-5 sm:gap-6 lg:gap-12">
          {/* HEADER — badge + headline + subheadline + pricing chip */}
          <div className="hero-grid-header hero-content min-w-0 w-full max-w-[calc(100vw-2rem)] text-center sm:text-left">
            {/* badge (our tagline; reference pulse-ring dot, recolored to primary) */}
            <div className="flex animate-fade-up justify-center sm:justify-start">
              <div className={`inline-flex items-center gap-2 rounded-full ${GLASS} px-3 py-1 text-[11px] font-medium text-slate-200`}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-400" />
                </span>
                Your Online Identity Partner
              </div>
            </div>

            {/* headline — OUR copy (locked); reference sizing/leading */}
            <h1 className="mt-3 animate-fade-up text-[1.75rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl" style={{ animationDelay: '60ms' }}>
              Turn Your Website Into a <span className="text-gradient-hero">WebApp</span>
              <span className="mt-1.5 block text-lg font-semibold text-slate-200 sm:text-xl lg:text-2xl">
                Manage your full business operations, along with <span className="text-warning-300">AI Studio</span>.
              </span>
            </h1>

            {/* subheadline */}
            <p className="mx-auto mt-3 max-w-md animate-fade-up text-sm leading-relaxed text-slate-400 sm:mx-0" style={{ animationDelay: '120ms' }}>
              A professional industry website <span className="font-medium text-slate-200">and</span> the full web-app behind it — leads, CRM, bookings, invoices, WhatsApp &amp; AI content, from your laptop or phone.
            </p>

            {/* pricing chip (reference style; amber → our gold) */}
            <div className="mt-3 flex animate-fade-up justify-center sm:justify-start" style={{ animationDelay: '180ms' }}>
              <div className="flex max-w-full items-center gap-2 rounded-xl border border-warning-400/30 bg-warning-400/10 px-3 py-2 text-sm">
                <span className="font-bold text-warning-200">₹999/mo</span>
                <span className="text-xs text-slate-400">or</span>
                <span className="font-bold text-warning-200">₹9,999/yr</span>
                <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-success-500/15 px-1.5 py-0.5 text-[9px] font-medium text-success-300">
                  <Check className="h-2 w-2" /> Save 17%
                </span>
              </div>
            </div>
          </div>

          {/* MOCKUP — view switcher + device stage + subdomain label */}
          <div className="hero-grid-mockup hero-content flex min-w-0 w-full max-w-[calc(100vw-2rem)] animate-fade-up flex-col items-center gap-3" style={{ animationDelay: '160ms' }}>
            <ViewSwitcher view={view} onSelect={selectView} />
            {/* Overlapping composition: phone primary (right), laptop companion (left). Cursor-driven tilt for depth. */}
            <div
              className="relative mx-auto h-[340px] w-full max-w-[360px] [perspective:1200px] sm:h-[440px] sm:max-w-[460px]"
              onMouseMove={onTilt}
              onMouseLeave={resetTilt}
            >
              <div className="absolute right-0 top-1/2 z-10 w-[46%] max-w-[160px] -translate-y-1/2 sm:max-w-[200px]">
                <div className="transition-transform duration-200 ease-out" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
                  <PhoneFrame c={c} view={view} />
                </div>
              </div>
              <div className="absolute left-0 top-1/2 z-0 w-[58%] max-w-[240px] -translate-y-1/2 sm:max-w-[270px]">
                <div className="transition-transform duration-200 ease-out" style={{ transform: `rotateX(${tilt.x * 0.6}deg) rotateY(${tilt.y * 0.6}deg)` }}>
                  <LaptopFrame c={c} view={view} />
                </div>
              </div>
            </div>
            <SubdomainLabel subdomain={`${c.key}.get4domain.com`} />
          </div>

          {/* CTA — button pair + quick features + trust strip */}
          <div className="hero-grid-cta hero-content min-w-0 w-full max-w-[calc(100vw-2rem)] text-center sm:text-left">
            {/* Buy Now / Visit Demo — ported button pair (gold pill + glass) */}
            <div className="mt-1 flex animate-fade-up flex-col items-center gap-2 sm:flex-row sm:items-start" style={{ animationDelay: '240ms' }}>
              <Link
                href="/book-demo"
                className="group inline-flex w-full max-w-full items-center justify-center gap-1.5 rounded-xl bg-warning-400 px-4 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto"
              >
                Buy Now
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href={`/demo/${c.key}`}
                className={`group inline-flex w-full max-w-full items-center justify-center gap-1.5 rounded-xl ${GLASS} px-4 py-2.5 text-sm font-medium text-slate-100 transition-all hover:bg-slate-800/80 sm:w-auto`}
              >
                <Play className="h-3.5 w-3.5 text-primary-300" />
                Visit Demo
              </Link>
            </div>

            {/* install / download app — our PWA button */}
            <div className="mt-2 animate-fade-up" style={{ animationDelay: '270ms' }}>
              <InstallPwaButton className="w-full sm:w-auto" />
            </div>

            {/* quick feature chips */}
            <div className="mt-3 flex animate-fade-up flex-wrap justify-center gap-1.5 sm:justify-start" style={{ animationDelay: '300ms' }}>
              {QUICK_FEATURES.map(([Ic, label]) => (
                <div key={label} className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300">
                  <Ic className="h-2.5 w-2.5 text-primary-400" />
                  {label}
                </div>
              ))}
            </div>

            {/* trust strip */}
            <div className="mt-3 animate-fade-in" style={{ animationDelay: '360ms' }}>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400 sm:justify-start">
                {TRUST.map(([Ic, label], i) => (
                  <div key={label} className="flex items-center gap-1">
                    <Ic className="h-3 w-3 text-primary-400" />
                    <span>{label}</span>
                    {i < TRUST.length - 1 && <span className="hidden text-slate-600 sm:inline">·</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Industry pills — below the fold, horizontally scrollable (controls the mockup). */}
        <CategorySlider cat={cat} onSelect={selectCat} className="mt-6" />
      </div>

      <style>{`@keyframes hmFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </section>
  );
}

/* ── Shared controls ─────────────────────────────────────────────────────────── */
function SubdomainLabel({ subdomain }: { subdomain: string }) {
  return (
    <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-400" />
      <span className="font-mono">{subdomain}</span>
    </div>
  );
}

function CategorySlider({ cat, onSelect, className = '' }: { cat: number; onSelect: (i: number) => void; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 sm:justify-center lg:flex-wrap">
        {SHOWCASE.map((s, i) => {
          const on = i === cat;
          return (
            <button
              key={s.key}
              onClick={() => onSelect(i)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                on ? 'border-primary-400/40 bg-primary-500/15 text-primary-200 shadow-glow' : 'border-white/5 bg-slate-800/50 text-slate-300 hover:border-white/10 hover:bg-slate-800/80 hover:text-slate-100'
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

/* ── Device frames (reused by both variants) ─────────────────────────────────── */
function PhoneFrame({ c, view }: { c: ShowcaseCategory; view: number }) {
  return (
    <div className="relative rounded-[2.2rem] border border-slate-700/80 bg-gradient-to-b from-slate-800 to-slate-900 p-[5px] shadow-device-phone ring-1 ring-white/10">
      {/* brand glow beneath the phone (gold) */}
      <div className="pointer-events-none absolute -bottom-4 left-1/2 h-6 w-2/3 -translate-x-1/2 rounded-full bg-warning-500/20 blur-2xl" />
      {/* side buttons for depth */}
      <div className="absolute -left-[2px] top-[20%] h-6 w-[3px] rounded-l bg-slate-700" />
      <div className="absolute -left-[2px] top-[32%] h-9 w-[3px] rounded-l bg-slate-700" />
      <div className="absolute -right-[2px] top-[28%] h-12 w-[3px] rounded-r bg-slate-700" />
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
    <div className="relative">
      {/* brand glow beneath the laptop (blue) */}
      <div className="pointer-events-none absolute -bottom-3 left-1/2 h-6 w-3/4 -translate-x-1/2 rounded-full bg-primary-500/20 blur-2xl" />
      <div className="rounded-lg border-[5px] border-slate-800 bg-slate-800 shadow-device ring-1 ring-white/10">
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
