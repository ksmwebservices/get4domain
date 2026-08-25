'use client';

import { useEffect, useState } from 'react';
import { LayoutDashboard, Phone, Sparkles, Megaphone, Wallet } from 'lucide-react';

/**
 * Animated laptop + mobile product mockup for the homepage hero.
 * Renders the REAL Get4Domain dashboard UI (actual module names + brand colors)
 * and cycles through screens — the "see the product" moment. Not a stock image:
 * every screen is a live CSS/JSX render of what the vendor dashboard looks like.
 * Honors prefers-reduced-motion (holds on the first screen).
 */

const TABS = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'telecrm', label: 'TeleCRM', Icon: Phone },
  { key: 'ai', label: 'AI Studio', Icon: Sparkles },
  { key: 'growth', label: 'Growth Hub', Icon: Megaphone },
  { key: 'wallet', label: 'Wallet', Icon: Wallet },
];
const CYCLE = [0, 1, 2, 3]; // screens we animate through

export default function HeroMockup() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((p) => (p + 1) % CYCLE.length), 2400);
    return () => clearInterval(id);
  }, []);

  const active = CYCLE[i];

  return (
    <div className="relative mx-auto w-full max-w-xl select-none">
      {/* ── Laptop ──────────────────────────────────────────────────────── */}
      <div className="relative rounded-t-2xl border-[6px] border-slate-800 bg-slate-800 shadow-2xl ring-1 ring-white/10">
        {/* Screen */}
        <div className="overflow-hidden rounded-t-lg bg-slate-950">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-white/5 bg-slate-900 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-error-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-success-500/80" />
            <div className="ml-2 flex-1 rounded-md bg-slate-800 px-3 py-1 text-[10px] text-slate-400">
              app.get4domain.com/dashboard
            </div>
          </div>

          {/* App body: sidebar + screen */}
          <div className="flex h-[290px] text-left">
            {/* Sidebar */}
            <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-white/5 bg-slate-900/80 p-2.5 sm:flex">
              <div className="mb-1 px-1.5 text-[11px] font-bold text-white">
                Get4<span className="text-primary-400">Domain</span>
              </div>
              {TABS.map((t, idx) => {
                const on = idx === active;
                return (
                  <div
                    key={t.key}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors duration-500 ${
                      on ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/40' : 'text-slate-400'
                    }`}
                  >
                    <t.Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </div>
                );
              })}
            </div>

            {/* Screen content (cross-fades per tab) */}
            <div className="relative flex-1 overflow-hidden bg-slate-950 p-3.5">
              <Screen active={active} />
            </div>
          </div>
        </div>
      </div>
      {/* Laptop base */}
      <div className="relative mx-auto h-3 w-[112%] -translate-x-[5.4%] rounded-b-xl bg-slate-800 shadow-xl ring-1 ring-white/10">
        <div className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-md bg-slate-700" />
      </div>

      {/* ── Mobile (overlapping) ────────────────────────────────────────── */}
      <div className="absolute -bottom-6 -right-1 w-28 rounded-[1.4rem] border-[5px] border-slate-800 bg-slate-800 shadow-2xl ring-1 ring-white/10 sm:-right-6 sm:w-32">
        <div className="overflow-hidden rounded-[1rem] bg-slate-950">
          <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5">
            <span className="text-[8px] font-bold text-white">Get4<span className="text-primary-400">Domain</span></span>
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
          </div>
          <div className="h-[150px] p-2.5">
            <PhoneScreen active={active} />
          </div>
          {/* Bottom nav */}
          <div className="flex items-center justify-around border-t border-white/5 bg-slate-900 px-1 py-1.5">
            {TABS.slice(0, 4).map((t, idx) => (
              <t.Icon key={t.key} className={`h-3 w-3 transition-colors duration-500 ${idx === active ? 'text-primary-400' : 'text-slate-600'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Laptop screen content per active tab. */
function Screen({ active }: { active: number }) {
  return (
    <div key={active} className="animate-[fadeIn_0.5s_ease]">
      {active === 0 && <OverviewScreen />}
      {active === 1 && <TeleCrmScreen />}
      {active === 2 && <AiStudioScreen />}
      {active === 3 && <GrowthScreen />}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-white/5 bg-slate-900/70 ${className}`}>{children}</div>;
}

function OverviewScreen() {
  const bars = [42, 60, 38, 72, 55, 88, 64];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300">Today&apos;s Revenue</span>
        <span className="text-sm font-bold text-success-400">₹42,500</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{ k: 'Leads', v: 28, c: 'text-primary-400' }, { k: 'Bookings', v: 16, c: 'text-warning-400' }, { k: 'Invoices', v: 34, c: 'text-error-400' }].map((s) => (
          <Card key={s.k} className="px-2 py-2 text-center">
            <div className={`text-sm font-bold ${s.c}`}>{s.v}</div>
            <div className="text-[9px] text-slate-500">{s.k}</div>
          </Card>
        ))}
      </div>
      <Card className="flex h-24 items-end gap-1.5 p-2.5">
        {bars.map((h, idx) => (
          <div key={idx} className="flex-1 rounded-t bg-gradient-to-t from-primary-600 to-primary-400" style={{ height: `${h}%` }} />
        ))}
      </Card>
    </div>
  );
}

function TeleCrmScreen() {
  const cols = [
    { t: 'New', c: 'bg-primary-500', n: ['Ravi K.', 'Anjali'] },
    { t: 'Contacted', c: 'bg-warning-500', n: ['Suresh'] },
    { t: 'Qualified', c: 'bg-success-500', n: ['Meera', 'Farah'] },
  ];
  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold text-slate-300">Lead Pipeline</span>
      <div className="grid grid-cols-3 gap-1.5">
        {cols.map((col) => (
          <div key={col.t} className="space-y-1.5">
            <div className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${col.c}`} /><span className="text-[9px] text-slate-400">{col.t}</span></div>
            {col.n.map((name) => (
              <Card key={name} className="px-1.5 py-1.5">
                <div className="text-[9px] font-medium text-slate-200">{name}</div>
                <div className="mt-1 h-1 w-2/3 rounded bg-white/10" />
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AiStudioScreen() {
  const items = [
    { t: 'Social Post', c: 'from-primary-500 to-primary-700' },
    { t: 'Festival Poster', c: 'from-warning-400 to-warning-600' },
    { t: 'Reel Script', c: 'from-error-400 to-error-600' },
    { t: 'Ad Creative', c: 'from-success-400 to-success-600' },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-warning-400" /><span className="text-[11px] font-semibold text-slate-300">AI Studio</span></div>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((it) => (
          <Card key={it.t} className="overflow-hidden p-0">
            <div className={`h-9 bg-gradient-to-br ${it.c}`} />
            <div className="px-2 py-1.5 text-[9px] font-medium text-slate-300">{it.t}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function GrowthScreen() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5 text-error-400" /><span className="text-[11px] font-semibold text-slate-300">Diwali Campaign</span></div>
      <Card className="p-2.5">
        <div className="h-12 rounded bg-gradient-to-r from-error-500/30 via-warning-400/30 to-primary-500/30" />
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[{ k: 'Reach', v: '12.4k' }, { k: 'Clicks', v: '860' }, { k: 'Leads', v: '47' }].map((s) => (
            <div key={s.k}><div className="text-[11px] font-bold text-white">{s.v}</div><div className="text-[8px] text-slate-500">{s.k}</div></div>
          ))}
        </div>
      </Card>
      <div className="flex gap-1.5">
        <div className="h-6 flex-1 rounded bg-primary-600" />
        <div className="h-6 w-10 rounded bg-slate-800" />
      </div>
    </div>
  );
}

/** Compact phone screen mirroring the active tab. */
function PhoneScreen({ active }: { active: number }) {
  const map = [
    { title: 'Revenue', big: '₹42.5k', sub: 'Today', c: 'text-success-400' },
    { title: 'New Leads', big: '28', sub: 'This week', c: 'text-primary-400' },
    { title: 'AI Credits', big: '₹499', sub: 'Free to start', c: 'text-warning-400' },
    { title: 'Reach', big: '12.4k', sub: 'Diwali campaign', c: 'text-error-400' },
  ];
  const s = map[active];
  return (
    <div key={active} className="flex h-full animate-[fadeIn_0.5s_ease] flex-col">
      <div className="rounded-lg border border-white/5 bg-slate-900/70 p-2.5">
        <div className="text-[8px] text-slate-500">{s.title}</div>
        <div className={`text-base font-bold ${s.c}`}>{s.big}</div>
        <div className="text-[8px] text-slate-500">{s.sub}</div>
      </div>
      <div className="mt-2 space-y-1.5">
        {[0, 1, 2].map((r) => (
          <div key={r} className="flex items-center gap-1.5 rounded-md bg-slate-900/60 p-1.5">
            <div className="h-4 w-4 rounded bg-white/10" />
            <div className="flex-1"><div className="h-1 w-3/4 rounded bg-white/10" /><div className="mt-1 h-1 w-1/2 rounded bg-white/5" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
