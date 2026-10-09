'use client';

import { useState } from 'react';
import { useLoad } from '@/bos/client';
import { Btn, Msg, Pill, Spin, Table, adm, card, field, rs, useAct, when } from './ui';

interface CostRow { category: string; city: string; verifiedEvents: number; held: number; credited: number; revenueNetPaise: number; spendPaise: number; costPerVerifiedLeadPaise: number | null; marginPercent: number | null; alert: string | null }
interface Cost { from: string; to: string; floorPercent: number; rows: CostRow[]; unallocatedSpendPaise: number; total: Omit<CostRow, 'category' | 'city'>; alerts: string[] }
interface Spend { id: string; date: string; channel: string; category: string | null; city: string | null; amountPaise: number; note: string | null }

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** Cost per verified lead, by trade and city, from the ad spend we entered and the events vendors were charged for. Money screen. */
export default function ReportsTab() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const cost = useLoad(() => adm<Cost>(`/admin/leadspace/cost-report?from=${from}&to=${to}`), [from, to]);
  const spend = useLoad(() => adm<Spend[]>(`/admin/leadspace/ad-spend?from=${from}&to=${to}`), [from, to]);
  const { msg, busy, act } = useAct(() => { cost.reload(); spend.reload(); });
  const [f, setF] = useState({ date: iso(new Date()), channel: 'FACEBOOK_BOOST', category: '', city: '', rupees: '', note: '' });
  const t = cost.data?.total;

  return (
    <div className="space-y-6">
      {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">From<input type="date" className={`${field} mt-1`} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-slate-400">To<input type="date" className={`${field} mt-1`} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      {cost.loading && !cost.data ? <Spin /> : cost.data && (
        <>
          {cost.data.alerts.length > 0 && <Msg tone="error"><div className="font-semibold">Margin alerts (floor {cost.data.floorPercent}% after GST)</div><ul className="mt-1 list-disc pl-5">{cost.data.alerts.map((a) => <li key={a}>{a}</li>)}</ul></Msg>}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className={card}><div className="text-xs text-slate-400">Verified events</div><div className="text-2xl font-bold text-white">{t?.verifiedEvents ?? 0}</div></div>
            <div className={card}><div className="text-xs text-slate-400">Earned (before GST)</div><div className="text-2xl font-bold text-white">{rs(t?.revenueNetPaise)}</div></div>
            <div className={card}><div className="text-xs text-slate-400">Spent on boosts</div><div className="text-2xl font-bold text-white">{rs(t?.spendPaise)}</div></div>
            <div className={card}><div className="text-xs text-slate-400">Cost per verified lead</div><div className="text-2xl font-bold text-white">{rs(t?.costPerVerifiedLeadPaise)}</div><div className="text-xs text-slate-500">margin {t?.marginPercent ?? '-'}%</div></div>
          </div>
          <Table head={['Trade', 'City', 'Verified', 'Held', 'Credited', 'Earned', 'Spent', 'Cost / lead', 'Margin']} empty={cost.data.rows.length === 0 ? 'No verified events in this period.' : undefined}>
            {cost.data.rows.map((r) => (
              <tr key={`${r.category}|${r.city}`}>
                <td className="px-3 py-2">{r.category}</td><td className="px-3 py-2">{r.city}</td><td className="px-3 py-2">{r.verifiedEvents}</td><td className="px-3 py-2">{r.held}</td><td className="px-3 py-2">{r.credited}</td>
                <td className="px-3 py-2">{rs(r.revenueNetPaise)}</td><td className="px-3 py-2">{rs(r.spendPaise)}</td><td className="px-3 py-2">{rs(r.costPerVerifiedLeadPaise)}</td>
                <td className="px-3 py-2">{r.marginPercent === null ? '-' : <Pill tone={r.alert ? 'red' : 'green'}>{r.marginPercent}%</Pill>}</td>
              </tr>
            ))}
          </Table>
          {cost.data.unallocatedSpendPaise > 0 && <p className="text-xs text-amber-300">{rs(cost.data.unallocatedSpendPaise)} of spend matches no trade and city that had events in this period.</p>}
        </>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Ad spend (entered by hand)</h3>
        <p className="text-xs text-slate-400">When our team boosts a post in Ads Manager, record what was spent. Leave trade and city empty for spend that covers everything; it is shared by number of verified events.</p>
        <div className={`${card} grid gap-2 sm:grid-cols-6`}>
          <input type="date" className={field} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Date" />
          <input className={field} placeholder="Where (e.g. FACEBOOK_BOOST)" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} aria-label="Where" autoComplete="off" />
          <input className={field} placeholder="Trade (optional)" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Trade" autoComplete="off" />
          <input className={field} placeholder="City (optional)" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} aria-label="City" autoComplete="off" />
          <input className={field} placeholder="Amount in rupees" inputMode="decimal" value={f.rupees} onChange={(e) => setF({ ...f, rupees: e.target.value.replace(/[^\d.]/g, '') })} aria-label="Amount in rupees" autoComplete="off" />
          <Btn busy={busy === 'sp'} disabled={!f.rupees} onClick={() => act('sp', async () => { await adm('/admin/leadspace/ad-spend', { method: 'POST', body: { date: f.date, channel: f.channel.trim() || 'OTHER', ...(f.category.trim() ? { category: f.category.trim() } : {}), ...(f.city.trim() ? { city: f.city.trim() } : {}), amountPaise: Math.round(Number(f.rupees) * 100), ...(f.note.trim() ? { note: f.note.trim() } : {}) } }); setF({ ...f, rupees: '', note: '' }); }, 'Spend recorded.')}>Add</Btn>
        </div>
        <Table head={['Date', 'Where', 'Trade', 'City', 'Amount', '']} empty={(spend.data ?? []).length === 0 ? 'No spend recorded in this period.' : undefined}>
          {(spend.data ?? []).map((s) => <tr key={s.id}><td className="px-3 py-2 text-xs">{when(s.date).split(',')[0]}</td><td className="px-3 py-2">{s.channel}</td><td className="px-3 py-2">{s.category ?? 'all'}</td><td className="px-3 py-2">{s.city ?? 'all'}</td><td className="px-3 py-2 text-white">{rs(s.amountPaise)}</td><td className="px-3 py-2"><Btn tone="ghost" onClick={() => act(`rm${s.id}`, () => adm(`/admin/leadspace/ad-spend/${s.id}/remove`, { method: 'PUT', body: {} }), 'Entry removed.')}>Remove</Btn></td></tr>)}
        </Table>
      </section>
    </div>
  );
}
