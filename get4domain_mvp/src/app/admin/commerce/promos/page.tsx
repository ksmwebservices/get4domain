'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { commerceApi, rupees, fmtDate, CYCLE_LABEL, PLAN_LABEL, type Cycle, type PlanKey } from '@/lib/commerce';
import { ErrorBox, Field, Pill, cardCls, inputCls, msg, selectCls } from '@/components/admin/commerce-ui';

interface Promo {
  id: string; code: string; description: string | null; type: 'PERCENT' | 'FLAT'; value: number; active: boolean; redemptions: number;
  appliesToPlans: PlanKey[]; appliesToCycles: Cycle[]; minCycleMonths: number | null; validFrom: string | null; validTo: string | null;
  maxRedemptions: number | null; perVendorLimit: number;
}

const EMPTY = { code: '', description: '', type: 'PERCENT' as 'PERCENT' | 'FLAT', value: '', plans: [] as PlanKey[], cycles: [] as Cycle[], minMonths: '', validFrom: '', validTo: '', max: '', perVendor: '1' };

export default function PromosPage() {
  const [rows, setRows] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await commerceApi.listPromos(); setRows((r.data ?? []) as Promo[]); setError(''); } catch (e) { setError(msg(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function create() {
    setBusy(true); setError('');
    try {
      await commerceApi.createPromo({
        code: f.code.trim(), description: f.description.trim() || undefined, type: f.type, value: f.type === 'FLAT' ? Math.round(Number(f.value) * 100) : Number(f.value),
        appliesToPlans: f.plans, appliesToCycles: f.cycles, minCycleMonths: f.minMonths ? Number(f.minMonths) : undefined,
        validFrom: f.validFrom ? new Date(`${f.validFrom}T00:00:00`).toISOString() : undefined, validTo: f.validTo ? new Date(`${f.validTo}T23:59:59`).toISOString() : undefined,
        maxRedemptions: f.max ? Number(f.max) : undefined, perVendorLimit: Number(f.perVendor) || 1,
      });
      setOpen(false); setF(EMPTY); await load();
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }
  async function setActive(p: Promo, active: boolean) {
    try { await commerceApi.updatePromo(p.id, { active }); await load(); } catch (e) { setError(msg(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-400">Codes are case-insensitive and validated on the server every time: dates, plan/cycle, minimum term, redemption limits, one code per invoice, no stacking on a special discount unless the invoice allows it. A redemption is recorded only when the invoice is <strong className="text-slate-200">paid</strong>.</p>
        <Button size="sm" onClick={() => setOpen(true)} leftIcon={<Plus className="h-3.5 w-3.5" />}>New code</Button>
      </div>
      <ErrorBox message={error} />
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div> : rows.length === 0 ? <div className={`${cardCls} text-center text-sm text-slate-500`}>No promo codes yet.</div> : (
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="text-xs text-slate-500"><th className="py-2 pr-3 font-medium">Code</th><th className="pr-3 font-medium">Discount</th><th className="pr-3 font-medium">Applies to</th><th className="pr-3 font-medium">Valid</th><th className="pr-3 font-medium">Used</th><th className="pr-3 font-medium">Status</th><th /></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} className="border-t border-slate-800 text-slate-300">
                <td className="py-2.5 pr-3"><div className="font-mono font-bold text-white">{p.code}</div>{p.description && <div className="text-xs text-slate-500">{p.description}</div>}</td>
                <td className="pr-3">{p.type === 'PERCENT' ? `${p.value}%` : rupees(p.value)}</td>
                <td className="pr-3 text-xs">{p.appliesToPlans.length ? p.appliesToPlans.map((x) => PLAN_LABEL[x]).join(', ') : 'Any plan'} · {p.appliesToCycles.length ? p.appliesToCycles.map((x) => CYCLE_LABEL[x]).join(', ') : 'any cycle'}{p.minCycleMonths ? ` · min ${p.minCycleMonths} mo` : ''}</td>
                <td className="pr-3 text-xs">{p.validFrom || p.validTo ? `${fmtDate(p.validFrom)} → ${fmtDate(p.validTo)}` : 'Always'}</td>
                <td className="pr-3">{p.redemptions}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''} <span className="text-xs text-slate-500">({p.perVendorLimit}/vendor)</span></td>
                <td className="pr-3"><Pill value={p.active ? 'ACTIVE' : 'CANCELLED'} label={p.active ? 'Active' : 'Off'} /></td>
                <td className="text-right"><button type="button" onClick={() => setActive(p, !p.active)} className="text-xs font-semibold text-primary-300 hover:underline">{p.active ? 'Turn off' : 'Turn on'}</button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New promo code" maxWidth="max-w-xl" skin="dark">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code *" hint="3–32 letters, numbers, - or _"><input className={`${inputCls} font-mono uppercase`} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={200} /></Field>
            <Field label="Type"><select className={selectCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as 'PERCENT' | 'FLAT' })}><option value="PERCENT">Percent off</option><option value="FLAT">Flat ₹ off</option></select></Field>
            <Field label={f.type === 'PERCENT' ? 'Percent (1–100) *' : 'Amount (₹) *'} hint="Type and value cannot be changed after creation."><input inputMode="decimal" className={inputCls} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>
            <Field label="Valid from"><input type="date" className={inputCls} value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} /></Field>
            <Field label="Valid to"><input type="date" className={inputCls} value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} /></Field>
            <Field label="Max total redemptions"><input inputMode="numeric" className={inputCls} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value.replace(/\D/g, '') })} placeholder="Unlimited" /></Field>
            <Field label="Per-vendor limit"><input inputMode="numeric" className={inputCls} value={f.perVendor} onChange={(e) => setF({ ...f, perVendor: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label="Minimum billing term (months)"><input inputMode="numeric" className={inputCls} value={f.minMonths} onChange={(e) => setF({ ...f, minMonths: e.target.value.replace(/\D/g, '') })} placeholder="None" /></Field>
          </div>
          <div><span className="mb-1 block text-xs font-semibold text-slate-400">Only for plans (none ticked = any)</span><div className="flex gap-2">{(['WORKSPACE', 'BOS'] as PlanKey[]).map((p) => <label key={p} className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-primary-500" checked={f.plans.includes(p)} onChange={() => setF({ ...f, plans: toggle(f.plans, p) })} />{PLAN_LABEL[p]}</label>)}</div></div>
          <div><span className="mb-1 block text-xs font-semibold text-slate-400">Only for cycles (none ticked = any)</span><div className="flex flex-wrap gap-3">{(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => <label key={c} className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-primary-500" checked={f.cycles.includes(c)} onChange={() => setF({ ...f, cycles: toggle(f.cycles, c) })} />{CYCLE_LABEL[c]}</label>)}</div></div>
          <div className="flex justify-end gap-2 pt-1"><Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" loading={busy} disabled={f.code.trim().length < 3 || !f.value} onClick={create}>Create code</Button></div>
        </div>
      </Modal>
    </div>
  );
}
