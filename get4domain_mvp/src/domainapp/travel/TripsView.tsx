'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Users, Car, UserCog, X } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Contact { id: string; name: string }
interface Ref { id: string; name: string }
interface ItineraryDay { day: number; title: string; detail?: string }
interface Trip {
  id: string; title: string; contactId?: string; destination?: string;
  startDate?: string; endDate?: string; pax: number; status: string;
  packageCost: number; sellPrice: number; itinerary?: ItineraryDay[];
  vehicleId?: string; driverId?: string; notes?: string;
  vehicle?: Ref | null; driver?: Ref | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planning', color: '#64748b' },
  confirmed: { label: 'Confirmed', color: '#2563eb' },
  ongoing: { label: 'Ongoing', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#16a34a' },
  cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const emptyForm = (): Record<string, unknown> => ({
  title: '', contactId: '', destination: '', startDate: '', endDate: '', pax: 1,
  status: 'planning', packageCost: 0, sellPrice: 0, vehicleId: '', driverId: '', notes: '',
});

export default function TripsView() {
  const [rows, setRows] = useState<Trip[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [vehicles, setVehicles] = useState<Ref[]>([]);
  const [drivers, setDrivers] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getTrips().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.daGetContacts('?limit=200').then((r) => setContacts(r.data?.items ?? [])).catch(() => setContacts([]));
    api.getVehicles().then((r) => setVehicles(r.data ?? [])).catch(() => setVehicles([]));
    api.getDrivers().then((r) => setDrivers(r.data ?? [])).catch(() => setDrivers([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDays([]); setOpen(true); };
  const openEdit = (t: Trip) => {
    setEditing(t);
    setForm({
      title: t.title, contactId: t.contactId ?? '', destination: t.destination ?? '',
      startDate: t.startDate?.slice(0, 10) ?? '', endDate: t.endDate?.slice(0, 10) ?? '', pax: t.pax,
      status: t.status, packageCost: t.packageCost, sellPrice: t.sellPrice,
      vehicleId: t.vehicleId ?? '', driverId: t.driverId ?? '', notes: t.notes ?? '',
    });
    setDays(t.itinerary ?? []);
    setOpen(true);
  };

  const addDay = () => setDays((d) => [...d, { day: d.length + 1, title: '', detail: '' }]);
  const updateDay = (i: number, patch: Partial<ItineraryDay>) => setDays((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeDay = (i: number) => setDays((d) => d.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, day: idx + 1 })));

  async function save() {
    if (!String(form.title).trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        pax: Number(form.pax) || 1,
        packageCost: Number(form.packageCost) || 0,
        sellPrice: Number(form.sellPrice) || 0,
        contactId: form.contactId || undefined,
        vehicleId: form.vehicleId || undefined,
        driverId: form.driverId || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        itinerary: days.filter((d) => d.title.trim()),
      };
      if (editing) await api.updateTrip(editing.id, payload);
      else await api.createTrip(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  async function remove(t: Trip) {
    if (!confirm(`Delete trip "${t.title}"?`)) return;
    await api.deleteTrip(t.id); load();
  }

  const margin = (Number(form.sellPrice) || 0) - (Number(form.packageCost) || 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trips</h1>
          <p className="mt-0.5 text-sm text-slate-500">Build itineraries, assign a vehicle &amp; driver, and track package cost vs. sell price.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Trip</Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <Card padded>
          <EmptyState icon="Map" title="No trips yet" subtitle="Create your first trip itinerary to get started."
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Trip</Button>} />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => {
            const s = STATUS[t.status] ?? STATUS.planning;
            const m = (t.sellPrice ?? 0) - (t.packageCost ?? 0);
            return (
              <Card key={t.id} padded>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{t.title}</span>
                      <Badge color={s.color}>{s.label}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {t.destination && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{t.destination}</span>}
                      {(t.startDate || t.endDate) && <span>{fmt(t.startDate)}{t.endDate ? ` – ${fmt(t.endDate)}` : ''}</span>}
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t.pax} pax</span>
                      {t.vehicle && <span className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5" />{t.vehicle.name}</span>}
                      {t.driver && <span className="inline-flex items-center gap-1"><UserCog className="h-3.5 w-3.5" />{t.driver.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{inr(t.sellPrice)}</div>
                      <div className={`text-xs font-medium ${m >= 0 ? 'text-success-600' : 'text-error-600'}`}>{m >= 0 ? '+' : ''}{inr(m)} margin</div>
                    </div>
                    <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {t.itinerary && t.itinerary.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                    {t.itinerary.length} day{t.itinerary.length > 1 ? 's' : ''}: {t.itinerary.map((d) => d.title).filter(Boolean).join(' · ')}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Trip' : 'New Trip'} maxWidth="max-w-2xl">
        <div className="space-y-3">
          <Input label="Trip title" required value={(form.title as string) ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Kerala Backwaters — 4D/3N" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Customer" value={(form.contactId as string) ?? ''} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              <option value="">Select…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Destination" value={(form.destination as string) ?? ''} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Start date" type="date" value={(form.startDate as string) ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End date" type="date" value={(form.endDate as string) ?? ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            <Input label="Travellers" type="number" value={(form.pax as number) ?? 1} onChange={(e) => setForm({ ...form, pax: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Package cost (₹)" type="number" value={(form.packageCost as number) ?? 0} onChange={(e) => setForm({ ...form, packageCost: Number(e.target.value) })} />
            <Input label="Sell price (₹)" type="number" value={(form.sellPrice as number) ?? 0} onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) })} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Margin</label>
              <div className={`rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold ${margin >= 0 ? 'text-success-700' : 'text-error-700'}`}>{inr(margin)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Assign vehicle" value={(form.vehicleId as string) ?? ''} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">{vehicles.length ? 'None' : 'No vehicles (Fleet addon)'}</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
            <Select label="Assign driver" value={(form.driverId as string) ?? ''} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">{drivers.length ? 'None' : 'No drivers (Driver addon)'}</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <Select label="Status" value={(form.status as string) ?? 'planning'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </Select>

          {/* Itinerary builder */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Itinerary (day by day)</label>
              <button onClick={addDay} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"><Plus className="h-3.5 w-3.5" />Add day</button>
            </div>
            {days.length === 0 ? (
              <p className="text-xs text-slate-400">No days added. Click “Add day” to build the itinerary.</p>
            ) : (
              <div className="space-y-2">
                {days.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 p-2.5">
                    <div className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{d.day}</div>
                    <div className="flex-1 space-y-1.5">
                      <input value={d.title} onChange={(e) => updateDay(i, { title: e.target.value })} placeholder="Day title (e.g. Arrival & houseboat)"
                        className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                      <input value={d.detail ?? ''} onChange={(e) => updateDay(i, { detail: e.target.value })} placeholder="Details (optional)"
                        className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-2.5 py-1.5 text-xs text-slate-600 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                    </div>
                    <button onClick={() => removeDay(i)} className="mt-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-error-600"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save Trip' : 'Create Trip'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
