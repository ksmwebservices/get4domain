'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search, Plus, Phone, MessageCircle, StickyNote, Download, Loader2, X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';

interface CrmLead {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

const TABS = ['all', 'new', 'contacted', 'quoted', 'won', 'lost'];

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

function CrmPageInner() {
  const searchParams = useSearchParams();
  const sourceFilter = searchParams.get('source') ?? undefined;

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', message: '' });
  const [saving, setSaving] = useState(false);

  const [noteFor, setNoteFor] = useState<CrmLead | null>(null);
  const [noteText, setNoteText] = useState('');

  function load() {
    setLoading(true);
    api.getCrmLeads({ status: tab === 'all' ? undefined : tab, source: sourceFilter })
      .then((res) => setLeads(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load leads'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sourceFilter]);

  const filtered = leads.filter((l) =>
    !search.trim() || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
  );

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createCrmLead(addForm);
      setAddOpen(false);
      setAddForm({ name: '', phone: '', message: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add lead');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(id: string, status: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await api.updateCrmLead(id, { status });
    } catch {
      load();
    }
  }

  async function handleSaveNote() {
    if (!noteFor) return;
    try {
      await api.updateCrmLead(noteFor.id, { notes: noteText });
      setNoteFor(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save note');
    }
  }

  function exportCsv() {
    const header = ['Name', 'Phone', 'Source', 'Status', 'Message', 'Created'];
    const rows = filtered.map((l) => [l.name, l.phone, l.source ?? '', l.status, l.message ?? '', l.createdAt]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">CRM</h2>
          <p className="mt-1 text-sm text-slate-500">All leads from your page, campaigns, and manual entries.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv}>Export CSV</Button>
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddOpen(true)}>Add Lead</Button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">No leads found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <div key={lead.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">{lead.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">{lead.source ?? 'manual'}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{lead.phone} · {timeAgo(lead.createdAt)}</div>
                {lead.message && <div className="text-xs text-slate-400 mt-1 truncate max-w-md">{lead.message}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={lead.status}
                  onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 capitalize focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  {['new', 'contacted', 'quoted', 'won', 'lost'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <a href={`tel:${lead.phone}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Call"><Phone className="h-4 w-4" /></a>
                <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
                <button onClick={() => { setNoteFor(lead); setNoteText(lead.notes ?? ''); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Add note"><StickyNote className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Lead modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setAddOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleAddLead} className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Lead</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <input required placeholder="Name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <input required placeholder="Phone" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <textarea rows={2} placeholder="Notes (optional)" value={addForm.message} onChange={(e) => setAddForm({ ...addForm, message: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none" />
            <Button type="submit" fullWidth loading={saving}>Add Lead</Button>
          </form>
        </div>
      )}

      {/* Note modal */}
      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setNoteFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Note — {noteFor.name}</h3>
              <button onClick={() => setNoteFor(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none" />
            <Button fullWidth onClick={handleSaveNote}>Save Note</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}>
      <CrmPageInner />
    </Suspense>
  );
}
