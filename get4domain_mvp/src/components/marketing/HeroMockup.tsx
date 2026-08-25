'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, LayoutDashboard, Phone, Sparkles, Megaphone, Wallet, Globe, UserRound, CalendarCheck, Receipt, AlertTriangle } from 'lucide-react';
import { SHOWCASE, type Tone, type VendorDash, type ClientDash, type DashRow } from '@/data/hero-showcase';

/**
 * Homepage product showcase. Keeps the real website screenshots (Website view) and
 * adds two SIMULATED views per industry — Vendor Dashboard and Client Dashboard —
 * rendered from rich per-industry sample data (no real vendor/customer data, no
 * backend). The PHONE is the primary, larger focal element (mobile-first management
 * is the differentiator); the laptop is a smaller companion beside it. A smooth
 * cross-fade slider steps through industries; a 3-way switcher (with gentle
 * auto-cycle) moves through the three views. Each industry deep-links its book-demo.
 */

const VIEWS = [
  { key: 'website', label: 'Website', Icon: Globe },
  { key: 'vendor', label: 'Vendor App', Icon: LayoutDashboard },
  { key: 'client', label: 'Client App', Icon: UserRound },
];

// Marketing copy only — the ₹99 trial billing flow is NOT built; do not wire to checkout.
const FEATURES = ['Task assignment', 'Team management', 'Accounts', 'Invoice generation', 'TeleCRM', 'CRM', 'AI Studio'];

const toneBadge: Record<Tone, string> = {
  blue: 'bg-primary-500/15 text-primary-300', gold: 'bg-warning-400/15 text-warning-300',
  green: 'bg-success-500/15 text-success-300', red: 'bg-error-500/15 text-error-300', slate: 'bg-white/10 text-slate-300',
};

export default function HeroMockup() {
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

  return (
    <div className="w-full">
      {/* Category slider */}
      <div className="mb-5 overflow-hidden">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:justify-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SHOWCASE.map((s, i) => {
            const on = i === cat;
            return (
              <button
                key={s.key}
                onClick={() => { setCat(i); setView(0); stop(); }}
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

      {/* View switcher */}
      <div className="mb-5 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {VIEWS.map((v, i) => {
          const on = i === view;
          return (
            <button
              key={v.key}
              onClick={() => { setView(i); stop(); }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                on ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <v.Icon className="h-3.5 w-3.5" />{v.label}
            </button>
          );
        })}
      </div>

      {/* Device stage — phone primary (front, larger), laptop companion (behind, smaller) */}
      <div className="relative mx-auto h-[400px] w-full max-w-lg sm:h-[420px]">
        {/* Laptop (secondary companion) */}
        <div className="absolute left-0 top-1/2 w-[54%] max-w-[280px] -translate-y-1/2 sm:left-2">
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
              <div key={`l-${cat}-${view}`} className="aspect-[16/10] w-full animate-[hmFade_0.45s_ease] bg-slate-950">
                {view === 0 && <img src={`/hero-shots/${c.key}-home.webp`} alt={`${c.label} website`} width={1280} height={800} loading="eager" className="h-full w-full object-cover object-top" />}
                {view === 1 && <VendorScreen d={c.vendor} />}
                {view === 2 && <ClientScreen d={c.client} />}
              </div>
            </div>
          </div>
          {/* base */}
          <div className="mx-auto h-1.5 w-[116%] -translate-x-[6.9%] rounded-b-lg bg-slate-700 shadow-lg" />
        </div>

        {/* Phone (primary, larger, front) */}
        <div className="absolute right-0 top-1/2 z-10 w-[48%] max-w-[186px] -translate-y-1/2 sm:right-4">
          <div className="relative rounded-[2.2rem] border border-slate-700/80 bg-gradient-to-b from-slate-800 to-slate-900 p-[5px] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
            {/* side buttons for depth */}
            <div className="absolute -left-[2px] top-[22%] h-9 w-[3px] rounded-l bg-slate-700" />
            <div className="absolute -right-[2px] top-[30%] h-12 w-[3px] rounded-r bg-slate-700" />
            <div className="relative overflow-hidden rounded-[1.85rem] bg-slate-950 ring-1 ring-black/40">
              {/* notch */}
              <div className="pointer-events-none absolute left-1/2 top-1.5 z-20 h-3.5 w-16 -translate-x-1/2 rounded-full bg-slate-900" />
              {/* subtle screen sheen */}
              <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-br from-white/8 via-transparent to-transparent" />
              <div key={`p-${cat}-${view}`} className="aspect-[9/19] w-full animate-[hmFade_0.45s_ease]">
                {view === 0
                  ? <img src={`/hero-shots/${c.key}-mobile.webp`} alt={`${c.label} on mobile`} width={480} height={1040} loading="eager" className="h-full w-full object-cover object-top" />
                  : <MobileApp view={view} vendor={c.vendor} client={c.client} />}
              </div>
            </div>
          </div>
        </div>

        {/* Price + feature overlay (desktop only, left side; marketing copy only) */}
        <div className="absolute -left-3 bottom-1 z-20 hidden w-44 rounded-xl border border-white/10 bg-slate-900/85 p-3 shadow-xl backdrop-blur lg:block">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-warning-400/15 px-2 py-1 text-[11px] font-bold text-warning-300">₹99 Trial</span>
            <span className="rounded-md bg-primary-500/15 px-2 py-1 text-[11px] font-bold text-primary-300">₹999<span className="font-medium text-slate-400">/mo</span></span>
          </div>
          <ul className="mt-2.5 space-y-1">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-[10.5px] text-slate-300">
                <Check className="h-3 w-3 shrink-0 text-success-400" />{f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Per-category CTA */}
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row lg:items-center">
        <Link
          href={`/book-demo?industry=${c.key}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-500"
        >
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

/* ── Simulated Vendor Dashboard (desktop, inside laptop companion) ───────────── */
function VendorScreen({ d }: { d: VendorDash }) {
  const nav = [LayoutDashboard, Phone, Sparkles, Megaphone, Wallet];
  return (
    <div className="flex h-full text-left">
      <div className="hidden w-16 shrink-0 flex-col gap-0.5 border-r border-white/5 bg-slate-900/80 p-1.5 sm:flex">
        <div className="mb-0.5 truncate px-0.5 text-[7px] font-bold text-white">{d.brand}</div>
        {nav.map((Icon, i) => (
          <div key={i} className={`flex items-center rounded px-1 py-0.5 ${i === 0 ? 'bg-primary-600 text-white' : 'text-slate-500'}`}><Icon className="h-2.5 w-2.5" /></div>
        ))}
      </div>
      <div className="flex-1 space-y-1.5 overflow-hidden p-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[7px] text-slate-400">{d.revenueLabel} revenue</span>
          <span className="text-[11px] font-bold text-success-400">{d.revenue}</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {d.stats.map((s) => (
            <div key={s.label} className="rounded border border-white/5 bg-slate-900/70 px-1 py-1 text-center">
              <div className="text-[9px] font-bold text-white">{s.value}</div>
              <div className="text-[6px] text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="space-y-0.5">
          {d.records.slice(0, 3).map((r, i) => <Row key={i} r={r} tiny />)}
        </div>
        <HighlightCard h={d.highlight} />
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
  const Icon = h.kind === 'ai' ? Sparkles : h.kind === 'campaign' ? Megaphone : AlertTriangle;
  const accent = h.kind === 'ai' ? 'from-warning-400/20 to-warning-600/10' : h.kind === 'campaign' ? 'from-error-500/20 to-primary-500/10' : 'from-error-500/20 to-error-700/10';
  return (
    <div className={`flex items-center gap-1.5 rounded border border-white/5 bg-gradient-to-r ${accent} px-1.5 py-1`}>
      <Icon className="h-2.5 w-2.5 shrink-0 text-warning-300" />
      <div className="min-w-0">
        <div className="truncate text-[7px] font-semibold text-white">{h.title}</div>
        <div className="truncate text-[6px] text-slate-400">{h.subtitle}</div>
      </div>
    </div>
  );
}

/* ── Simulated Client Dashboard (desktop, inside laptop companion) ───────────── */
function ClientScreen({ d }: { d: ClientDash }) {
  return (
    <div className="flex h-full flex-col p-1.5 text-left">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[6px] text-slate-500">{d.brand} · Portal</div>
          <div className="text-[10px] font-bold text-white">{d.greeting} 👋</div>
        </div>
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-600/20 text-primary-300"><UserRound className="h-2.5 w-2.5" /></div>
      </div>
      <div className="mt-1 text-[6px] font-semibold uppercase tracking-wide text-slate-500">{d.title}</div>
      <div className="mt-0.5 space-y-0.5">
        {d.items.map((r, i) => <Row key={i} r={r} tiny />)}
      </div>
      <div className="mt-1 flex items-center justify-between rounded border border-white/5 bg-slate-900/70 px-1.5 py-1">
        <span className="flex items-center gap-1 text-[7px] text-slate-300"><Receipt className="h-2.5 w-2.5 text-slate-400" />{d.invoice.label}</span>
        <span className="flex items-center gap-1"><span className="text-[8px] font-bold text-white">{d.invoice.amount}</span><span className={`rounded-full px-1 py-0.5 text-[6px] font-semibold ${toneBadge[d.invoice.tone]}`}>{d.invoice.status}</span></span>
      </div>
      <div className="mt-auto rounded bg-primary-600 py-1 text-center text-[7px] font-semibold text-white">{d.cta}</div>
    </div>
  );
}

/* ── Phone app (primary focal element) for vendor / client views ─────────────── */
function MobileApp({ view, vendor, client }: { view: number; vendor: VendorDash; client: ClientDash }) {
  const isVendor = view === 1;
  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* status bar */}
      <div className="flex items-center justify-between px-3 pt-2 text-[8px] text-slate-400">
        <span>9:41</span>
        <span className="flex gap-1"><span>●●●</span><span>▮</span></span>
      </div>
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold text-white">{isVendor ? vendor.brand : client.greeting + ' 👋'}</div>
          <div className="text-[8px] text-slate-500">{isVendor ? `${vendor.revenueLabel} overview` : `${client.brand} · Portal`}</div>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600/20 text-primary-300">
          {isVendor ? <LayoutDashboard className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden px-3">
        {isVendor ? (
          <>
            <div className="rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 p-2.5 text-white shadow-lg">
              <div className="text-[8px] text-white/70">{vendor.revenueLabel} revenue</div>
              <div className="text-lg font-bold leading-tight">{vendor.revenue}</div>
              <div className="mt-1 flex gap-2">
                {vendor.stats.slice(0, 3).map((s) => (
                  <div key={s.label} className="rounded-md bg-white/10 px-1.5 py-1 text-center">
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
              <div className="text-[8px] text-slate-500">{client.title}</div>
              {client.items.slice(0, 2).map((r, i) => (
                <div key={i} className="mt-1.5 flex items-center justify-between">
                  <div className="min-w-0"><div className="truncate text-[10px] font-medium text-slate-100">{r.primary}</div><div className="truncate text-[8px] text-slate-500">{r.secondary}</div></div>
                  <span className={`ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${toneBadge[r.tone]}`}>{r.status}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-2.5 py-2">
              <span className="flex items-center gap-1.5 text-[9px] text-slate-300"><Receipt className="h-3 w-3 text-slate-400" />{client.invoice.label}</span>
              <span className="flex items-center gap-1.5"><span className="text-[10px] font-bold text-white">{client.invoice.amount}</span><span className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${toneBadge[client.invoice.tone]}`}>{client.invoice.status}</span></span>
            </div>
            <div className="rounded-xl bg-primary-600 py-2 text-center text-[10px] font-semibold text-white">{client.cta}</div>
          </>
        )}
      </div>
      {/* bottom nav */}
      <div className="mt-2 flex items-center justify-around border-t border-white/5 bg-slate-900 px-2 py-2">
        {(isVendor ? [LayoutDashboard, Phone, Sparkles, Wallet] : [LayoutDashboard, CalendarCheck, Receipt, UserRound]).map((Icon, i) => (
          <Icon key={i} className={`h-3.5 w-3.5 ${i === 0 ? 'text-primary-400' : 'text-slate-600'}`} />
        ))}
      </div>
    </div>
  );
}
