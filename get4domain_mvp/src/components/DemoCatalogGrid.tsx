'use client';

import { useState } from 'react';
import { Loader2, X, Check, MessageCircle, CalendarDays, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { DATED_FLOWS, type CategoryCatalog, type DemoListing } from '@/data/demo-catalog';

interface Props {
  catalog: CategoryCatalog;
  business: string;
  industryLabel: string;
  coverImage: string;
  /** Show only the first N items (used for the home-page preview). */
  limit?: number;
}

/**
 * Rich, industry-specific listing grid + a flow-aware booking/enquiry modal.
 * Every category reuses this SAME component (one consistent theme); only the data,
 * fields and CTA label differ. The modal funnels into the existing demo-enquiry
 * lead capture (api.demoEnquiry) — every card is a lead path, not a dead end.
 */
export default function DemoCatalogGrid({ catalog, business, industryLabel, coverImage, limit }: Props) {
  const [active, setActive] = useState<DemoListing | null>(null);
  const items = limit ? catalog.items.slice(0, limit) : catalog.items;
  const dated = DATED_FLOWS.includes(catalog.flow);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.name} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image ?? coverImage} alt={item.name} className="h-40 w-full object-cover" />
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold leading-snug text-slate-900">{item.name}</h3>
                {item.price && <span className="whitespace-nowrap text-sm font-bold text-primary-600">{item.price}</span>}
              </div>
              {item.desc && <p className="mt-1 text-sm text-slate-500">{item.desc}</p>}
              {item.fields && item.fields.length > 0 && (
                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {item.fields.map((f) => (
                    <div key={f.label} className="text-xs">
                      <dt className="inline text-slate-400">{f.label}: </dt>
                      <dd className="inline font-semibold text-slate-700">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.tags.map((t) => (
                    <span key={t} className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">{t}</span>
                  ))}
                </div>
              )}
              <button onClick={() => setActive(item)}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                {catalog.ctaLabel} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {active && (
        <BookingModal
          item={active} catalog={catalog} business={business}
          industryLabel={industryLabel} dated={dated} onClose={() => setActive(null)}
        />
      )}
    </>
  );
}

function BookingModal({
  item, catalog, business, industryLabel, dated, onClose,
}: {
  item: DemoListing; catalog: CategoryCatalog; business: string;
  industryLabel: string; dated: boolean; onClose: () => void;
}) {
  const [form, setForm] = useState({ name: '', phone: '', date: '', slot: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const summary = `${catalog.ctaLabel}: ${item.name}${item.price ? ` (${item.price})` : ''}`
    + (dated && form.date ? ` · Preferred ${form.date}${form.slot ? ` ${form.slot}` : ''}` : '')
    + (form.message ? ` · ${form.message}` : '');
  const waText = encodeURIComponent(`Hi ${business}, I'm interested in "${item.name}"${item.price ? ` (${item.price})` : ''}. Please share details.`);

  const submit = async () => {
    setErr(''); setSending(true);
    try {
      await api.demoEnquiry({ name: form.name, phone: form.phone, industry: industryLabel, message: summary });
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send — please try again.');
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{catalog.ctaLabel}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{item.name}{item.price ? ` · ${item.price}` : ''}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {sent ? (
          <div className="mt-5 rounded-2xl border border-success-200 bg-success-50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-100"><Check className="h-6 w-6 text-success-600" /></div>
            <p className="font-semibold text-slate-900">Thanks, {form.name.split(' ')[0] || 'there'}!</p>
            <p className="mt-1 text-sm text-slate-600">{business} has your request for <span className="font-medium">{item.name}</span> and will confirm on WhatsApp shortly.</p>
            <button onClick={onClose} className="mt-4 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700">Done</button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <input type="text" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <input type="tel" inputMode="numeric" placeholder="Mobile number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            {dated && (
              <div className="grid grid-cols-2 gap-3">
                <label className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-2 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </label>
                <select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                  <option value="">Any time</option>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Evening</option>
                </select>
              </div>
            )}
            <textarea rows={2} placeholder="Anything specific? (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            {err && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700">{err}</div>}
            <button onClick={submit} disabled={sending || !form.name.trim() || form.phone.replace(/\D/g, '').length < 10}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {catalog.ctaLabel}
            </button>
            <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-success-500 px-4 py-2.5 text-sm font-bold text-success-600 hover:bg-success-50">
              <MessageCircle className="h-4 w-4" /> Ask on WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
