'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import { planAccessApi, type PlanAccessRow, type PlanAccessVendor, fmtDate } from '@/lib/commerce';
import { ErrorBox, Field, cardCls, inputCls, msg } from '@/components/admin/commerce-ui';

type VendorHit = { id: string; businessName: string; subdomain: string | null; plan: string; navV2: boolean };

/**
 * Admin > Commerce > Plan access. The module-to-plan map is READ from the feature registry (the same data the vendor menu and provisioning
 * use), so there is no second list to keep in step. Per-vendor exceptions need a written reason and are kept in the audit log.
 */
export default function PlanAccessPage() {
  const [map, setMap] = useState<PlanAccessRow[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<VendorHit[]>([]);
  const [vendor, setVendor] = useState<PlanAccessVendor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => { planAccessApi.map().then((r) => setMap(r.data ?? [])).catch((e) => setError(msg(e))); }, []);
  const search = useCallback(() => { planAccessApi.vendors(q).then((r) => setHits(r.data ?? [])).catch((e) => setError(msg(e))); }, [q]);
  useEffect(() => { search(); }, [search]);

  async function open(id: string) {
    setError(''); setNotice(''); setBusy(true);
    try { setVendor((await planAccessApi.vendor(id)).data); } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }
  async function toggle(kind: 'module' | 'addon', key: string, enabled: boolean) {
    if (!vendor) return;
    setError(''); setNotice(''); setBusy(true);
    try { setVendor((await planAccessApi.setException(vendor.vendor.id, { kind, key, enabled, reason })).data); setNotice(`${key} is now ${enabled ? 'on' : 'off'} for ${vendor.vendor.businessName}. Recorded in the audit log.`); setReason(''); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }
  async function provision() {
    if (!vendor) return;
    setError(''); setNotice(''); setBusy(true);
    try { setVendor((await planAccessApi.provision(vendor.vendor.id)).data); setNotice('Provisioned: everything the plan includes is now on. Nothing was removed.'); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }

  const pending = vendor?.provisionPlan ? vendor.provisionPlan.grantModules.length + vendor.provisionPlan.grantAddons.length : 0;
  const reasonOk = reason.trim().length >= 10;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white">Plan access</h3>
        <p className="mt-1 text-sm text-slate-400">Which module each plan includes, and exceptions for one client. Switching a plan on grants modules and never removes any. Custom is not a plan.</p>
      </div>
      <ErrorBox message={error} />
      {notice && <div role="status" className="rounded-xl border border-success-500/30 bg-success-500/10 px-4 py-2.5 text-sm text-success-400">{notice}</div>}

      <section className={cardCls}>
        <h4 className="text-sm font-bold text-white">Module to plan</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="py-2 pr-3">Screen</th><th className="pr-3">Needs</th><th className="pr-3">Lowest plan</th><th>Built?</th></tr></thead>
            <tbody>
              {map.map((r) => (
                <tr key={r.featureId} className="border-t border-slate-800 text-slate-300">
                  <td className="py-2 pr-3">{r.label}</td>
                  <td className="pr-3 font-mono text-xs">{r.moduleKey ?? r.addonKey}</td>
                  <td className="pr-3">{r.minPlan}</td>
                  <td>{r.status === 'WORKING' || r.status === 'LIMITED' ? 'Yes' : 'Not yet — shown as Coming soon'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${cardCls} space-y-4`}>
        <h4 className="text-sm font-bold text-white">One client</h4>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Search by business name or subdomain" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} aria-label="Search clients" />
          <Button type="button" onClick={search} leftIcon={<Search className="h-4 w-4" />}>Search</Button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {hits.map((h) => (
            <li key={h.id}><button type="button" onClick={() => open(h.id)} className="w-full rounded-xl border border-slate-700 px-3 py-2 text-left text-sm text-slate-200 hover:border-primary-500">
              <span className="font-semibold">{h.businessName}</span> <span className="text-xs text-slate-500">{h.subdomain}</span>
              <span className="block text-xs text-slate-400">{h.plan} · new dashboard {h.navV2 ? 'on' : 'off'}</span>
            </button></li>
          ))}
        </ul>
        {busy && <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-label="Loading" />}

        {vendor && (
          <div className="space-y-4 border-t border-slate-800 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-white">{vendor.vendor.businessName}</div>
                <div className="text-xs text-slate-400">{vendor.plan ? vendor.planName : 'No active plan yet'}{vendor.custom ? ' + Custom client' : ''} · profile {vendor.profile}</div>
              </div>
              <Button type="button" onClick={provision} disabled={busy || !vendor.plan || pending === 0}>{pending > 0 ? `Grant ${pending} module${pending === 1 ? '' : 's'} the plan includes` : 'Nothing to grant'}</Button>
            </div>
            {vendor.provisionPlan && vendor.provisionPlan.beyondPlanModules.length > 0 && (
              <p className="text-xs text-slate-400">On, but beyond this plan (kept, never removed automatically): {vendor.provisionPlan.beyondPlanModules.join(', ')}.</p>
            )}
            <Field label="Reason for a change (required, kept in the audit log)" hint="At least 10 characters."><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
            <div className="grid gap-2 sm:grid-cols-2">
              {vendor.modules.map((m) => (
                <div key={m.key} className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2 text-sm text-slate-200">
                  <span>{m.label} <span className="text-xs text-slate-500">{m.fromRow ? '' : '(default)'}</span></span>
                  <button type="button" disabled={busy || !reasonOk} onClick={() => toggle('module', m.key, !m.enabled)} className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold disabled:opacity-40" aria-label={`${m.enabled ? 'Switch off' : 'Switch on'} ${m.label}`}>{m.enabled ? 'On — switch off' : 'Off — switch on'}</button>
                </div>
              ))}
            </div>
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wide text-slate-500">History of exceptions</h5>
              {vendor.exceptions.length === 0 ? <p className="mt-1 text-sm text-slate-500">None.</p> : (
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {vendor.exceptions.map((x) => <li key={x.id}>{fmtDate(x.at)} · {x.actor} set {x.kind} <code className="text-xs">{x.key}</code> {x.enabled ? 'on' : 'off'} — {x.reason}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
