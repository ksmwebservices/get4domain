'use client';

import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { bos, plain } from '@/bos/client';

/** Admin (dark) primitives for the LeadSpace console. */
export const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none';
export const card = 'rounded-2xl border border-slate-800 bg-slate-900 p-4';

export const adm = bos;

export function Spin() { return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>; }

export function Msg({ tone, children }: { tone: 'ok' | 'error' | 'info'; children: ReactNode }) {
  const cls = tone === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-300' : tone === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-sky-500/40 bg-sky-500/10 text-sky-300';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}>{children}</div>;
}

export function Btn({ children, onClick, tone = 'primary', disabled, busy, type = 'button' }: { children: ReactNode; onClick?: () => void; tone?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean; type?: 'button' | 'submit' }) {
  const cls = tone === 'primary' ? 'bg-primary-600 text-white hover:bg-primary-500' : tone === 'danger' ? 'bg-red-600/90 text-white hover:bg-red-500' : 'border border-slate-700 text-slate-300 hover:bg-slate-800';
  return <button type={type} onClick={onClick} disabled={disabled || busy} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${cls}`}>{busy && <Loader2 className="h-3 w-3 animate-spin" />}{children}</button>;
}

export function Pill({ children, tone = 'grey' }: { children: ReactNode; tone?: 'grey' | 'green' | 'amber' | 'red' | 'blue' }) {
  const cls = { grey: 'bg-slate-800 text-slate-300', green: 'bg-emerald-500/15 text-emerald-300', amber: 'bg-amber-500/15 text-amber-300', red: 'bg-red-500/15 text-red-300', blue: 'bg-sky-500/15 text-sky-300' }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
        <thead className="bg-slate-900 text-[11px] uppercase tracking-wide text-slate-500"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-200">{children}</tbody>
      </table>
      {empty && <div className="px-4 py-6 text-center text-sm text-slate-500">{empty}</div>}
    </div>
  );
}

/** Runs one admin action and shows the plain-language result. */
export function useAct(after?: () => void): { msg: { tone: 'ok' | 'error'; text: string } | null; busy: string; act: (label: string, fn: () => Promise<unknown>, ok: string) => Promise<void> } {
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  async function act(label: string, fn: () => Promise<unknown>, ok: string): Promise<void> {
    setBusy(label); setMsg(null);
    try { await fn(); setMsg({ tone: 'ok', text: ok }); after?.(); } catch (e) { setMsg({ tone: 'error', text: plain(e) }); } finally { setBusy(''); }
  }
  return { msg, busy, act };
}

export const rs = (paise: number | null | undefined): string => (paise === null || paise === undefined ? '-' : `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`);
export const when = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
