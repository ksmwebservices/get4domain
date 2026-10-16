'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarPlus, Check, Loader2, MessageCircle, Phone, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useCart } from '../components/EngineCart';
import type { PopupStep, ShellItem, ShellRuntime } from './types';

/**
 * The primary-action popup and the quick view, with the page-wide click handling that makes EVERY trigger open them: the engine's own action buttons, any element marked
 * data-g4d-open, and the older "#enquiry" links of the built-in designs. Without script those are ordinary links to a real page (the same form), so nothing is hidden from
 * search engines or from a visitor with scripts off. The popup submits through the existing public action (engine.enquiry into the vendor's CRM): no parallel flow.
 */
interface OpenOptions { itemId?: string; itemTitle?: string; teamName?: string }
interface Ctx { runtime: ShellRuntime; open: (o?: OpenOptions) => void; close: () => void; quickView: (itemId: string) => void }
const ShellCtx = createContext<Ctx | null>(null);
export const useShell = (): Ctx | null => useContext(ShellCtx);

type Values = Record<string, string>;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const field = 'w-full border border-[var(--sh-border)] bg-[var(--sh-bg)] px-3.5 py-3 text-base text-[var(--sh-fg)] outline-none focus:border-[var(--sh-accent)] md:text-sm';
const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--sh-muted)]';
const btnPrimary = 'inline-flex min-h-[44px] items-center justify-center gap-2 bg-[var(--sh-accent)] px-5 py-3 text-sm font-semibold text-[var(--sh-accent-fg)] disabled:opacity-60';
const btnGhost = 'inline-flex min-h-[44px] items-center justify-center gap-2 border border-[var(--sh-border)] px-5 py-3 text-sm font-medium text-[var(--sh-fg)]';
const radius = { borderRadius: 'var(--sh-radius)' } as const;

function icsFor(title: string, date: string, note: string): string {
  const d = date.replace(/-/g, '');
  const next = new Date(`${date}T00:00:00`); next.setDate(next.getDate() + 1);
  const e = next.toISOString().slice(0, 10).replace(/-/g, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Get4Domain//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@get4domain`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${e}`, `SUMMARY:${title.replace(/[\r\n,;]/g, ' ')}`, `DESCRIPTION:${note.replace(/[\r\n,;]/g, ' ').slice(0, 200)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

export function ShellProvider({ runtime, children }: { runtime: ShellRuntime; children: ReactNode }) {
  const [openState, setOpenState] = useState<OpenOptions | null>(null);
  const [quick, setQuick] = useState<ShellItem | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const cart = useCart();

  const open = useCallback((o: OpenOptions = {}) => {
    // a shop's main action is its cart; with no cart the popup asks what the shopper wants and sends an enquiry instead
    if (runtime.cart.enabled && runtime.popup.steps[0]?.kind === 'cart') { cart.openCheckout(); return; }
    opener.current = (document.activeElement as HTMLElement) ?? null;
    setQuick(null); setOpenState(o);
  }, [runtime.cart.enabled, runtime.popup.steps, cart]);
  const close = useCallback(() => { setOpenState(null); setQuick(null); setTimeout(() => opener.current?.focus?.(), 0); }, []);
  const quickView = useCallback((id: string) => { const it = runtime.items.find((i) => i.id === id); if (!it) return; opener.current = (document.activeElement as HTMLElement) ?? null; setOpenState(null); setQuick(it); }, [runtime.items]);

  // every trigger on the page, whatever drew it
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const qv = t?.closest<HTMLElement>('[data-g4d-quickview]');
      if (qv) { e.preventDefault(); quickView(qv.getAttribute('data-g4d-quickview') ?? ''); return; }
      const a = t?.closest<HTMLElement>('[data-g4d-open],a[href="#enquiry"]');
      if (!a) return;
      e.preventDefault();
      const holder = a.closest<HTMLElement>('[data-g4d-item]');
      const itemId = a.getAttribute('data-g4d-item') || holder?.getAttribute('data-g4d-item') || undefined;
      open({ itemId: itemId || undefined, teamName: a.getAttribute('data-g4d-team') || undefined });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open, quickView]);

  // ?popup=1 opens it (the admin and the vendor preview use this to show the popup)
  useEffect(() => { if (new URLSearchParams(window.location.search).get('popup') === '1') { const t = setTimeout(() => setOpenState({}), 400); return () => clearTimeout(t); } return undefined; }, []);

  const value = useMemo<Ctx>(() => ({ runtime, open, close, quickView }), [runtime, open, close, quickView]);
  const vars = {
    '--sh-bg': 'var(--g4d-bg, var(--eng-bg, #ffffff))', '--sh-fg': 'var(--g4d-fg, var(--eng-fg, #111827))', '--sh-muted': 'var(--g4d-muted, var(--eng-muted, #4b5563))',
    '--sh-border': 'var(--g4d-border, var(--eng-border, #d1d5db))', '--sh-accent': 'var(--g4d-accent, var(--eng-accent, #0f766e))', '--sh-accent-fg': 'var(--g4d-accent-fg, var(--eng-accent-fg, #ffffff))',
    '--sh-surface': 'var(--g4d-surface, var(--eng-surface, #f3f4f6))', '--sh-radius': 'var(--g4d-radius, var(--eng-radius, 10px))',
  } as React.CSSProperties;
  return (
    <ShellCtx.Provider value={value}>
      <div style={{ ...vars, display: 'contents' }}>
        {children}
        {openState && <ActionPopup runtime={runtime} initial={openState} onClose={close} />}
        {quick && <QuickViewDialog item={quick} runtime={runtime} onClose={close} onOpenAction={() => { const id = quick.id; setQuick(null); setOpenState({ itemId: id }); }} />}
      </div>
    </ShellCtx.Provider>
  );
}

/** Dialog behaviour shared by the popup, the quick view and the More sheet: focus in, focus kept inside, Escape closes, page behind does not scroll (iOS included). */
export function useDialog(onClose: () => void): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    const y = window.scrollY;
    const html = document.documentElement; const body = document.body;
    const prev = { o: html.style.overflow, p: body.style.position, t: body.style.top, w: body.style.width };
    html.style.overflow = 'hidden'; body.style.position = 'fixed'; body.style.top = `-${y}px`; body.style.width = '100%';
    const first = root?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? root)?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !root) return;
      const els = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!els.length) { e.preventDefault(); return; }
      const a = els[0]; const z = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      html.style.overflow = prev.o; body.style.position = prev.p; body.style.top = prev.t; body.style.width = prev.w;
      window.scrollTo(0, y);
    };
  }, [onClose]);
  return ref;
}

export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useDialog(onClose);
  const id = useRef(`sh-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 md:items-center md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden bg-[var(--sh-bg)] text-[var(--sh-fg)] shadow-2xl outline-none md:max-h-[88vh] ${wide ? 'md:max-w-2xl' : 'md:max-w-lg'} rounded-t-2xl md:rounded-2xl`}>
        <div className="flex items-center justify-between border-b border-[var(--sh-border)] px-5 py-4">
          <h2 id={id} className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center text-[var(--sh-muted)] hover:text-[var(--sh-fg)]"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

function ActionPopup({ runtime, initial, onClose }: { runtime: ShellRuntime; initial: OpenOptions; onClose: () => void }) {
  const cart = useCart();
  const pre = initial.itemId ? runtime.items.find((i) => i.id === initial.itemId) : undefined;
  const [values, setValues] = useState<Values>(() => {
    const v: Values = { name: '', phone: '', email: '', message: initial.teamName ? `Booking with ${initial.teamName}.` : '' };
    for (const s of runtime.popup.steps) if (s.kind === 'choose' && s.source !== 'options' && pre) v[s.key] = pre.title;
    return v;
  });
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: string, v: string): void => setValues((x) => ({ ...x, [k]: v }));

  const steps = useMemo<PopupStep[]>(() => runtime.popup.steps.filter((s) => {
    if (s.showWhen && !s.showWhen.in.includes(values[s.showWhen.step] ?? '')) return false;
    if (s.kind === 'cart' && !cart.enabled) return false;                                   // no cart: the "choose" step takes its place
    if (s.kind === 'choose' && s.source !== 'options' && runtime.items.length === 0 && !s.options?.length) return false;
    return true;
  }), [runtime, values, cart.enabled]);
  const step = steps[Math.min(idx, steps.length - 1)];
  const last = idx >= steps.length - 1;

  const validate = (s: PopupStep): string => {
    const need = s.required;
    if (s.kind === 'choose' && need && !values[s.key]) return 'Please choose one to continue.';
    if (s.kind === 'mode' && !values[s.key]) return 'Please choose one to continue.';
    if (s.kind === 'when') { if (need && !values[`${s.key}.date`]) return 'Please pick a date.'; if (values[`${s.key}.date`] && values[`${s.key}.date`] < todayIso()) return 'That date has passed. Please pick today or a later date.'; if (s.options?.length && need && !values[`${s.key}.slot`]) return 'Please pick a time of day.'; }
    if (s.kind === 'dates') { const f = values[`${s.key}.from`]; const t = values[`${s.key}.to`]; if (need && (!f || !t)) return 'Please give both dates.'; if (f && f < todayIso()) return 'The start date has passed.'; if (f && t && t < f) return 'The end date is before the start date.'; }
    if (s.kind === 'count') { const n = Number(values[s.key]); if (need && (!Number.isInteger(n) || n < 1 || n > 99)) return 'Please enter a number from 1 to 99.'; }
    if (s.kind === 'details') {
      if (values.name.trim().length < 2) return 'Please enter your name.';
      if (!/^(\+?91)?[6-9]\d{9}$/.test(values.phone.replace(/[\s-]/g, ''))) return 'Please enter a 10-digit mobile number we can call.';
      if (runtime.popup.email === 'required' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return 'Please enter a valid e-mail address.';
      if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return 'That e-mail address does not look right.';
      if (runtime.popup.message === 'required' && !values.message.trim()) return 'Please add a short message.';
    }
    return '';
  };

  const summary = (): { lines: [string, string][]; date?: string } => {
    const lines: [string, string][] = []; let date: string | undefined;
    for (const s of steps) {
      if (s.kind === 'choose' || s.kind === 'mode') { if (values[s.key]) lines.push([s.label.replace(/\?$/, ''), values[s.key]]); }
      else if (s.kind === 'when') { const d = values[`${s.key}.date`]; if (d || values[`${s.key}.slot`]) { lines.push([s.label.replace(/^Pick a /, ''), [d, values[`${s.key}.slot`]].filter(Boolean).join(', ')]); if (d) date = d; } }
      else if (s.kind === 'dates') { if (values[`${s.key}.from`]) { lines.push([s.label, `${values[`${s.key}.from`]} to ${values[`${s.key}.to`]}`]); date = values[`${s.key}.from`]; } }
      else if (s.kind === 'count') { if (values[s.key]) lines.push([s.label.replace(/^Number of /, ''), values[s.key]]); }
    }
    return { lines, date };
  };
  const compose = (): string => {
    const { lines } = summary();
    const parts = [`${runtime.popup.title}`, ...lines.map(([k, v]) => `${k}: ${v}`)];
    if (values.email.trim()) parts.push(`E-mail: ${values.email.trim()}`);
    if (values.message.trim()) parts.push(`Message: ${values.message.trim()}`);
    return parts.join(' | ').slice(0, 1900);
  };

  const next = (): void => { const e = validate(step); if (e) { setError(e); return; } setError(''); setIdx((i) => Math.min(i + 1, steps.length - 1)); };
  const submit = async (): Promise<void> => {
    for (const s of steps) { const e = validate(s); if (e) { setError(e); setIdx(steps.indexOf(s)); return; } }
    setError(''); setBusy(true);
    try {
      if (runtime.mode === 'live') await api.engineDispatchPublic(runtime.subdomain, 'engine.enquiry', { name: values.name.trim(), phone: values.phone.replace(/[\s-]/g, ''), message: compose(), industry: runtime.family });
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please call or message us instead.'); }
    finally { setBusy(false); }
  };

  const wa = runtime.business.whatsapp ? `https://wa.me/${runtime.business.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${runtime.business.name}, ${compose()}`.slice(0, 600))}` : '';
  const sum = summary();

  return (
    <Sheet title={done ? 'Request sent' : runtime.popup.title} onClose={onClose}>
      {done ? (
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sh-surface)]"><Check className="h-7 w-7 text-[var(--sh-accent)]" /></span>
          <p className="mt-4">{runtime.popup.confirm}</p>
          {runtime.mode !== 'live' && <p className="mt-2 text-xs text-[var(--sh-muted)]">This is a preview: nothing was sent.</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {runtime.business.phone && <a href={`tel:${runtime.business.phone}`} className={btnGhost} style={radius}><Phone className="h-4 w-4" />Call us</a>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={btnGhost} style={radius}><MessageCircle className="h-4 w-4" />WhatsApp</a>}
            {sum.date && <button type="button" className={btnGhost} style={radius} onClick={() => { const blob = new Blob([icsFor(`${runtime.business.name}: ${runtime.popup.title}`, sum.date as string, compose())], { type: 'text/calendar' }); const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'appointment.ics'; a.click(); URL.revokeObjectURL(u); }}><CalendarPlus className="h-4 w-4" />Add to calendar</button>}
          </div>
          <button type="button" className={`${btnPrimary} mt-5 w-full`} style={radius} onClick={onClose}>Close</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (last) void submit(); else next(); }} noValidate>
          <ol className="mb-5 flex gap-1.5" aria-label={`Step ${Math.min(idx, steps.length - 1) + 1} of ${steps.length}`}>{steps.map((s, i) => <li key={s.key} className={`h-1 flex-1 ${i <= idx ? 'bg-[var(--sh-accent)]' : 'bg-[var(--sh-border)]'}`} />)}</ol>
          {step.kind !== 'confirm' && <p className="mb-4 text-base font-semibold">{step.label}</p>}
          {(step.kind === 'choose') && (
            step.source === 'options' || (!runtime.items.length && step.options?.length)
              ? <div className="grid gap-2" role="radiogroup" aria-label={step.label}>{(step.options ?? []).map((o) => <label key={o} className={`flex min-h-[44px] cursor-pointer items-center gap-3 border px-4 py-2.5 text-sm ${values[step.key] === o ? 'border-[var(--sh-accent)] bg-[var(--sh-surface)]' : 'border-[var(--sh-border)]'}`} style={radius}><input type="radio" name={step.key} checked={values[step.key] === o} onChange={() => set(step.key, o)} className="accent-[var(--sh-accent)]" />{o}</label>)}</div>
              : <div className="grid max-h-[46vh] gap-2 overflow-y-auto" role="radiogroup" aria-label={step.label}>{runtime.items.map((it) => <label key={it.id} className={`flex min-h-[44px] cursor-pointer items-center gap-3 border px-4 py-2.5 text-sm ${values[step.key] === it.title ? 'border-[var(--sh-accent)] bg-[var(--sh-surface)]' : 'border-[var(--sh-border)]'}`} style={radius}><input type="radio" name={step.key} checked={values[step.key] === it.title} onChange={() => set(step.key, it.title)} className="accent-[var(--sh-accent)]" /><span className="flex-1">{it.title}</span>{it.price && <span className="text-xs text-[var(--sh-muted)]">{it.price}</span>}</label>)}</div>
          )}
          {step.kind === 'mode' && <div className="grid gap-2" role="radiogroup" aria-label={step.label}>{(step.options ?? []).map((o) => <label key={o} className={`flex min-h-[44px] cursor-pointer items-center gap-3 border px-4 py-2.5 text-sm ${values[step.key] === o ? 'border-[var(--sh-accent)] bg-[var(--sh-surface)]' : 'border-[var(--sh-border)]'}`} style={radius}><input type="radio" name={step.key} checked={values[step.key] === o} onChange={() => set(step.key, o)} className="accent-[var(--sh-accent)]" />{o}</label>)}</div>}
          {step.kind === 'when' && (
            <div className="grid gap-3">
              <div><label htmlFor={`${step.key}-d`} className={label}>Date</label><input id={`${step.key}-d`} type="date" min={todayIso()} className={field} style={radius} value={values[`${step.key}.date`] ?? ''} onChange={(e) => set(`${step.key}.date`, e.target.value)} /></div>
              {step.options && step.options.length > 0 && <div><label htmlFor={`${step.key}-s`} className={label}>Time of day</label><select id={`${step.key}-s`} className={field} style={radius} value={values[`${step.key}.slot`] ?? ''} onChange={(e) => set(`${step.key}.slot`, e.target.value)}><option value="">Choose</option>{step.options.map((o) => <option key={o}>{o}</option>)}</select></div>}
            </div>
          )}
          {step.kind === 'dates' && <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor={`${step.key}-f`} className={label}>From</label><input id={`${step.key}-f`} type="date" min={todayIso()} className={field} style={radius} value={values[`${step.key}.from`] ?? ''} onChange={(e) => set(`${step.key}.from`, e.target.value)} /></div><div><label htmlFor={`${step.key}-t`} className={label}>To</label><input id={`${step.key}-t`} type="date" min={values[`${step.key}.from`] || todayIso()} className={field} style={radius} value={values[`${step.key}.to`] ?? ''} onChange={(e) => set(`${step.key}.to`, e.target.value)} /></div></div>}
          {step.kind === 'count' && <div><label htmlFor={`${step.key}-n`} className={label}>{step.label}</label><input id={`${step.key}-n`} type="number" inputMode="numeric" min={1} max={99} className={field} style={radius} value={values[step.key] ?? ''} onChange={(e) => set(step.key, e.target.value)} /></div>}
          {step.kind === 'details' && (
            <div className="grid gap-3">
              <div><label htmlFor="sh-name" className={label}>Your name</label><input id="sh-name" autoComplete="name" className={field} style={radius} value={values.name} onChange={(e) => set('name', e.target.value)} /></div>
              <div><label htmlFor="sh-phone" className={label}>Mobile number</label><input id="sh-phone" type="tel" inputMode="tel" autoComplete="tel" className={field} style={radius} value={values.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10-digit mobile" /></div>
              {runtime.popup.email !== 'hidden' && <div><label htmlFor="sh-email" className={label}>E-mail{runtime.popup.email === 'optional' ? ' (optional)' : ''}</label><input id="sh-email" type="email" autoComplete="email" className={field} style={radius} value={values.email} onChange={(e) => set('email', e.target.value)} /></div>}
              {runtime.popup.message !== 'hidden' && <div><label htmlFor="sh-msg" className={label}>Message{runtime.popup.message === 'optional' ? ' (optional)' : ''}</label><textarea id="sh-msg" rows={3} className={field} style={radius} value={values.message} onChange={(e) => set('message', e.target.value)} /></div>}
            </div>
          )}
          {step.kind === 'confirm' && (
            <div>
              <p className="mb-3 text-base font-semibold">Please check and send</p>
              <dl className="divide-y divide-[var(--sh-border)] border border-[var(--sh-border)] text-sm" style={radius}>
                {sum.lines.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-[var(--sh-muted)]">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
                <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-[var(--sh-muted)]">Name</dt><dd className="font-medium">{values.name}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-[var(--sh-muted)]">Mobile</dt><dd className="font-medium">{values.phone}</dd></div>
              </dl>
            </div>
          )}
          {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex gap-3">
            {idx > 0 && <button type="button" className={btnGhost} style={radius} onClick={() => { setError(''); setIdx((i) => Math.max(0, i - 1)); }}>Back</button>}
            <button type="submit" disabled={busy} className={`${btnPrimary} flex-1`} style={radius}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{last ? 'Send request' : 'Continue'}</button>
          </div>
          <p className="mt-3 text-center text-[11px] text-[var(--sh-muted)]">Your details go straight to {runtime.business.name || 'the business'}. No spam.</p>
        </form>
      )}
    </Sheet>
  );
}

function QuickViewDialog({ item, runtime, onClose, onOpenAction }: { item: ShellItem; runtime: ShellRuntime; onClose: () => void; onOpenAction: () => void }) {
  const cart = useCart();
  const priceNum = parseFloat((item.price ?? '').replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return (
    <Sheet title={item.title} onClose={onClose}>
      {item.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.image} alt={item.title} className="mb-4 aspect-[4/3] w-full object-cover" style={radius} />}
      {item.category && <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sh-muted)]">{item.category}</p>}
      {item.description && <p className="mt-2 text-sm text-[var(--sh-muted)]">{item.description}</p>}
      {item.price && <p className="mt-3 text-lg font-semibold text-[var(--sh-accent)]">{item.price}</p>}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {cart.enabled && Number.isFinite(priceNum) && priceNum > 0 && <button type="button" className={btnPrimary} style={radius} onClick={() => { cart.add({ name: item.title, price: priceNum, productId: item.id }); onClose(); }}>Add to cart</button>}
        <button type="button" className={cart.enabled && priceNum > 0 ? btnGhost : btnPrimary} style={radius} onClick={onOpenAction}>{runtime.primaryLabel}</button>
      </div>
    </Sheet>
  );
}
