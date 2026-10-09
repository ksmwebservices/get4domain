'use client';

import { useState } from 'react';
import { useLoad } from '@/bos/client';
import { Btn, Msg, Pill, Spin, Table, adm, card, field, rs, useAct, when } from './ui';

interface Rule { id: string; eventType: string; category: string | null; city: string | null; pricePaise: number; effectiveFrom: string; effectiveTo: string | null; createdBy: string | null; note: string | null }
type Settings = Record<string, unknown>;

const TYPES: [string, string][] = [['ENQUIRY', 'Enquiry'], ['BOOKING', 'Booking'], ['APPOINTMENT', 'Appointment'], ['SITE_VISIT', 'Site visit'], ['CART_ORDER', 'Cart order']];
const SETTING_HELP: Record<string, string> = {
  dedupeWindowHours: 'Hours: the same customer asking again for the same thing is one lead, not charged twice',
  autoCreditWindowHours: 'Hours: a repeat after the dedupe window but inside this window is captured and not charged',
  disputeWindowHours: 'Hours a vendor has to report a lead as not valid',
  otpTtlMinutes: 'Minutes a customer code stays valid', otpMaxAttempts: 'Wrong guesses before a code is burned',
  otpPerPhonePerHour: 'Codes per phone number per hour', otpPerDevicePerHour: 'Codes per device per hour', otpPerIpPerHour: 'Codes per network per hour',
  lowBalanceThresholdsPaise: 'Low-balance alert levels in paise, highest first', marginFloorPercent: 'Margin alert floor (percent, after GST)', gstPercent: 'GST percent',
  refundWindowMonths: 'Months a refill can be refunded', expiryMonths: 'Months of no activity before balance expires', pagesPerIpPerDay: 'New pages one network may make a day',
  manualApprovalDays: 'Days a new vendor’s promotion posts need approval', vendorSpamOtpPerDay: 'Unused codes a vendor page may send a day before it is cut off',
  refillCustomMinPaise: 'Smallest custom refill (paise)', refillCustomMaxPaise: 'Largest custom refill (paise)', customCreditPercent: 'Percent of a custom refill that is credited', customGstMode: 'INCLUSIVE or EXCLUSIVE',
  upgradeLeadThreshold: 'Leads in 30 days before a vendor is offered a plan with customers and invoices', globalKillSwitch: 'Stops all posting for everyone',
};

/** The price table with history, and every LeadSpace rule as a setting. Money screen: not offered to MARKETING staff. */
export default function PricesTab() {
  const rules = useLoad(() => adm<Rule[]>('/admin/leadspace/prices'), []);
  const settings = useLoad(() => adm<Settings>('/admin/leadspace/settings'), []);
  const { msg, busy, act } = useAct(() => { rules.reload(); settings.reload(); });
  const [f, setF] = useState({ eventType: 'ENQUIRY', category: '', city: '', rupees: '', note: '' });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const live = (rules.data ?? []).filter((r) => !r.effectiveTo);
  const past = (rules.data ?? []).filter((r) => r.effectiveTo);

  return (
    <div className="space-y-6">
      {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Price per verified event</h3>
        <p className="text-xs text-slate-400">A city and trade price wins over a trade price, which wins over the global price. A change ends the old price now and starts the new one now; nothing is ever edited, so history is exact and earlier leads keep the price they were quoted.</p>
        <div className={`${card} grid gap-2 sm:grid-cols-6`}>
          <select className={field} value={f.eventType} onChange={(e) => setF({ ...f, eventType: e.target.value })} aria-label="Event">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input className={field} placeholder="Trade (blank = all)" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Trade" autoComplete="off" />
          <input className={field} placeholder="City (blank = all)" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} aria-label="City" autoComplete="off" />
          <input className={field} placeholder="Price in rupees" inputMode="decimal" value={f.rupees} onChange={(e) => setF({ ...f, rupees: e.target.value.replace(/[^\d.]/g, '') })} aria-label="Price in rupees" autoComplete="off" />
          <input className={field} placeholder="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} aria-label="Note" autoComplete="off" />
          <Btn busy={busy === 'price'} disabled={!f.rupees} onClick={() => act('price', async () => { await adm('/admin/leadspace/prices', { method: 'POST', body: { eventType: f.eventType, ...(f.category.trim() ? { category: f.category.trim() } : {}), ...(f.city.trim() ? { city: f.city.trim() } : {}), pricePaise: Math.round(Number(f.rupees) * 100), ...(f.note.trim() ? { note: f.note.trim() } : {}) } }); setF({ ...f, rupees: '', note: '' }); }, 'Price saved.')}>Set price</Btn>
        </div>
        {rules.loading && !rules.data ? <Spin /> : (
          <Table head={['Event', 'Trade', 'City', 'Price', 'From', 'By']} empty={live.length === 0 ? 'No price set yet. Verified events are delivered free until you set one.' : undefined}>
            {live.map((r) => <tr key={r.id}><td className="px-3 py-2">{TYPES.find(([v]) => v === r.eventType)?.[1]}</td><td className="px-3 py-2">{r.category ?? <span className="text-slate-500">all</span>}</td><td className="px-3 py-2">{r.city ?? <span className="text-slate-500">all</span>}</td><td className="px-3 py-2 font-semibold text-white">{rs(r.pricePaise)}</td><td className="px-3 py-2 text-xs text-slate-400">{when(r.effectiveFrom)}</td><td className="px-3 py-2 text-xs text-slate-400">{r.createdBy ?? ''}{r.note ? ` · ${r.note}` : ''}</td></tr>)}
          </Table>
        )}
        <details className="text-sm text-slate-300"><summary className="cursor-pointer text-xs text-slate-400">Price history ({past.length} earlier prices)</summary>
          <Table head={['Event', 'Trade', 'City', 'Price', 'From', 'Until']}>
            {past.map((r) => <tr key={r.id}><td className="px-3 py-2">{TYPES.find(([v]) => v === r.eventType)?.[1]}</td><td className="px-3 py-2">{r.category ?? 'all'}</td><td className="px-3 py-2">{r.city ?? 'all'}</td><td className="px-3 py-2">{rs(r.pricePaise)}</td><td className="px-3 py-2 text-xs">{when(r.effectiveFrom)}</td><td className="px-3 py-2 text-xs">{when(r.effectiveTo)}</td></tr>)}
          </Table>
        </details>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Rules</h3>
        {settings.loading && !settings.data ? <Spin /> : (
          <div className="grid gap-2 md:grid-cols-2">
            {Object.entries(settings.data ?? {}).filter(([k]) => k !== 'blocklistWords' && k !== 'channelDailyCaps').map(([k, v]) => {
              const shown = edit[k] ?? (Array.isArray(v) ? v.join(', ') : String(v));
              const changed = edit[k] !== undefined && edit[k] !== (Array.isArray(v) ? v.join(', ') : String(v));
              const parse = (): unknown => (typeof v === 'boolean' ? shown === 'true' : typeof v === 'number' ? Number(shown) : Array.isArray(v) ? shown.split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x)) : shown);
              return (
                <div key={k} className={`${card} space-y-1`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-300">{k}</span>{changed && <Pill tone="amber">unsaved</Pill>}</div>
                  <div className="text-[11px] text-slate-500">{SETTING_HELP[k] ?? ''}</div>
                  <div className="flex gap-2">
                    {typeof v === 'boolean'
                      ? <select className={field} value={shown} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} aria-label={k}><option value="false">off</option><option value="true">on</option></select>
                      : <input className={field} value={shown} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} aria-label={k} autoComplete="off" />}
                    <Btn disabled={!changed} busy={busy === k} onClick={() => act(k, async () => { await adm(`/admin/leadspace/settings/${k}`, { method: 'PUT', body: { value: parse() } }); setEdit((e) => { const n = { ...e }; delete n[k]; return n; }); }, `${k} saved.`)}>Save</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className={`${card} space-y-2`}>
          <div className="text-sm font-semibold text-white">Words that may not appear on a page</div>
          <p className="text-[11px] text-slate-500">Separated by commas. A page with one of these in its name, tagline, about text, services or offer cannot be saved or published. Daily post caps per channel are on the Promotion tab.</p>
          <textarea className={field} rows={3} aria-label="Blocked words" value={edit.__blocklist ?? ((settings.data?.blocklistWords as string[] | undefined) ?? []).join(', ')} onChange={(e) => setEdit({ ...edit, __blocklist: e.target.value })} />
          <Btn disabled={edit.__blocklist === undefined} busy={busy === 'blocklist'} onClick={() => act('blocklist', async () => { await adm('/admin/leadspace/settings/blocklistWords', { method: 'PUT', body: { value: (edit.__blocklist ?? '').split(',').map((w) => w.trim()).filter(Boolean) } }); setEdit((e) => { const n = { ...e }; delete n.__blocklist; return n; }); }, 'Blocked words saved.')}>Save words</Btn>
        </div>
      </section>
    </div>
  );
}
