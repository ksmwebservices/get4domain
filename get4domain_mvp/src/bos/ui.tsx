'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Loader2, Lock } from 'lucide-react';
import Card from '@/components/ui/Card';
import { BosError, bos, type Entitlements, STATUS_LABEL } from './client';
import { CAPABILITIES } from '@/lib/nav.generated';

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50';
export const labelCls = 'mb-1 block text-xs font-semibold text-slate-600';

export function Spinner() { return <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>; }

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'ok' }) {
  const cls = tone === 'error' ? 'border-error-200 bg-error-50 text-error-700' : tone === 'ok' ? 'border-success-200 bg-success-50 text-success-700' : 'border-primary-200 bg-primary-50 text-primary-800';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /><div>{children}</div></div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className={labelCls}>{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}</label>;
}

const PILL: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', ISSUED: 'bg-amber-50 text-amber-700', PART_PAID: 'bg-amber-50 text-amber-700', PAID: 'bg-success-50 text-success-700',
  CANCELLED: 'bg-slate-100 text-slate-400 line-through', ACCEPTED: 'bg-success-50 text-success-700', REJECTED: 'bg-error-50 text-error-700', CONVERTED: 'bg-primary-50 text-primary-700',
};
export function StatusPill({ status, quote = false }: { status: string; quote?: boolean }) {
  const label = quote && status === 'ISSUED' ? 'Sent' : STATUS_LABEL[status] ?? status;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PILL[status] ?? 'bg-slate-100 text-slate-600'}`}>{label}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <Card padded className="text-center"><div className="text-sm font-semibold text-slate-800">{title}</div>{children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{children}</p>}{action && <div className="mt-3">{action}</div>}</Card>;
}

export function Stat({ label, value, tone = 'default', hint }: { label: string; value: ReactNode; tone?: 'default' | 'warn' | 'good'; hint?: string }) {
  return <Card padded><div className="text-xs text-slate-500">{label}</div><div className={`text-xl font-bold ${tone === 'warn' ? 'text-amber-600' : tone === 'good' ? 'text-success-700' : 'text-slate-900'}`}>{value}</div>{hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}</Card>;
}

/** A screen's tab bar, kept in the address (?tab=) so a refresh or a shared link lands on the same tab. */
export function useTabParam(keys: string[], fallback: string): [string, (k: string) => void] {
  const [tab, setTab] = useState(fallback);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab');
    if (q && keys.includes(q)) setTab(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (k: string) => { setTab(k); const u = new URL(window.location.href); u.searchParams.set('tab', k); window.history.replaceState(null, '', u.toString()); };
  return [tab, set];
}

export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; locked?: boolean }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div role="tablist" aria-label="Sections" className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={t.key === active} onClick={() => onChange(t.key)}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${t.key === active ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          {t.label}{t.locked && <Lock className="h-3 w-3" aria-label="On the Pro plan" />}
        </button>
      ))}
    </div>
  );
}

/** What a plan locks, rendered from the server's own answer (403 PLAN_REQUIRED): the sentence, the plan, and one button. Never a dead end. */
export function UpgradeNotice({ capabilityId, feature }: { capabilityId?: string; feature?: string }) {
  const cap = CAPABILITIES.find((c) => c.id === (capabilityId ?? feature));
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-slate-200 bg-white p-7 text-center" role="region" aria-label={cap ? `${cap.label} is on the Pro plan` : 'On the Pro plan'}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50"><Lock className="h-5 w-5 text-primary-600" /></div>
      <h2 className="text-lg font-bold text-slate-900">{cap?.upgrade.headline ?? 'This is on the Pro plan'}</h2>
      <p className="mt-2 text-sm text-slate-600">{cap?.upgrade.body ?? 'Your records are kept, and everything you have entered shows up here as soon as you upgrade.'}</p>
      <p className="mt-3 text-xs font-medium text-slate-500">Nothing you have already entered is lost or needs entering again.</p>
      <Link href="/dashboard/account/billing?tab=billing" className="mt-5 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">See plans and upgrade</Link>
    </div>
  );
}

/** Shows `children` only when the server lets this vendor use the capability; otherwise the upgrade notice. A 403 from a child call shows the same notice. */
export function Gate({ capabilityId, children }: { capabilityId: string; children: ReactNode }) {
  const ent = useEntitlements();
  if (!ent) return <Spinner />;
  const c = ent.capabilities[capabilityId];
  if (c && !c.allowed) return <UpgradeNotice capabilityId={capabilityId} />;
  return <>{children}</>;
}

let entCache: { at: number; value: Entitlements } | null = null;
export function useEntitlements(): Entitlements | null {
  const [v, setV] = useState<Entitlements | null>(entCache && Date.now() - entCache.at < 15_000 ? entCache.value : null);
  useEffect(() => {
    if (v) return;
    bos<Entitlements>('/bos/entitlements').then((e) => { entCache = { at: Date.now(), value: e }; setV(e); }).catch(() => { /* the server still enforces; the screen simply shows no lock */ });
  }, [v]);
  return v;
}
export function allowed(ent: Entitlements | null, id: string): boolean { return !ent || ent.capabilities[id]?.allowed !== false; }

/** Renders a load error: a plan lock becomes the upgrade notice, anything else a plain alert. */
export function ErrorView({ error }: { error: BosError }) {
  if (error.planRequired) return <UpgradeNotice feature={error.planRequired.feature} />;
  return <Alert>{error.message}</Alert>;
}

/** One-time dismissible note (kept per browser). */
export function OneTimeNote({ id, children }: { id: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(localStorage.getItem(`g4d_note_${id}`) !== '1'); } catch { setShow(true); } }, [id]);
  if (!show) return null;
  return (
    <div className="mb-4"><Alert tone="info"><span>{children}</span> <button className="ml-2 font-semibold underline" onClick={() => { try { localStorage.setItem(`g4d_note_${id}`, '1'); } catch { /* ignore */ } setShow(false); }}>Got it</button></Alert></div>
  );
}

export function csvDownload(name: string, rows: (string | number)[][]): void {
  const esc = (c: string | number) => { const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

/** Download a file the API streams (needs the login token, so a plain link will not do). */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
  const token = typeof window !== 'undefined' ? localStorage.getItem('g4d_token') : null;
  const res = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) { let m = 'We could not prepare that file. Try again in a minute.'; try { const j = await res.json(); if (j?.message && typeof j.message === 'string') m = j.message; } catch { /* keep */ } throw new Error(m); }
  const cd = res.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

/** Opens an authenticated HTML page (invoice / statement) in a new tab. */
export async function openHtml(path: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
  const token = typeof window !== 'undefined' ? localStorage.getItem('g4d_token') : null;
  const res = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('We could not open that page. Try again in a minute.');
  const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html;charset=utf-8' }));
  window.open(url, '_blank', 'noopener');
}
