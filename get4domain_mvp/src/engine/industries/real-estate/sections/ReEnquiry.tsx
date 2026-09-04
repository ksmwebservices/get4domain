'use client';

import { useState } from 'react';
import { CalendarCheck, MessageSquare, IndianRupee, Phone, Check, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

type Mode = 'visit' | 'enquiry' | 'token';

interface RazorpayOptions {
  key: string; amount: number; currency: string; order_id: string;
  name: string; description?: string; prefill?: { name?: string; contact?: string };
  theme?: { color?: string }; handler?: (r: unknown) => void; modal?: { ondismiss?: () => void };
}
interface RazorpayInstance { open: () => void }
type RazorpayCtor = new (o: RazorpayOptions) => RazorpayInstance;

// Access window.Razorpay via a local cast rather than a global augmentation — the
// billing page already declares Window.Razorpay, and re-declaring it here would
// conflict on modifiers/type during declaration merging.
const getRazorpay = (): RazorpayCtor | undefined =>
  (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (getRazorpay()) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const waHref = (num: string | undefined, text: string): string | null =>
  num ? `https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : null;

/**
 * The revenue-ready conversion block. Three real actions, all dispatched into the
 * backend Action Registry's PUBLIC surface (vendorId resolved server-side from the
 * subdomain): site-visit booking, property enquiry, and a booking-token payment
 * (Razorpay). WhatsApp is the no-API fallback. In preview mode submissions are
 * simulated so the demo never writes real leads.
 */
export default function ReEnquiry({
  subdomain, brand, projects, preview = false,
}: {
  subdomain: string;
  brand: { name: string; phone?: string; whatsapp?: string };
  projects: { id: string; name: string }[];
  preview?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('visit');
  const [form, setForm] = useState({ name: '', phone: '', property: projects[0]?.name ?? '', date: '', message: '', amount: 25000 });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError(null);
    if (!form.name.trim() || !form.phone.trim()) { setError('Please add your name and phone number.'); return; }
    if (mode === 'visit' && !form.date) { setError('Please pick a date and time for the visit.'); return; }
    if (preview) { setDone(`Preview mode — this ${mode === 'token' ? 'payment' : 'enquiry'} was not sent. On a live site it reaches the developer instantly.`); return; }
    setBusy(true);
    try {
      if (mode === 'visit') {
        await api.engineDispatchPublic(subdomain, 'realestate.site_visit', {
          clientName: form.name, clientPhone: form.phone,
          scheduledAt: new Date(form.date).toISOString(),
          notes: form.property ? `Interested in: ${form.property}` : undefined,
        });
        setDone('Your site visit is booked. The developer will confirm shortly.');
      } else if (mode === 'enquiry') {
        await api.engineDispatchPublic(subdomain, 'realestate.enquiry', {
          clientName: form.name, clientPhone: form.phone,
          notes: [form.property && `Property: ${form.property}`, form.message].filter(Boolean).join(' — ') || undefined,
        });
        setDone('Thank you — your enquiry has reached the developer. Expect a callback soon.');
      } else {
        const res = await api.engineDispatchPublic(subdomain, 'realestate.payment_cta', {
          clientName: form.name, clientPhone: form.phone, propertyRef: form.property, amount: Number(form.amount),
        }) as { data?: PaymentResult } & PaymentResult;
        const r = (res.data ?? res) as PaymentResult;
        if (r.order && r.keyId) {
          const ok = await loadRazorpay();
          const Rzp = getRazorpay();
          if (!ok || !Rzp) { setDone('We\'ve saved your interest — our team will share a secure payment link shortly.'); return; }
          const rzp = new Rzp({
            key: r.keyId, amount: r.order.amount, currency: r.order.currency, order_id: r.order.id,
            name: brand.name, description: `Booking token — ${form.property || 'property'}`,
            prefill: { name: form.name, contact: form.phone }, theme: { color: '#C9A24B' },
            handler: () => setDone('Payment received. The developer will confirm your booking and next steps.'),
            modal: { ondismiss: () => setBusy(false) },
          });
          rzp.open();
          return;
        }
        setDone('We\'ve saved your interest — online payment isn\'t enabled yet, so our team will call you with a secure link.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try WhatsApp or call us.');
    } finally {
      setBusy(false);
    }
  }

  interface PaymentResult { dealId: string; order: { id: string; amount: number; currency: string } | null; keyId: string | null; paymentError?: string }

  const tabs: { id: Mode; label: string; icon: typeof CalendarCheck }[] = [
    { id: 'visit', label: 'Book a site visit', icon: CalendarCheck },
    { id: 'enquiry', label: 'Request details', icon: MessageSquare },
    { id: 'token', label: 'Pay booking token', icon: IndianRupee },
  ];

  const wa = waHref(brand.whatsapp, `Hi ${brand.name}, I'm interested in ${form.property || 'a property'}. Please share details.`);

  return (
    <section id="enquiry" className="scroll-mt-20 bg-[var(--eng-surface)] px-5 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        {/* Left: intent + trust */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--eng-accent)]">Start here</p>
          <h2 className="mt-3 font-[family-name:var(--eng-fontDisplay)] text-3xl leading-tight md:text-5xl">
            Walk the property<br />before you decide.
          </h2>
          <p className="mt-5 max-w-md text-[var(--eng-muted)]">
            Book a free site visit at a time that suits you, ask for the full price breakup, or block your unit with a
            refundable booking token. A relationship manager handles the rest.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {['RERA-registered projects only', 'Transparent, all-in pricing', 'No brokerage — direct from the developer'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-[var(--eng-accent)]" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-[var(--eng-border)] px-4 py-2.5 text-sm hover:border-[var(--eng-accent)]">
                <MessageSquare className="h-4 w-4" /> WhatsApp us
              </a>
            )}
            {brand.phone && (
              <a href={`tel:${brand.phone}`} className="inline-flex items-center gap-2 border border-[var(--eng-border)] px-4 py-2.5 text-sm hover:border-[var(--eng-accent)]">
                <Phone className="h-4 w-4" /> {brand.phone}
              </a>
            )}
          </div>
        </div>

        {/* Right: the form */}
        <div className="border border-[var(--eng-border)] bg-[var(--eng-bg)] p-6 md:p-8" style={{ borderRadius: 'var(--eng-radius)' }}>
          {done ? (
            <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--eng-accent)]/15">
                <Check className="h-7 w-7 text-[var(--eng-accent)]" />
              </span>
              <p className="max-w-xs text-[var(--eng-fg)]">{done}</p>
              <button onClick={() => { setDone(null); setForm((f) => ({ ...f, message: '' })); }}
                className="mt-6 text-sm text-[var(--eng-accent)] underline underline-offset-4">Send another</button>
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-3 gap-1 border border-[var(--eng-border)] p-1" style={{ borderRadius: 'var(--eng-radius)' }}>
                {tabs.map((t) => (
                  <button key={t.id} onClick={() => setMode(t.id)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors ${mode === t.id ? 'bg-[var(--eng-accent)] text-[var(--eng-accent-fg)]' : 'text-[var(--eng-muted)] hover:text-[var(--eng-fg)]'}`}
                    style={{ borderRadius: 'calc(var(--eng-radius) - 1px)' }}>
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <Field label="Your name"><input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="Full name" /></Field>
                <Field label="Phone"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="10-digit mobile" inputMode="tel" /></Field>
                {projects.length > 0 && (
                  <Field label="Property of interest">
                    <select value={form.property} onChange={(e) => set('property', e.target.value)} className={inputCls}>
                      {projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                      <option value="">Not sure yet</option>
                    </select>
                  </Field>
                )}
                {mode === 'visit' && (
                  <Field label="Preferred date & time"><input type="datetime-local" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} /></Field>
                )}
                {mode === 'enquiry' && (
                  <Field label="Message (optional)"><textarea value={form.message} onChange={(e) => set('message', e.target.value)} rows={3} className={inputCls} placeholder="Budget, configuration, timeline…" /></Field>
                )}
                {mode === 'token' && (
                  <Field label="Booking token amount (₹)">
                    <input type="number" min={100} max={500000} value={form.amount} onChange={(e) => set('amount', Number(e.target.value))} className={inputCls} />
                    <p className="mt-1 text-[11px] text-[var(--eng-muted)]">Refundable. You&apos;ll pay securely via Razorpay; the developer confirms your unit.</p>
                  </Field>
                )}
              </div>

              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

              <button onClick={submit} disabled={busy}
                className="mt-6 flex w-full items-center justify-center gap-2 bg-[var(--eng-accent)] py-3.5 text-sm font-semibold text-[var(--eng-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ borderRadius: 'var(--eng-radius)' }}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'visit' ? 'Book my site visit' : mode === 'enquiry' ? 'Send enquiry' : `Pay ₹${Number(form.amount).toLocaleString('en-IN')} token`}
              </button>
              <p className="mt-3 text-center text-[11px] text-[var(--eng-muted)]">
                {preview ? 'Preview — submissions are disabled on the demo.' : 'Your details go straight to the developer. No spam.'}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const inputCls =
  'w-full border border-[var(--eng-border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--eng-fg)] outline-none placeholder:text-[var(--eng-muted)]/70 focus:border-[var(--eng-accent)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--eng-muted)]">{label}</span>
      {children}
    </label>
  );
}
