'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Stethoscope, CalendarClock, Search } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import EmptyState from '@/domainapp/shared/EmptyState';

interface DoctorRef { id: string; name: string; specialty?: string }
interface Appt {
  id: string; patientName: string; startAt: string; status: string; reason?: string; diagnosis?: string;
  prescriptionNotes?: string; followUpDate?: string; doctor?: DoctorRef | null;
}

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function PrescriptionsView() {
  const [rows, setRows] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getClinicAppointments().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Prescriptions = visits that recorded a prescription (or diagnosis).
  const scripts = useMemo(
    () => rows.filter((a) => (a.prescriptionNotes?.trim() || a.diagnosis?.trim()) && a.patientName.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-bold text-slate-900">Prescriptions</h1><p className="mt-0.5 text-sm text-slate-500">Visit records with a diagnosis or prescription.</p></div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by patient…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : scripts.length === 0 ? <Card padded><EmptyState icon="FileText" title={rows.length ? 'No prescriptions yet' : 'No visits yet'} subtitle="Record a diagnosis or prescription on an appointment to see it here." /></Card>
        : (
          <div className="space-y-2">
            {scripts.map((a) => (
              <Card key={a.id} padded className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{a.patientName}</span>{a.doctor && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Stethoscope className="h-3.5 w-3.5" />{a.doctor.name}</span>}</div>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" />{fmt(a.startAt)}</span>
                </div>
                {a.diagnosis && <div className="text-sm text-slate-700"><span className="font-semibold text-slate-500">Diagnosis: </span>{a.diagnosis}</div>}
                {a.prescriptionNotes && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">{a.prescriptionNotes}</div>}
                {a.followUpDate && <div className="text-xs font-medium text-primary-600">Follow-up: {fmt(a.followUpDate)}</div>}
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
