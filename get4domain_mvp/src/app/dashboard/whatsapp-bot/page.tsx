'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, MessageCircle, Pencil, X, Check } from 'lucide-react';
import { api } from '@/lib/api';

interface KbEntry {
  id: string;
  question: string;
  keywords: string;
  answer: string;
  active: boolean;
}

const BLANK = { question: '', keywords: '', answer: '' };

export default function WhatsappBotPage() {
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(BLANK);

  async function load() {
    setLoading(true);
    try {
      const r = await api.getKbEntries();
      setEntries(r.data ?? []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your knowledge base.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.question.trim() || !form.keywords.trim() || !form.answer.trim()) return;
    setSaving(true);
    try {
      await api.createKbEntry(form);
      setForm(BLANK);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    await api.updateKbEntry(id, editForm).catch(() => {});
    setEditingId(null);
    await load();
  }

  async function toggle(entry: KbEntry) {
    await api.updateKbEntry(entry.id, { active: !entry.active }).catch(() => {});
    await load();
  }

  async function del(id: string) {
    await api.deleteKbEntry(id).catch(() => {});
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">WhatsApp Bot — Knowledge Base</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add the answers your bot should give on WhatsApp. The bot replies from these first;
            it only asks AI when nothing here matches — so customers get your real prices and hours.
            Interested customers are captured as leads in TeleCRM automatically.
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Add a Q&amp;A</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Topic (your reference)</label>
            <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="e.g. Pricing"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Trigger keywords (comma-separated)</label>
            <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="price, cost, charges, how much"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Answer (sent to the customer as-is)</label>
          <textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={2} placeholder="Our services start from ₹499. Would you like our team to contact you?"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <button onClick={add} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Q&amp;A
        </button>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No Q&amp;A yet. Add your common questions above (price, hours, location, services).
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {editingId === entry.id ? (
                <div className="space-y-2">
                  <input value={editForm.question} onChange={(e) => setEditForm({ ...editForm, question: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input value={editForm.keywords} onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <textarea value={editForm.answer} onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(entry.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"><Check className="h-3.5 w-3.5" /> Save</button>
                    <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"><X className="h-3.5 w-3.5" /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{entry.question}</span>
                      {!entry.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">Off</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">Triggers: {entry.keywords}</p>
                    <p className="mt-1.5 text-sm text-slate-600">{entry.answer}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => toggle(entry)} title={entry.active ? 'Turn off' : 'Turn on'} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">{entry.active ? 'On' : 'Off'}</button>
                    <button onClick={() => { setEditingId(entry.id); setEditForm({ question: entry.question, keywords: entry.keywords, answer: entry.answer }); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => del(entry.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
