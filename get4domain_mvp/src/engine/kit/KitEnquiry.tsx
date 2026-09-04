'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, ShieldCheck, MessageSquare, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import type { EngineMode } from '@/engine/types';
import type { EnquiryTab } from './model';
import { iconFor } from './sections';

const waHref = (num: string | undefined, text: string): string | null =>
  num ? `https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : null;

/**
 * Generalized conversion block for kit industries. Same three-mode behaviour as the
 * Real Estate reference: live → generic `engine.enquiry` into the vendor CRM (real
 * backend); demo → real demo lead (TeleCRM) prefilled from the OTP-gate identity;
 * preview → simulated. The tabs (appointment / order / enquiry / quote …) and fields
 * are declared per-industry, so each site converts in its own language.
 */
export default function KitEnquiry({ mode, brand, choices, choiceLabel, eyebrow, title, sub, points, tabs }: {
  mode: EngineMode;
  brand: { name: string; phone?: string; whatsapp?: string };
  choices: string[];
  choiceLabel: string;
  eyebrow: string; title: string; sub: string; points?: string[];
  tabs: EnquiryTab[];
}) {
  const [active, setActive] = useState(0);
  const tab = tabs[active] ?? tabs[0];
  const [form, setForm] = useState({ name: '', phone: '', choice: choices[0] ?? '', date: '', message: '', amount: 1000 });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode.kind !== 'demo') return;
    try {
      const name = sessionStorage.getItem('g4d_demo_name') ?? '';
      const phone = sessionStorage.getItem('g4d_demo_phone') ?? '';
      if (name || phone) setForm((f) => ({ ...f, name: f.name || name, phone: f.phone || phone }));
    } catch { /* ignore */ }
  }, [mode.kind]);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const has = (f: string) => tab.fields.includes(f as 'date' | 'message' | 'amount' | 'choice');

  const composed = (): string => {
    const bits = [tab.label];
    if (has('choice') && form.choice) bits.push(`${choiceLabel}: ${form.choice}`);
    if (has('date') && form.date) bits.push(`Preferred: ${new Date(form.date).toLocaleString('en-IN')}`);
    if (has('amount') && form.amount) bits.push(`Amount: ₹${Number(form.amount).toLocaleString('en-IN')}`);
    if (has('message') && form.message) bits.push(form.message);
    return bits.join(' — ');
  };

  async function submit() {
    setError(null);
    if (!form.name.trim() || !form.phone.trim()) { setError('Please add your name and phone number.'); return; }
    if (mode.kind === 'preview') { setDone('Preview mode — on a live site this reaches the business instantly.'); return; }
    setBusy(true);
    try {
      if (mode.kind === 'demo') {
        await api.demoEnquiry({ name: form.name, phone: form.phone, industry: mode.category, message: composed() });
      } else {
        await api.engineDispatchPublic(mode.subdomain, 'engine.enquiry', { name: form.name, phone: form.phone, message: composed() });
      }
      setDone(mode.kind === 'demo'
        ? 'Thanks! Your interest is logged — on your own site this reaches you instantly by WhatsApp, SMS and email.'
        : 'Thank you — your request has reached the team. Expect a call back shortly.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try WhatsApp or call us.');
    } finally { setBusy(false); }
  }

  const wa = waHref(brand.whatsapp, `Hi ${brand.name}, I'm interested. Please share details.`);

  return (
    <section id="enquiry" className="scroll-mt-20 bg-[var(--eng-surface)] px-5 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--eng-accent)]">{eyebrow}</p>
          <h2 className="mt-3 font-[family-name:var(--eng-fontDisplay)] text-3xl leading-tight md:text-5xl">{title}</h2>
          <p className="mt-5 max-w-md text-[var(--eng-muted)]">{sub}</p>
          {points && (
            <ul className="mt-8 space-y-3 text-sm">
              {points.map((t) => <li key={t} className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-[var(--eng-accent)]" /> {t}</li>)}
            </ul>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-[var(--eng-border)] px-4 py-2.5 text-sm hover:border-[var(--eng-accent)]"><MessageSquare className="h-4 w-4" /> WhatsApp us</a>}
            {brand.phone && <a href={`tel:${brand.phone}`} className="inline-flex items-center gap-2 border border-[var(--eng-border)] px-4 py-2.5 text-sm hover:border-[var(--eng-accent)]"><Phone className="h-4 w-4" /> {brand.phone}</a>}
          </div>
        </div>

        <div className="border border-[var(--eng-border)] bg-[var(--eng-bg)] p-6 md:p-8" style={{ borderRadius: 'var(--eng-radius)' }}>
          {done ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--eng-accent)]/15"><Check className="h-7 w-7 text-[var(--eng-accent)]" /></span>
              <p className="max-w-xs text-[var(--eng-fg)]">{done}</p>
              <button onClick={() => { setDone(null); setForm((f) => ({ ...f, message: '' })); }} className="mt-6 text-sm text-[var(--eng-accent)] underline underline-offset-4">Send another</button>
            </div>
          ) : (
            <>
              {tabs.length > 1 && (
                <div className={`mb-6 grid gap-1 border border-[var(--eng-border)] p-1`} style={{ gridTemplateColumns: `repeat(${tabs.length},minmax(0,1fr))`, borderRadius: 'var(--eng-radius)' }}>
                  {tabs.map((t, i) => {
                    const Icon = iconFor(t.icon);
                    return (
                      <button key={t.key} onClick={() => setActive(i)}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors ${active === i ? 'bg-[var(--eng-accent)] text-[var(--eng-accent-fg)]' : 'text-[var(--eng-muted)] hover:text-[var(--eng-fg)]'}`}
                        style={{ borderRadius: 'calc(var(--eng-radius) - 1px)' }}>
                        <Icon className="h-4 w-4" /> {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="space-y-3">
                <Field label="Your name"><input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="Full name" /></Field>
                <Field label="Phone"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="10-digit mobile" inputMode="tel" /></Field>
                {has('choice') && choices.length > 0 && (
                  <Field label={choiceLabel}>
                    <select value={form.choice} onChange={(e) => set('choice', e.target.value)} className={inputCls}>
                      {choices.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="">Not sure yet</option>
                    </select>
                  </Field>
                )}
                {has('date') && <Field label="Preferred date & time"><input type="datetime-local" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} /></Field>}
                {has('amount') && <Field label="Amount (₹)"><input type="number" min={100} value={form.amount} onChange={(e) => set('amount', Number(e.target.value))} className={inputCls} /></Field>}
                {has('message') && <Field label="Message (optional)"><textarea value={form.message} onChange={(e) => set('message', e.target.value)} rows={3} className={inputCls} placeholder="Tell us what you need…" /></Field>}
              </div>
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              <button onClick={submit} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 bg-[var(--eng-accent)] py-3.5 text-sm font-semibold text-[var(--eng-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60" style={{ borderRadius: 'var(--eng-radius)' }}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tab.submitLabel}
              </button>
              <p className="mt-3 text-center text-[11px] text-[var(--eng-muted)]">
                {mode.kind === 'preview' ? 'Preview — submissions are disabled on the demo.'
                  : mode.kind === 'demo' ? 'This is a live demo — your details are logged as a real enquiry.'
                  : 'Your details go straight to the business. No spam.'}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const inputCls = 'w-full border border-[var(--eng-border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--eng-fg)] outline-none placeholder:text-[var(--eng-muted)]/70 focus:border-[var(--eng-accent)]';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--eng-muted)]">{label}</span>{children}</label>;
}
