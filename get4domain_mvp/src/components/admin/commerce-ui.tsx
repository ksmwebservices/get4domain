'use client';

import { type ReactNode, useState } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';

/** Tiny shared UI kit for the admin Commerce screens (dark admin theme). */

export const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none';
export const selectCls = inputCls;
export const cardCls = 'rounded-2xl border border-slate-800 bg-slate-900 p-5';

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

const PILL: Record<string, string> = {
  PAID: 'bg-success-500/20 text-success-400 border-success-500/30',
  ACTIVE: 'bg-success-500/20 text-success-400 border-success-500/30',
  CONFIRMED: 'bg-success-500/20 text-success-400 border-success-500/30',
  APPLIED: 'bg-success-500/20 text-success-400 border-success-500/30',
  SENT: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  PENDING: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  PARTIALLY_PAID: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  ACTIVE_PAYMENT_DUE: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  REQUESTED: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  APPROVED: 'bg-primary-500/20 text-primary-300 border-primary-500/30',
  PAYMENT_SUBMITTED: 'bg-primary-500/20 text-primary-300 border-primary-500/30',
  SUBMITTED: 'bg-primary-500/20 text-primary-300 border-primary-500/30',
  DRAFT: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  OVERDUE: 'bg-error-500/20 text-error-400 border-error-500/30',
  LAPSED: 'bg-error-500/20 text-error-400 border-error-500/30',
  REJECTED: 'bg-error-500/20 text-error-400 border-error-500/30',
  VOID: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  CANCELLED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  EXPIRED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  DEMO: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

export function Pill({ value, label }: { value: string; label?: string }) {
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${PILL[value] ?? PILL.DRAFT}`}>{label ?? value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>;
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1800); }).catch(() => undefined); }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">
      {done ? <CheckCircle2 className="h-3.5 w-3.5 text-success-400" /> : <Copy className="h-3.5 w-3.5" />}{done ? 'Copied' : label}
    </button>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <div role="alert" className="rounded-xl border border-error-800 bg-error-950/50 px-4 py-3 text-sm text-error-400">{message}</div>;
}

/** A pay link, shown ONCE with copy — the API never returns it again. */
export function PayLinkBox({ link, note }: { link: string; note?: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-primary-500/30 bg-primary-500/10 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary-300">Pay link — shown once</div>
      <div className="break-all rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">{link}</div>
      <div className="flex items-center gap-3"><CopyButton text={link} label="Copy link" /><span className="text-[11px] text-slate-400">{note ?? 'Only a hash is stored. If you lose it, use "Copy link" on the invoice to issue a fresh one (the old link stops working).'}</span></div>
    </div>
  );
}

export const msg = (e: unknown, fallback = 'Something went wrong'): string => (e instanceof Error ? e.message : fallback);
