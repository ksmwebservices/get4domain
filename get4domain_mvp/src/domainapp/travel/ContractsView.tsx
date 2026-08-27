'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Car, UserCog, CalendarClock, Receipt, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Contact { id: string; name: string }
interface Ref { id: string; name: string }
interface Assignment { vehicleId?: string; driverId?: string; routeLabel?: string; vehicle?: Ref | null; driver?: Ref | null }
interface Contract {
  id: string; title: string; monthlyRate: number; gstRate: number; status: string;
  billingDayOfMonth: number; lastBilledPeriod?: string | null;
  startDate: string; endDate?: string | null; scheduleNotes?: string;
  contactId: string; contact?: Contact; assignments: Assignment[];
}

const STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#16a34a' },
  paused: { label: 'Paused', color: '#f59e0b' },
  ended: { label: 'Ended', color: '#64748b' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const thisPeriod = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const emptyForm = (): Record<string, unknown> => ({
  contactId: '', title: '', monthlyRate: 0, gstRate: 0, startDate: '', endDate: '',
  billingDayOfMonth: 1, scheduleNotes: '', status: 'active',
});

export default function ContractsView() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [vehicles, setVehicles] = useState<Ref[]>([]);
  const [drivers, setDrivers] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getContracts().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.daGetContacts('?limit=200').then((r) => setContacts(r.data?.items ?? [])).catch(() => setContacts([]));
    api.getVehicles().then((r) => setVehicles(r.data ?? [])).catch(() => setVehicles([]));
    api.getDrivers().then((r) => setDrivers(r.data ?? [])).catch(() => setDrivers([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setAssignments([]); setOpen(true); };
  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({
      contactId: c.contactId, title: c.title, monthlyRate: c.monthlyRate, gstRate: c.gstRate,
      startDate: c.startDate?.slice(0, 10) ?? '', endDate: c.endDate?.slice(0, 10) ?? '',
      billingDayOfMonth: c.billingDayOfMonth, scheduleNotes: c.scheduleNotes ?? '', status: c.status,
    });
    setAssignments((c.assignments ?? []).map((a) => ({ vehicleId: a.vehicle?.id ?? '', driverId: a.driver?.id ?? '', routeLabel: a.routeLabel ?? '' })));
    setOpen(true);
  };

  const addRoute = () => setAssignments((a) => [...a, { vehicleId: '', driverId: '', routeLabel: '' }]);
  const updateRoute = (i: number, patch: Partial<Assignment>) => setAssignments((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeRoute = (i: number) => setAssignments((a) => a.filter((_, idx) => idx !== i));

  async function save() {
    if (!String(form.contactId) || !String(form.title).trim() || !String(form.startDate)) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        monthlyRate: Number(form.monthlyRate) || 0,
        gstRate: Number(form.gstRate) || 0,
        billingDayOfMonth: Number(form.billingDayOfMonth) || 1,
        endDate: form.endDate || undefined,
        assignments: assignments
          .filter((a) => a.vehicleId || a.driverId || a.routeLabel)
          .map((a) => ({ vehicleId: a.vehicleId || undefined, driverId: a.driverId || undefined, routeLabel: a.routeLabel || undefined })),
      };
      if (editing) await api.updateContract(editing.id, payload);
      else await api.createContract(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  async function remove(c: Contract) {
    if (!confirm(`Delete contract "${c.title}"?`)) return;
    await api.deleteContract(c.id); load();
  }

  async function generate() {
    setBilling(true);
    try {
      const res = await api.generateContractInvoices();
      const { generated, alreadyBilled } = res.data ?? { generated: 0, alreadyBilled: 0 };
      alert(`${generated} invoice${generated === 1 ? '' : 's'} generated for ${thisPeriod()}.` + (alreadyBilled ? ` ${alreadyBilled} already billed this month.` : ''));
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not generate invoices');
    } finally { setBilling(false); }
  }

  const billedThisMonth = (c: Contract) => c.lastBilledPeriod === thisPeriod();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contracts</h1>
          <p className="mt-0.5 text-sm text-slate-500">Recurring monthly service agreements — billed automatically each month.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" loading={billing} leftIcon={!billing && <Receipt className="h-4 w-4" />} onClick={generate}>Generate this month&apos;s invoices</Button>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Contract</Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" /></div>
      ) : rows.length === 0 ? (
        <Card padded>
          <EmptyState icon="FileSignature" title="No contracts yet" subtitle="Create a recurring monthly contract for a corporate, school or college client."
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Contract</Button>} />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const s = STATUS[c.status] ?? STATUS.active;
            return (
              <Card key={c.id} padded>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{c.title}</span>
                      <Badge color={s.color}>{s.label}</Badge>
                      {billedThisMonth(c) && <Badge color="#16a34a">Billed {thisPeriod()}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{c.contact?.name ?? 'Client'}</span>
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Bills day {c.billingDayOfMonth}{c.lastBilledPeriod ? ` · last ${c.lastBilledPeriod}` : ''}</span>
                      {c.assignments?.length > 0 && (
                        <span className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5" />{c.assignments.length} route{c.assignments.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {c.scheduleNotes && <div className="mt-1 text-xs text-slate-500">{c.scheduleNotes}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{inr(c.monthlyRate)}<span className="text-xs font-normal text-slate-400">/mo</span></div>
                      {c.gstRate > 0 && <div className="text-xs text-slate-400">+{c.gstRate}% GST</div>}
                    </div>
                    <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Contract' : 'New Contract'} maxWidth="max-w-2xl">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Client" value={(form.contactId as string) ?? ''} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              <option value="">Select client…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Contract title" value={(form.title as string) ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ABC School — Daily Bus Service" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Monthly rate (₹)" type="number" value={(form.monthlyRate as number) ?? 0} onChange={(e) => setForm({ ...form, monthlyRate: Number(e.target.value) })} />
            <Input label="GST %" type="number" value={(form.gstRate as number) ?? 0} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })} />
            <Input label="Bill on day" type="number" value={(form.billingDayOfMonth as number) ?? 1} onChange={(e) => setForm({ ...form, billingDayOfMonth: Number(e.target.value) })} />
            <Select label="Status" value={(form.status as string) ?? 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start date" type="date" value={(form.startDate as string) ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End date (blank = open-ended)" type="date" value={(form.endDate as string) ?? ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>

          {/* Multiple vehicle/driver assignments (routes) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Assigned routes (vehicle + driver)</label>
              <button onClick={addRoute} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"><Plus className="h-3.5 w-3.5" />Add route</button>
            </div>
            {assignments.length === 0 ? (
              <p className="text-xs text-slate-400">No routes assigned yet. A contract can run several buses/cabs — add one row per route.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a, i) => (
                  <div key={i} className="flex items-end gap-2 rounded-xl border border-slate-200 p-2.5">
                    <div className="flex-1">
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">Route label</label>
                      <input value={a.routeLabel ?? ''} onChange={(e) => updateRoute(i, { routeLabel: e.target.value })} placeholder="Route 4 — North"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500"><Car className="h-3 w-3" />Vehicle</label>
                      <select value={a.vehicleId ?? ''} onChange={(e) => updateRoute(i, { vehicleId: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                        <option value="">—</option>
                        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500"><UserCog className="h-3 w-3" />Driver</label>
                      <select value={a.driverId ?? ''} onChange={(e) => updateRoute(i, { driverId: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                        <option value="">—</option>
                        {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <button onClick={() => removeRoute(i)} className="mb-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Textarea label="Schedule notes" value={(form.scheduleNotes as string) ?? ''} onChange={(e) => setForm({ ...form, scheduleNotes: e.target.value })} placeholder="Mon–Sat, pickup 7am / drop 5pm" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save Contract' : 'Create Contract'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
