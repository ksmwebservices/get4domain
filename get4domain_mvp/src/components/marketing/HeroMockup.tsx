'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutDashboard, Phone, Sparkles, Megaphone, Wallet, Globe, UserRound, CalendarCheck, Receipt, AlertTriangle } from 'lucide-react';
import { SHOWCASE, type Tone, type VendorDash, type ClientDash, type DashRow } from '@/data/hero-showcase';

/**
 * Homepage product showcase. Keeps the real website screenshots (Website view) and
 * adds two SIMULATED views per industry — the Vendor Dashboard and the Client
 * Dashboard — rendered from rich per-industry sample data (no real vendor/customer
 * data, no backend). A smooth animated slider steps through industries; a 3-way
 * switcher (and gentle auto-cycle) moves through the three views. Each industry has
 * a direct CTA into its book-demo flow.
 */

const VIEWS = [
  { key: 'website', label: 'Website', Icon: Globe },
  { key: 'vendor', label: 'Vendor App', Icon: LayoutDashboard },
  { key: 'client', label: 'Client App', Icon: UserRound },
];

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
      <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
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

      {/* Device stage */}
      <div className="relative mx-auto w-full max-w-xl select-none">
        {/* Laptop */}
        <div className="relative rounded-t-2xl border-[6px] border-slate-800 bg-slate-800 shadow-2xl ring-1 ring-white/10">
          <div className="overflow-hidden rounded-t-lg bg-slate-950">
            <div className="flex items-center gap-2 border-b border-white/5 bg-slate-900 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-error-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-success-500/80" />
              <div className="ml-2 flex-1 truncate rounded-md bg-slate-800 px-3 py-1 text-[10px] text-slate-400">
                {view === 0 ? `${c.key}.get4domain.com` : view === 1 ? 'app.get4domain.com/dashboard' : 'app.get4domain.com/portal'}
              </div>
            </div>
            <div key={`${cat}-${view}`} className="aspect-[16/10] w-full animate-[hmFade_0.45s_ease] bg-slate-950">
              {view === 0 && (
                <img src={`/hero-shots/${c.key}-home.webp`} alt={`${c.label} website built with Get4Domain`} width={1280} height={800} loading="eager" className="h-full w-full object-cover object-top" />
              )}
              {view === 1 && <VendorScreen d={c.vendor} />}
              {view === 2 && <ClientScreen d={c.client} />}
            </div>
          </div>
        </div>
        <div className="relative mx-auto h-3 w-[112%] -translate-x-[5.4%] rounded-b-xl bg-slate-800 shadow-xl ring-1 ring-white/10">
          <div className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-md bg-slate-700" />
        </div>

        {/* Mobile */}
        <div className="absolute -bottom-8 -right-1 w-28 overflow-hidden rounded-[1.4rem] border-[5px] border-slate-800 bg-slate-800 shadow-2xl ring-1 ring-white/10 sm:-right-6 sm:w-36">
          <div key={`m-${cat}-${view}`} className="animate-[hmFade_0.45s_ease] overflow-hidden rounded-[1rem] bg-slate-950">
            {view === 0 ? (
              <img src={`/hero-shots/${c.key}-mobile.webp`} alt={`${c.label} site on mobile`} width={480} height={1040} loading="eager" className="h-full w-full object-cover object-top" />
            ) : (
              <PhoneScreen view={view} vendor={c.vendor} client={c.client} />
            )}
          </div>
        </div>
      </div>

      {/* Per-category CTA */}
      <div className="mt-11 flex flex-col items-center gap-3 sm:flex-row lg:items-center">
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

/* ── Simulated Vendor Dashboard (desktop, inside laptop) ─────────────────────── */
function VendorScreen({ d }: { d: VendorDash }) {
  const nav = [
    { Icon: LayoutDashboard, on: true }, { Icon: Phone }, { Icon: Sparkles }, { Icon: Megaphone }, { Icon: Wallet },
  ];
  return (
    <div className="flex h-full text-left">
      <div className="hidden w-24 shrink-0 flex-col gap-1 border-r border-white/5 bg-slate-900/80 p-2 sm:flex">
        <div className="mb-1 truncate px-1 text-[10px] font-bold text-white">{d.brand}</div>
        {nav.map((n, i) => (
          <div key={i} className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 ${n.on ? 'bg-primary-600 text-white' : 'text-slate-500'}`}>
            <n.Icon className="h-3 w-3" />
          </div>
        ))}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">{d.revenueLabel} revenue</span>
          <span className="text-sm font-bold text-success-400">{d.revenue}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {d.stats.map((s) => (
            <div key={s.label} className="rounded-md border border-white/5 bg-slate-900/70 px-1.5 py-1.5 text-center">
              <div className="text-xs font-bold text-white">{s.value}</div>
              <div className="text-[8px] text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">{d.recordsTitle}</div>
          <div className="space-y-1">
            {d.records.slice(0, 4).map((r, i) => <Row key={i} r={r} />)}
          </div>
        </div>
        <HighlightCard h={d.highlight} />
      </div>
    </div>
  );
}

function Row({ r }: { r: DashRow }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-900/60 px-2 py-1">
      <div className="min-w-0">
        <div className="truncate text-[9px] font-medium text-slate-200">{r.primary}</div>
        <div className="truncate text-[8px] text-slate-500">{r.secondary}</div>
      </div>
      <span className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${toneBadge[r.tone]}`}>{r.status}</span>
    </div>
  );
}

function HighlightCard({ h }: { h: VendorDash['highlight'] }) {
  const Icon = h.kind === 'ai' ? Sparkles : h.kind === 'campaign' ? Megaphone : AlertTriangle;
  const accent = h.kind === 'ai' ? 'from-warning-400/20 to-warning-600/10 text-warning-300' : h.kind === 'campaign' ? 'from-error-500/20 to-primary-500/10 text-error-300' : 'from-error-500/20 to-error-700/10 text-error-300';
  return (
    <div className={`flex items-center gap-2 rounded-md border border-white/5 bg-gradient-to-r ${accent} px-2 py-1.5`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="truncate text-[9px] font-semibold text-white">{h.title}</div>
        <div className="truncate text-[8px] text-slate-400">{h.subtitle}</div>
      </div>
    </div>
  );
}

/* ── Simulated Client Dashboard (desktop, inside laptop) ─────────────────────── */
function ClientScreen({ d }: { d: ClientDash }) {
  return (
    <div className="flex h-full flex-col p-3 text-left">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] text-slate-500">{d.brand} · Customer Portal</div>
          <div className="text-sm font-bold text-white">{d.greeting} 👋</div>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600/20 text-primary-300"><UserRound className="h-3.5 w-3.5" /></div>
      </div>
      <div className="mt-2.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">{d.title}</div>
      <div className="mt-1 space-y-1.5">
        {d.items.map((r, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/70 px-2.5 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5"><CalendarCheck className="h-3 w-3 text-primary-300" /><span className="truncate text-[10px] font-medium text-slate-100">{r.primary}</span></div>
              <div className="mt-0.5 truncate pl-4 text-[8px] text-slate-500">{r.secondary}</div>
            </div>
            <span className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${toneBadge[r.tone]}`}>{r.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/70 px-2.5 py-2">
        <div className="flex items-center gap-1.5"><Receipt className="h-3 w-3 text-slate-400" /><span className="text-[9px] text-slate-300">{d.invoice.label}</span></div>
        <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-white">{d.invoice.amount}</span><span className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${toneBadge[d.invoice.tone]}`}>{d.invoice.status}</span></div>
      </div>
      <button className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 py-1.5 text-[10px] font-semibold text-white">{d.cta}</button>
    </div>
  );
}

/* ── Phone (compact) for vendor / client views ──────────────────────────────── */
function PhoneScreen({ view, vendor, client }: { view: number; vendor: VendorDash; client: ClientDash }) {
  return (
    <div className="flex h-[168px] flex-col">
      <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5">
        <span className="text-[8px] font-bold text-white">Get4<span className="text-primary-400">Domain</span></span>
        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
      </div>
      <div className="flex-1 space-y-1.5 overflow-hidden p-2">
        {view === 1 ? (
          <>
            <div className="rounded-md border border-white/5 bg-slate-900/70 p-1.5">
              <div className="text-[7px] text-slate-500">{vendor.revenueLabel} revenue</div>
              <div className="text-xs font-bold text-success-400">{vendor.revenue}</div>
            </div>
            {vendor.records.slice(0, 2).map((r, i) => <Row key={i} r={r} />)}
          </>
        ) : (
          <>
            <div className="rounded-md border border-white/5 bg-slate-900/70 p-1.5">
              <div className="text-[7px] text-slate-500">{client.title}</div>
              <div className="text-[9px] font-bold text-white">{client.greeting}</div>
            </div>
            {client.items.slice(0, 2).map((r, i) => <Row key={i} r={r} />)}
          </>
        )}
      </div>
      <div className="flex items-center justify-around border-t border-white/5 bg-slate-900 px-1 py-1.5">
        {(view === 1 ? [LayoutDashboard, Phone, Sparkles, Wallet] : [LayoutDashboard, CalendarCheck, Receipt, UserRound]).map((Icon, i) => (
          <Icon key={i} className={`h-3 w-3 ${i === 0 ? 'text-primary-400' : 'text-slate-600'}`} />
        ))}
      </div>
    </div>
  );
}
