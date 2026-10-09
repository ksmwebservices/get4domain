'use client';

import { useState } from 'react';
import { useLoad } from '@/bos/client';
import { Btn, Msg, Pill, Spin, Table, adm, card, field, useAct } from './ui';

interface Row {
  id: string; vendorId: string; slug: string; businessName: string; city: string; category: string; goal: string; status: string; verificationStatus: string; noindex: boolean;
  promotionEnabled: boolean; openReports: number; regulatedKind: string | null; reviewed: boolean; suspendedReason: string | null; views: number;
}
interface Report { id: string; slug: string; reason: string; note: string | null; createdAt: string }

/** The vendor queue: verification, page review, regulated-trade review, suspend, and what the public reported. */
export default function VendorsTab() {
  const [status, setStatus] = useState('');
  const [verification, setVerification] = useState('');
  const [regulated, setRegulated] = useState('');
  const [search, setSearch] = useState('');
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(verification ? { verification } : {}), ...(regulated ? { regulated } : {}), ...(search.trim() ? { search: search.trim() } : {}) }).toString();
  const list = useLoad(() => adm<{ total: number; rows: Row[] }>(`/admin/leadspace/pages${qs ? `?${qs}` : ''}`), [qs]);
  const reports = useLoad(() => adm<Report[]>('/admin/leadspace/reports'), []);
  const { msg, busy, act } = useAct(() => { list.reload(); reports.reload(); });
  const [reason, setReason] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}
      <div className="flex flex-wrap gap-2">
        <select className={`${field} w-40`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Any status</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="SUSPENDED">Suspended</option></select>
        <select className={`${field} w-48`} value={verification} onChange={(e) => setVerification(e.target.value)} aria-label="Verification"><option value="">Any verification</option><option value="UNVERIFIED">Not verified</option><option value="VERIFIED">Verified</option></select>
        <select className={`${field} w-48`} value={regulated} onChange={(e) => setRegulated(e.target.value)} aria-label="Regulated"><option value="">All trades</option><option value="pending">Regulated trades only</option></select>
        <input className={`${field} w-56`} placeholder="Search name, city or address" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" autoComplete="off" />
      </div>

      {list.loading && !list.data ? <Spin /> : (
        <Table head={['Business', 'Trade / city', 'State', 'Review', 'Reports', 'Actions']} empty={list.data?.rows.length === 0 ? 'No pages match.' : undefined}>
          {(list.data?.rows ?? []).map((r) => (
            <tr key={r.id} className="align-top">
              <td className="px-3 py-2"><div className="font-semibold text-white">{r.businessName}</div><a className="text-xs text-sky-400 underline" href={`/ls/${r.slug}`} target="_blank" rel="noopener noreferrer">/ls/{r.slug}</a><div className="text-xs text-slate-500">{r.views} views</div></td>
              <td className="px-3 py-2 text-xs text-slate-300">{r.category}<br />{r.city}<br />{r.goal}</td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-1"><Pill tone={r.status === 'PUBLISHED' ? 'green' : r.status === 'SUSPENDED' ? 'red' : 'grey'}>{r.status}</Pill><Pill tone={r.verificationStatus === 'VERIFIED' ? 'green' : 'amber'}>{r.verificationStatus === 'VERIFIED' ? 'Verified' : 'Not verified'}</Pill>{r.noindex && <Pill>noindex</Pill>}{r.promotionEnabled && <Pill tone="blue">promoted</Pill>}</div>{r.suspendedReason && <div className="mt-1 text-xs text-red-300">{r.suspendedReason}</div>}</td>
              <td className="px-3 py-2 text-xs">{r.regulatedKind ? <><Pill tone={r.reviewed ? 'green' : 'amber'}>{r.regulatedKind}: {r.reviewed ? 'reviewed' : 'needs review'}</Pill></> : <span className="text-slate-500">-</span>}</td>
              <td className="px-3 py-2">{r.openReports > 0 ? <Pill tone="red">{r.openReports} open</Pill> : <span className="text-slate-500">0</span>}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.regulatedKind && !r.reviewed && <Btn busy={busy === `rv${r.id}`} onClick={() => act(`rv${r.id}`, () => adm(`/admin/leadspace/pages/${r.id}/review`, { method: 'PUT', body: { approve: true } }), 'Reviewed. The page can now be indexed.')}>Approve</Btn>}
                  {r.regulatedKind && (r.regulatedKind === 'advocate' || r.regulatedKind === 'clinic') && <Btn tone="ghost" busy={busy === `pr${r.id}`} onClick={() => act(`pr${r.id}`, () => adm(`/admin/leadspace/pages/${r.id}/review`, { method: 'PUT', body: { approve: true, allowPromotion: true } }), 'Reviewed, and promotion is allowed for this vendor.')}>Approve + allow promotion</Btn>}
                  {r.status === 'SUSPENDED'
                    ? <Btn tone="ghost" busy={busy === `un${r.id}`} onClick={() => act(`un${r.id}`, () => adm(`/admin/leadspace/pages/${r.id}/unsuspend`, { method: 'PUT', body: {} }), 'Suspension lifted. The page is a draft again.')}>Unsuspend</Btn>
                    : <><input className={`${field} w-40`} placeholder="Reason to suspend" aria-label="Reason" value={reason[r.id] ?? ''} onChange={(e) => setReason((x) => ({ ...x, [r.id]: e.target.value }))} autoComplete="off" /><Btn tone="danger" disabled={(reason[r.id] ?? '').trim().length < 5} busy={busy === `su${r.id}`} onClick={() => act(`su${r.id}`, () => adm(`/admin/leadspace/pages/${r.id}/suspend`, { method: 'PUT', body: { reason: (reason[r.id] ?? '').trim() } }), 'Suspended.')}>Suspend</Btn></>}
                  <Btn tone="ghost" busy={busy === `rl${r.id}`} onClick={() => act(`rl${r.id}`, async () => { const x = await adm<{ released: number; stillHeld: number }>(`/admin/leadspace/vendors/${r.vendorId}/release`, { method: 'POST', body: {} }); if (x.released === 0 && x.stillHeld === 0) throw new Error('Nothing is waiting for this vendor.'); }, 'Waiting customers released as far as the balance allows.')}>Release held</Btn>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white">Reports from the public</h3>
        {(reports.data ?? []).length === 0 ? <div className={`${card} text-sm text-slate-500`}>No open reports.</div> : (
          <ul className="space-y-2">
            {(reports.data ?? []).map((x) => (
              <li key={x.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                <div className="text-sm text-slate-200"><a href={`/ls/${x.slug}`} className="font-semibold text-sky-400 underline" target="_blank" rel="noopener noreferrer">{x.slug}</a> · {x.reason}{x.note ? ` · ${x.note}` : ''}</div>
                <div className="flex gap-2">
                  <Btn tone="ghost" onClick={() => act(`d${x.id}`, () => adm(`/admin/leadspace/reports/${x.id}`, { method: 'PUT', body: { action: 'DISMISSED' } }), 'Report dismissed.')}>Dismiss</Btn>
                  <Btn tone="danger" onClick={() => act(`a${x.id}`, () => adm(`/admin/leadspace/reports/${x.id}`, { method: 'PUT', body: { action: 'ACTIONED', suspendReason: `Reported: ${x.reason}` } }), 'Page suspended and report closed.')}>Suspend page</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
