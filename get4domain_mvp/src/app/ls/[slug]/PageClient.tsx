'use client';

import { useEffect, useState } from 'react';
import { post, track } from './leadspace-client';

/** Counts one view per browser tab session. */
export function ViewBeacon({ slug }: { slug: string }): null {
  useEffect(() => {
    try {
      const k = `ls_seen_${slug}`;
      if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); track(slug, 'view'); }
    } catch {
      track(slug, 'view');
    }
  }, [slug]);
  return null;
}

/** The one button the page asks for. It scrolls to the form and counts the tap. */
export function CtaButton({ slug, label, color, className }: { slug: string; label: string; color: string; className?: string }): React.ReactElement {
  return (
    <a href="#request" onClick={() => track(slug, 'cta')} className={className ?? 'inline-block rounded-xl px-6 py-3.5 text-base font-semibold text-white'} style={{ background: color }}>
      {label}
    </a>
  );
}

/** A bar that stays at the bottom of a phone screen. */
export function StickyCta({ slug, label, color }: { slug: string; label: string; color: string }): React.ReactElement {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 md:hidden">
      <CtaButton slug={slug} label={label} color={color} className="block w-full rounded-xl px-4 py-3.5 text-center text-base font-semibold text-white" />
    </div>
  );
}

const REASONS: [string, string][] = [['SPAM', 'Spam'], ['MISLEADING', 'Misleading or false'], ['ILLEGAL', 'Illegal'], ['NOT_A_REAL_BUSINESS', 'Not a real business'], ['OTHER', 'Something else']];

/** "Report this page": on every page, no login needed. */
export function ReportBox({ slug, initiallyOpen }: { slug: string; initiallyOpen?: boolean }): React.ReactElement {
  const [open, setOpen] = useState(Boolean(initiallyOpen));
  const [reason, setReason] = useState('SPAM');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');
  async function send(): Promise<void> {
    setState('busy'); setError('');
    try { await post('/leadspace/public/report', { slug, reason, note: note || undefined }); setState('sent'); } catch (e) { setError((e as Error).message); setState('idle'); }
  }
  if (state === 'sent') return <p className="text-sm text-slate-600">Thank you. We will look at this page.</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm text-slate-500 underline">Report this page</button>;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-left" id="report">
      <p className="mb-2 text-sm font-medium text-slate-800">What is wrong with this page?</p>
      <select className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <textarea className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2} maxLength={500} placeholder="Tell us more (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? <p role="alert" className="mb-2 text-sm text-red-600">{error}</p> : null}
      <button type="button" disabled={state === 'busy'} onClick={() => void send()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Send report</button>
    </div>
  );
}
