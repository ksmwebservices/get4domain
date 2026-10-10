'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { dateShort, rupees, useLoad } from '@/bos/client';
import { Empty, ErrorView, Field, Spinner, csvDownload, inputCls } from '@/bos/ui';
import { EVENT_ONE, ls, type WalletReport } from './ls';

const REASON: Record<string, string> = { REFILL: 'Refill', LEAD_CHARGE: 'Verified customer', CREDIT_INVALID: 'Credit for an invalid lead', REFUND: 'Refund', ADJUSTMENT: 'Adjustment', EXPIRY: 'Expired balance', PLAN_CREDIT: 'Plan credit' };
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const ago = (n: number): string => iso(new Date(Date.now() - (n - 1) * 86_400_000));

/** "Where did my wallet money go?" Everything here is read from the wallet ledger, so it always agrees with the balance. */
export default function WalletReportView() {
  const [from, setFrom] = useState(ago(30));
  const [to, setTo] = useState(iso(new Date()));
  const r = useLoad(() => ls<WalletReport>(`/leadspace/wallet/report?from=${from}&to=${to}`), [from, to]);
  const d = r.data;
  const maxDay = d ? Math.max(1, ...d.perDay.map((x) => x.outPaise)) : 1;

  function download(): void {
    if (!d) return;
    csvDownload(`leadspace-wallet-${from}-to-${to}.csv`, [
      ['When', 'What', 'In or out', 'Amount (Rs)', 'Balance after (Rs)', 'Lead type', 'Customer', 'Lead status', 'Note'],
      ...d.lines.map((l) => [l.at, REASON[l.reason] ?? l.reason, l.direction === 'IN' ? 'In' : 'Out', (l.amountPaise / 100).toFixed(2), (l.balanceAfterPaise / 100).toFixed(2), l.leadType ? EVENT_ONE[l.leadType] ?? l.leadType : '', l.customer ?? '', l.leadStatus ?? '', l.note ?? '']),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From"><input type="date" className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" className={inputCls} value={to} min={from} max={iso(new Date())} onChange={(e) => setTo(e.target.value)} /></Field>
        <div className="flex gap-2 pb-0.5">
          <Button size="sm" variant="outline" onClick={() => { setFrom(ago(7)); setTo(iso(new Date())); }}>7 days</Button>
          <Button size="sm" variant="outline" onClick={() => { setFrom(ago(30)); setTo(iso(new Date())); }}>30 days</Button>
          <Button size="sm" variant="outline" onClick={() => { setFrom(ago(90)); setTo(iso(new Date())); }}>90 days</Button>
        </div>
      </div>

      {r.loading && !d && <Spinner />}
      {r.error && !d && <ErrorView error={r.error} />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card padded><div className="text-xs text-slate-500">Balance at start</div><div className="text-lg font-semibold text-slate-900">{rupees(d.openingPaise)}</div></Card>
            <Card padded><div className="text-xs text-slate-500">Added</div><div className="text-lg font-semibold text-success-700">+{rupees(d.totals.inPaise)}</div><div className="text-xs text-slate-400">refills {rupees(d.totals.refilledPaise)}</div></Card>
            <Card padded><div className="text-xs text-slate-500">Used</div><div className="text-lg font-semibold text-slate-900">-{rupees(d.totals.outPaise)}</div><div className="text-xs text-slate-400">{d.totals.charges} verified customer{d.totals.charges === 1 ? '' : 's'}</div></Card>
            <Card padded><div className="text-xs text-slate-500">Balance at end</div><div className="text-lg font-semibold text-slate-900">{rupees(d.closingPaise)}</div></Card>
          </div>

          <Card padded className="space-y-2">
            <div className="text-sm font-semibold text-slate-900">What each verified customer cost</div>
            {d.totals.charges === 0 ? <p className="text-sm text-slate-600">No verified customers were charged in this period.</p> : (
              <p className="text-sm text-slate-600">
                {d.totals.charges} verified customer{d.totals.charges === 1 ? '' : 's'} cost {rupees(d.totals.chargedPaise)} in all, about {rupees(d.totals.averageChargePaise)} each.
                {d.totals.creditedBackPaise > 0 ? ` ${rupees(d.totals.creditedBackPaise)} came back for leads that were not valid.` : ''}
              </p>
            )}
            {Object.keys(d.byType).length > 0 && (
              <ul className="divide-y divide-slate-100 text-sm">
                {Object.entries(d.byType).map(([t, v]) => (
                  <li key={t} className="flex items-center justify-between py-1.5"><span className="text-slate-700">{EVENT_ONE[t] ?? 'Other'} · {v.count}</span><span className="font-semibold text-slate-900">{rupees(v.paise)}</span></li>
                ))}
              </ul>
            )}
          </Card>

          {d.perDay.length > 0 && (
            <Card padded className="space-y-2">
              <div className="text-sm font-semibold text-slate-900">Day by day</div>
              <ul className="space-y-1.5">
                {d.perDay.map((x) => (
                  <li key={x.day} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 text-slate-500">{dateShort(x.day)}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-primary-600" style={{ width: `${Math.max(2, Math.round((x.outPaise / maxDay) * 100))}%`, opacity: x.outPaise ? 1 : 0.15 }} /></span>
                    <span className="w-24 shrink-0 text-right text-slate-700">{x.outPaise ? `-${rupees(x.outPaise)}` : 'no charge'}</span>
                    <span className="hidden w-24 shrink-0 text-right text-slate-400 sm:block">bal {rupees(x.closingPaise)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Every line</h3>
              <Button size="sm" variant="outline" onClick={download} disabled={d.lines.length === 0}>Download as spreadsheet</Button>
            </div>
            {d.lines.length === 0 ? <Empty title="Nothing in this period">Pick a longer period to see more.</Empty> : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {d.lines.map((l) => (
                  <li key={`${l.at}${l.reason}${l.amountPaise}${l.customer ?? ''}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div>
                      <div className="text-slate-800">{REASON[l.reason] ?? l.reason}{l.leadType ? ` · ${EVENT_ONE[l.leadType] ?? ''}` : ''}</div>
                      <div className="text-xs text-slate-500">{dateShort(l.at)}{l.customer ? ` · ${l.customer}` : ''}{l.note ? ` · ${l.note}` : ''}</div>
                    </div>
                    <div className="text-right"><div className={l.direction === 'IN' ? 'font-semibold text-success-700' : 'font-semibold text-slate-900'}>{l.direction === 'IN' ? '+' : '-'}{rupees(l.amountPaise)}</div><div className="text-xs text-slate-400">balance {rupees(l.balanceAfterPaise)}</div></div>
                  </li>
                ))}
              </ul>
            )}
            {d.truncated && <p className="mt-2 text-xs text-slate-500">This period is very long; only the newest lines are shown. Pick a shorter period.</p>}
          </section>
        </>
      )}
    </div>
  );
}
