'use client';

import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Loader2, Plus, Trash2, FileText, Link2, Printer, CheckCircle2, X, Settings2, Users } from 'lucide-react';
import { api } from '@/lib/api';

interface Lead {
  id: string; name: string; phone: string; email: string | null; business: string;
  interest: string; message: string | null; status: string; createdAt: string;
}
interface CatalogItem {
  id: string; label: string; description: string | null; defaultRate: number; unit: string | null; active: boolean;
}
interface ProposalItem { label: string; description?: string; qty: number; unit?: string; rate: number; notes?: string }
interface Quote {
  id: string; leadId: string | null; prospectName: string; prospectEmail: string | null; prospectPhone: string | null;
  amount: number; status: string; items: ProposalItem[] | null; shareToken: string | null; createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-300',
  sent: 'bg-warning-500/15 text-warning-300',
  viewed: 'bg-primary-600/20 text-primary-300',
  accepted: 'bg-success-500/15 text-success-300',
  declined: 'bg-error-500/15 text-error-300',
};
const STATUS_FLOW: Record<string, string> = { draft: 'sent', sent: 'accepted', accepted: 'declined', declined: 'draft' };

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600/30';

export default function ManagedServicesAdminPage() {
  const [tab, setTab] = useState<'leads' | 'proposals' | 'catalog'>('leads');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  const [builderLead, setBuilderLead] = useState<Lead | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  function loadLeads() {
    setLoadingLeads(true);
    api.getManagedServicesLeads().then((r) => setLeads(r.data ?? [])).catch(() => {}).finally(() => setLoadingLeads(false));
  }
  function loadCatalog() {
    setLoadingCatalog(true);
    api.getManagedServicesCatalog(true).then((r) => setCatalog(r.data ?? [])).catch(() => {}).finally(() => setLoadingCatalog(false));
  }
  function loadQuotes() {
    setLoadingQuotes(true);
    api.getQuotes().then((r) => setQuotes((r.data ?? []).filter((q: Quote) => q.items))).catch(() => {}).finally(() => setLoadingQuotes(false));
  }
  useEffect(() => { loadLeads(); loadCatalog(); loadQuotes(); }, []);

  const proposalsFor = (leadId: string) => quotes.filter((q) => q.leadId === leadId);

  async function cycleStatus(q: Quote) {
    const next = STATUS_FLOW[q.status] ?? 'draft';
    try {
      await api.updateQuoteStatus(q.id, next as 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined');
      setQuotes((prev) => prev.map((x) => (x.id === q.id ? { ...x, status: next } : x)));
    } catch { /* noop */ }
  }

  async function viewPdf(id: string) {
    const res = await api.getQuotePdf(id);
    const html = res.data?.html;
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Proposal</title>
      <style>@media print{body{margin:0}}body{margin:24px;background:#fff}</style></head>
      <body>${html}<script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  }

  async function copyShareLink(id: string) {
    const res = await api.shareQuote(id);
    const token = res.data?.shareToken;
    if (!token) return;
    const url = `${window.location.origin}/quote/${token}`;
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    setQuotes((prev) => prev.map((x) => (x.id === id ? { ...x, shareToken: token } : x)));
    alert(`Share link copied:\n${url}`);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-white"><Briefcase className="h-5 w-5 text-primary-400" />Managed Services</h2>
        <p className="mt-1 text-sm text-slate-400">Custom quote enquiries, proposal builder, and the editable rate catalog.</p>
      </div>

      <div className="flex rounded-xl border border-slate-700 bg-slate-800 p-1 w-fit">
        {[
          { key: 'leads' as const, label: 'Leads', icon: Users },
          { key: 'proposals' as const, label: 'Proposals', icon: FileText },
          { key: 'catalog' as const, label: 'Catalog', icon: Settings2 },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-primary-600 text-white' : 'text-slate-400'}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'leads' && (
        <div className="space-y-3">
          {loadingLeads ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
          ) : leads.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">No Managed Services enquiries yet.</div>
          ) : (
            leads.map((lead) => (
              <div key={lead.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{lead.name}</span>
                      <span className="text-xs text-slate-500">· {lead.business}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</div>
                    <div className="mt-1.5 text-sm text-slate-300">{lead.interest}</div>
                    {lead.message && <div className="mt-1 text-xs text-slate-500">{lead.message}</div>}
                    <div className="mt-1.5 text-[11px] text-slate-600">{new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <button onClick={() => { setBuilderLead(lead); setBuilderOpen(true); }}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-500">
                    <Plus className="h-3.5 w-3.5" />Create Proposal
                  </button>
                </div>
                {proposalsFor(lead.id).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                    {proposalsFor(lead.id).map((q) => (
                      <button key={q.id} onClick={() => cycleStatus(q)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[q.status] ?? STATUS_STYLE.draft}`}>
                        {inr(q.amount)} · {q.status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'proposals' && (
        <div className="space-y-2">
          {loadingQuotes ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
          ) : quotes.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">No proposals created yet.</div>
          ) : (
            quotes.map((q) => (
              <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{q.prospectName}</div>
                    <div className="text-xs text-slate-500">{q.items?.length ?? 0} line item{(q.items?.length ?? 0) === 1 ? '' : 's'} · {inr(q.amount)} · {new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => cycleStatus(q)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[q.status] ?? STATUS_STYLE.draft}`} title="Click to advance status">{q.status}</button>
                    <button onClick={() => viewPdf(q.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><Printer className="h-3.5 w-3.5" />PDF</button>
                    <button onClick={() => copyShareLink(q.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><Link2 className="h-3.5 w-3.5" />Share Link</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'catalog' && <CatalogEditor catalog={catalog} loading={loadingCatalog} reload={loadCatalog} />}

      {builderOpen && (
        <ProposalBuilder
          lead={builderLead}
          catalog={catalog.filter((c) => c.active)}
          onClose={() => setBuilderOpen(false)}
          onSaved={() => { setBuilderOpen(false); loadQuotes(); setTab('proposals'); }}
        />
      )}
    </div>
  );
}

function CatalogEditor({ catalog, loading, reload }: { catalog: CatalogItem[]; loading: boolean; reload: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<CatalogItem>>({});
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ label: '', unit: '', defaultRate: '' });
  const [saving, setSaving] = useState(false);

  function startEdit(item: CatalogItem) {
    setEditing(item.id);
    setDraft({ label: item.label, unit: item.unit ?? '', defaultRate: item.defaultRate });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await api.updateCatalogItem(id, { label: draft.label, unit: draft.unit || undefined, defaultRate: Number(draft.defaultRate) });
      setEditing(null);
      reload();
    } finally { setSaving(false); }
  }

  async function toggleActive(item: CatalogItem) {
    await api.updateCatalogItem(item.id, { active: !item.active });
    reload();
  }

  async function addItem() {
    if (!newItem.label.trim() || !newItem.defaultRate) return;
    setSaving(true);
    try {
      await api.createCatalogItem({ label: newItem.label.trim(), unit: newItem.unit.trim() || undefined, defaultRate: Math.round(parseFloat(newItem.defaultRate) * 100) });
      setNewItem({ label: '', unit: '', defaultRate: '' });
      setAdding(false);
      reload();
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Edit rates here — these are the defaults line items pre-fill with when building a proposal. Placeholder values only until you set real pricing.</p>
      {catalog.map((item) => (
        <div key={item.id} className={`rounded-xl border p-3.5 ${item.active ? 'border-slate-800 bg-slate-900' : 'border-slate-800/50 bg-slate-900/40 opacity-60'}`}>
          {editing === item.id ? (
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <input value={draft.label ?? ''} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className={inputClass} />
              <input value={draft.unit ?? ''} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="unit" className={inputClass} />
              <input type="number" value={draft.defaultRate ? draft.defaultRate / 100 : ''} onChange={(e) => setDraft({ ...draft, defaultRate: Math.round(parseFloat(e.target.value || '0') * 100) })} placeholder="₹" className={inputClass} />
              <div className="flex gap-1">
                <button onClick={() => saveEdit(item.id)} disabled={saving} className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white">Save</button>
                <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-700 px-2 py-2 text-xs text-slate-400"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="text-xs text-slate-500">{inr(item.defaultRate)}{item.unit ? ` · ${item.unit}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(item)} className="text-xs text-slate-500 hover:text-slate-300">{item.active ? 'Deactivate' : 'Activate'}</button>
                <button onClick={() => startEdit(item)} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">Edit</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-800 p-3.5 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input value={newItem.label} onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} placeholder="Line item label" className={inputClass} />
          <input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} placeholder="unit (optional)" className={inputClass} />
          <input type="number" value={newItem.defaultRate} onChange={(e) => setNewItem({ ...newItem, defaultRate: e.target.value })} placeholder="₹ rate" className={inputClass} />
          <div className="flex gap-1">
            <button onClick={addItem} disabled={saving} className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white">Add</button>
            <button onClick={() => setAdding(false)} className="rounded-lg border border-slate-700 px-2 py-2 text-xs text-slate-400"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-700 px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:border-primary-500/40 hover:text-primary-300">
          <Plus className="h-3.5 w-3.5" />Add catalog item
        </button>
      )}
    </div>
  );
}

function ProposalBuilder({ lead, catalog, onClose, onSaved }: { lead: Lead | null; catalog: CatalogItem[]; onClose: () => void; onSaved: () => void }) {
  const [prospectName, setProspectName] = useState(lead?.business ?? '');
  const [prospectPhone, setProspectPhone] = useState(lead?.phone ?? '');
  const [prospectEmail, setProspectEmail] = useState(lead?.email ?? '');
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const total = useMemo(() => items.reduce((s, i) => s + i.qty * i.rate, 0), [items]);

  function addFromCatalog(catalogId: string) {
    const c = catalog.find((x) => x.id === catalogId);
    if (!c) return;
    setItems((prev) => [...prev, { label: c.label, description: c.description ?? undefined, qty: 1, unit: c.unit ?? undefined, rate: c.defaultRate }]);
  }
  function addCustom() {
    setItems((prev) => [...prev, { label: '', qty: 1, rate: 0 }]);
  }
  function updateItem(i: number, patch: Partial<ProposalItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setError('');
    if (!prospectName.trim()) { setError('Enter the client/business name.'); return; }
    if (items.length === 0) { setError('Add at least one line item.'); return; }
    if (items.some((i) => !i.label.trim())) { setError('Every line item needs a label.'); return; }
    setSaving(true);
    try {
      await api.createProposal({
        leadId: lead?.id,
        prospectName: prospectName.trim(),
        prospectPhone: prospectPhone.trim() || undefined,
        prospectEmail: prospectEmail.trim() || undefined,
        items,
        notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save proposal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">New Proposal{lead ? ` — ${lead.name}` : ''}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {error && <div className="mb-3 rounded-xl border border-error-500/40 bg-error-500/10 px-4 py-2.5 text-sm text-error-300">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-3">
          <input value={prospectName} onChange={(e) => setProspectName(e.target.value)} placeholder="Client / business name" className={inputClass} />
          <input value={prospectPhone} onChange={(e) => setProspectPhone(e.target.value)} placeholder="Phone" className={inputClass} />
          <input value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} placeholder="Email" className={inputClass} />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Line items</p>
            <select onChange={(e) => { if (e.target.value) { addFromCatalog(e.target.value); e.target.value = ''; } }} className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300">
              <option value="">+ Add from catalog…</option>
              {catalog.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <div className="grid gap-2 sm:grid-cols-[2fr_80px_90px_110px_auto]">
                  <input value={item.label} onChange={(e) => updateItem(i, { label: e.target.value })} placeholder="Label" className={inputClass} />
                  <input type="number" min={1} value={item.qty} onChange={(e) => updateItem(i, { qty: Math.max(1, parseInt(e.target.value) || 1) })} className={inputClass} />
                  <input value={item.unit ?? ''} onChange={(e) => updateItem(i, { unit: e.target.value })} placeholder="unit" className={inputClass} />
                  <input type="number" value={item.rate / 100} onChange={(e) => updateItem(i, { rate: Math.round(parseFloat(e.target.value || '0') * 100) })} placeholder="₹ rate" className={inputClass} />
                  <button onClick={() => removeItem(i)} className="flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <input value={item.notes ?? ''} onChange={(e) => updateItem(i, { notes: e.target.value })} placeholder="Line notes (optional)" className={`${inputClass} mt-2`} />
                <div className="mt-1 text-right text-xs text-slate-500">{inr(item.qty * item.rate)}</div>
              </div>
            ))}
          </div>
          <button onClick={addCustom} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-primary-500/40 hover:text-primary-300">
            <Plus className="h-3.5 w-3.5" />Custom line item
          </button>
        </div>

        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes shown on the proposal (optional)" className={`${inputClass} mt-4 resize-none`} />

        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-800/60 px-4 py-3">
          <span className="text-sm text-slate-400">Total (incl. 18% GST)</span>
          <span className="text-lg font-bold text-white">{inr(Math.round(total * 1.18))}</span>
        </div>

        <button onClick={save} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Save Draft Proposal
        </button>
      </div>
    </div>
  );
}
