'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UserCog, Armchair, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Stylist { id: string; name: string; phone?: string; specialty?: string; status: string; notes?: string }
interface Chair { id: string; name: string; status: string }

const STY_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#16a34a' }, off_duty: { label: 'Off duty', color: '#64748b' },
};
const CHAIR_STATUS: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: '#16a34a' }, occupied: { label: 'Occupied', color: '#2563eb' }, maintenance: { label: 'Maintenance', color: '#f59e0b' },
};

export default function StylistsView() {
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [loading, setLoading] = useState(true);
  const [sOpen, setSOpen] = useState(false);
  const [cOpen, setCOpen] = useState(false);
  const [editS, setEditS] = useState<Stylist | null>(null);
  const [editC, setEditC] = useState<Chair | null>(null);
  const [sForm, setSForm] = useState<Record<string, unknown>>({ name: '', phone: '', specialty: '', status: 'active', notes: '' });
  const [cForm, setCForm] = useState<Record<string, unknown>>({ name: '', status: 'available' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getStylists(), api.getChairs()])
      .then(([s, c]) => { setStylists(s.data ?? []); setChairs(c.data ?? []); })
      .catch(() => { setStylists([]); setChairs([]); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openS = (s?: Stylist) => { setEditS(s ?? null); setSForm(s ? { ...s } : { name: '', phone: '', specialty: '', status: 'active', notes: '' }); setSOpen(true); };
  const openC = (c?: Chair) => { setEditC(c ?? null); setCForm(c ? { ...c } : { name: '', status: 'available' }); setCOpen(true); };

  async function saveS() {
    if (!String(sForm.name).trim()) return;
    setSaving(true);
    try { editS ? await api.updateStylist(editS.id, sForm) : await api.createStylist(sForm); setSOpen(false); load(); }
    finally { setSaving(false); }
  }
  async function saveC() {
    if (!String(cForm.name).trim()) return;
    setSaving(true);
    try { editC ? await api.updateChair(editC.id, cForm) : await api.createChair(cForm); setCOpen(false); load(); }
    finally { setSaving(false); }
  }
  async function delS(s: Stylist) { if (confirm(`Delete ${s.name}?`)) { await api.deleteStylist(s.id); load(); } }
  async function delC(c: Chair) { if (confirm(`Delete ${c.name}?`)) { await api.deleteChair(c.id); load(); } }

  return (
    <div className="space-y-6">
      {/* Stylists */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div><h1 className="text-xl font-bold text-slate-900">Stylists</h1><p className="mt-0.5 text-sm text-slate-500">Your team — assign them to appointments in the schedule.</p></div>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => openS()}>Add Stylist</Button>
        </div>
        {loading ? <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          : stylists.length === 0 ? <Card padded><EmptyState icon="UserCog" title="No stylists yet" subtitle="Add your stylists to assign them to appointments." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => openS()}>Add Stylist</Button>} /></Card>
          : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stylists.map((s) => {
                const st = STY_STATUS[s.status] ?? STY_STATUS.active;
                return (
                  <Card key={s.id} padded className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><UserCog className="h-5 w-5" /></div>
                        <div><div className="text-sm font-bold text-slate-900">{s.name}</div>{s.specialty && <div className="text-xs text-slate-500">{s.specialty}</div>}</div>
                      </div>
                      <Badge color={st.color}>{st.label}</Badge>
                    </div>
                    {s.phone && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Phone className="h-3.5 w-3.5" />{s.phone}</div>}
                    <div className="mt-1 flex gap-2">
                      <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openS(s)}>Edit</Button>
                      <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => delS(s)}>Delete</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
      </div>

      {/* Chairs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-slate-900">Chairs / Stations</h2><p className="mt-0.5 text-sm text-slate-500">Track chair availability for scheduling.</p></div>
          <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => openC()}>Add Chair</Button>
        </div>
        {chairs.length === 0 ? <Card padded><EmptyState icon="Armchair" title="No chairs yet" subtitle="Add chairs/stations to assign them to appointments." action={<Button variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => openC()}>Add Chair</Button>} /></Card>
          : (
            <div className="flex flex-wrap gap-2">
              {chairs.map((c) => {
                const cs = CHAIR_STATUS[c.status] ?? CHAIR_STATUS.available;
                return (
                  <div key={c.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Armchair className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                    <Badge color={cs.color}>{cs.label}</Badge>
                    <button onClick={() => openC(c)} className="rounded p-1 text-slate-400 hover:text-slate-600"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => delC(c)} className="rounded p-1 text-slate-400 hover:text-error-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      <Modal isOpen={sOpen} onClose={() => setSOpen(false)} title={editS ? 'Edit Stylist' : 'Add Stylist'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <Input label="Name" required value={(sForm.name as string) ?? ''} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={(sForm.phone as string) ?? ''} onChange={(e) => setSForm({ ...sForm, phone: e.target.value })} />
            <Input label="Specialty" value={(sForm.specialty as string) ?? ''} onChange={(e) => setSForm({ ...sForm, specialty: e.target.value })} placeholder="Hair & Colour" />
          </div>
          <Select label="Status" value={(sForm.status as string) ?? 'active'} onChange={(e) => setSForm({ ...sForm, status: e.target.value })}>
            {Object.entries(STY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Textarea label="Notes" value={(sForm.notes as string) ?? ''} onChange={(e) => setSForm({ ...sForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSOpen(false)}>Cancel</Button><Button loading={saving} onClick={saveS}>{editS ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={cOpen} onClose={() => setCOpen(false)} title={editC ? 'Edit Chair' : 'Add Chair'} maxWidth="max-w-sm">
        <div className="space-y-3">
          <Input label="Name / Number" required value={(cForm.name as string) ?? ''} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} placeholder="Chair 1" />
          <Select label="Status" value={(cForm.status as string) ?? 'available'} onChange={(e) => setCForm({ ...cForm, status: e.target.value })}>
            {Object.entries(CHAIR_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCOpen(false)}>Cancel</Button><Button loading={saving} onClick={saveC}>{editC ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
