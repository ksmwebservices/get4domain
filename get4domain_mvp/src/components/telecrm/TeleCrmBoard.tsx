'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone, Loader2, X, ThumbsUp, ThumbsDown, PhoneCall, Trophy, PhoneOff,
  Mic, MessageCircle, CalendarClock, Building2, Tag,
  Search, UserPlus, LayoutGrid, List as ListIcon, Upload, Inbox, PhoneIncoming, AlertTriangle, Users,
} from 'lucide-react';
import Button from '@/components/ui/Button';

export interface TeleCrmCallLog {
  id: string;
  outcome: string | null;
  notes: string | null;
  duration: number | null;
  aiSummary: string | null;
  createdAt: string;
}

export interface TeleCrmLead {
  id: string;
  name: string;
  phone: string;
  status: string;
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
  callLogs?: TeleCrmCallLog[];
  // Optional brief fields (present for admin demo-booking leads).
  business?: string | null;
  industry?: string | null;
  interest?: string | null;
  email?: string | null;
}

export interface TeleCrmRecentCall {
  id: string; leadId: string; name: string; phone: string;
  outcome: string | null; notes: string | null; duration: number | null; createdAt: string;
}

/** An industry-config-driven extra contact field (reuses backend recordCustomFields). */
export interface TeleCrmContactField {
  key: string; label: string; type?: 'text' | 'number' | 'date' | 'select' | 'textarea'; options?: string[]; required?: boolean;
}

/** Data source for the board — swap to point at vendor campaign leads or admin demo-booking leads. */
export interface TeleCrmAdapter {
  listLeads: () => Promise<TeleCrmLead[]>;
  getLead: (id: string) => Promise<TeleCrmLead>;
  updateLead: (id: string, data: { status?: string; notes?: string; followUpDate?: string }) => Promise<void>;
  logCall: (
    id: string,
    data: { duration?: number; outcome?: string; notes?: string; followUpAt?: string },
  ) => Promise<void>;
  // Optional — present for the vendor's own CRM (add/import a call list, recent calls).
  createLead?: (data: { name: string; phone: string; customFields?: Record<string, unknown> }) => Promise<void>;
  importLeads?: (contacts: Array<{ name: string; phone: string; customFields?: Record<string, unknown> }>) => Promise<{ imported: number }>;
  recentCalls?: () => Promise<TeleCrmRecentCall[]>;
}

const PIPELINE = [
  { key: 'new', label: 'New', color: '#64748b' },
  { key: 'contacted', label: 'Contacted', color: '#2563eb' },
  { key: 'interested', label: 'Interested', color: '#7c3aed' },
  { key: 'quoted', label: 'Quoted', color: '#f59e0b' },
  { key: 'won', label: 'Won', color: '#16a34a' },
  { key: 'lost', label: 'Lost', color: '#dc2626' },
];

const OUTCOMES = [
  { value: 'interested', label: 'Interested', icon: ThumbsUp, status: 'interested', cls: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { value: 'not_interested', label: 'Not Interested', icon: ThumbsDown, status: 'lost', cls: 'border-red-300 bg-red-50 text-red-700' },
  { value: 'callback', label: 'Callback', icon: PhoneCall, status: 'contacted', cls: 'border-amber-300 bg-amber-50 text-amber-700' },
  { value: 'won', label: 'Won', icon: Trophy, status: 'won', cls: 'border-blue-300 bg-blue-50 text-blue-700' },
  { value: 'no_answer', label: 'No Answer', icon: PhoneOff, status: 'contacted', cls: 'border-slate-300 bg-slate-50 text-slate-600' },
];


function dayBucket(followUpDate: string | null): 'overdue' | 'today' | 'upcoming' | 'none' {
  if (!followUpDate) return 'none';
  const d = new Date(followUpDate);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(startToday.getTime() + 86400000);
  if (d < startToday) return 'overdue';
  if (d < startTomorrow) return 'today';
  return 'upcoming';
}

// Follow-up quick-select → ISO date.
function followUpIso(choice: string, custom: string): string | undefined {
  const now = new Date();
  if (choice === 'tomorrow') { now.setDate(now.getDate() + 1); return now.toISOString(); }
  if (choice === '2days') { now.setDate(now.getDate() + 2); return now.toISOString(); }
  if (choice === 'week') { now.setDate(now.getDate() + 7); return now.toISOString(); }
  if (choice === 'custom' && custom) return new Date(custom).toISOString();
  return undefined;
}

interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void; start: () => void; stop: () => void;
}

interface TeleCrmBoardProps {
  adapter: TeleCrmAdapter;
  title?: string;
  subtitle?: string;
  /** Industry-specific extra contact fields (from the industry config). */
  contactFields?: TeleCrmContactField[];
  /** Singular label for a contact/lead in this industry (e.g. "Patient", "Passenger"). */
  contactNoun?: string;
}

export default function TeleCrmBoard({ adapter, title = 'TeleCRM', subtitle = 'Call your contacts, log outcomes, follow up.', contactFields = [], contactNoun = 'Contact' }: TeleCrmBoardProps) {
  const [leads, setLeads] = useState<TeleCrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skipped] = useState<Set<string>>(new Set());

  // Primary view is now the list/dialer (Kanban demoted to a secondary "Pipeline" tab).
  const [view, setView] = useState<'list' | 'pipeline'>('list');
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<TeleCrmRecentCall[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  // Call flow
  const [precall, setPrecall] = useState<TeleCrmLead | null>(null); // pre-call overlay
  const [feedbackLead, setFeedbackLead] = useState<TeleCrmLead | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [followChoice, setFollowChoice] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);

  // Per-lead summary panel (A4): tap a card to see the lead brief + call history.
  const [detail, setDetail] = useState<TeleCrmLead | null>(null);
  const openDetail = async (lead: TeleCrmLead) => {
    setDetail(lead); // optimistic
    try { setDetail(await adapter.getLead(lead.id)); } catch { /* keep card data */ }
  };
  // Schedule a follow-up reminder (no AI) — persisted on the lead's followUpDate and
  // surfaced back on the board (card badge) when it's due.
  const scheduleFollowUp = async (iso?: string) => {
    if (!detail || !iso) return;
    setDetail({ ...detail, followUpDate: iso });
    try { await adapter.updateLead(detail.id, { followUpDate: iso }); } finally { load(); }
  };

  const callStartRef = useRef<number>(0);
  const pendingFeedbackRef = useRef<TeleCrmLead | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adapter.listLeads()
      .then((data) => setLeads(data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load leads'))
      .finally(() => setLoading(false));
  }, [adapter]);

  useEffect(() => { load(); }, [load]);

  const loadRecent = useCallback(() => {
    if (!adapter.recentCalls) return;
    adapter.recentCalls().then((r) => setRecent(r ?? [])).catch(() => setRecent([]));
  }, [adapter]);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  // Search across the contact list (name or number).
  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => (l.name || '').toLowerCase().includes(q) || (l.phone || '').includes(q));
  }, [leads, search]);

  const buckets = useMemo(() => {
    const visible = leads.filter((l) => !skipped.has(l.id));
    return {
      overdue: visible.filter((l) => dayBucket(l.followUpDate) === 'overdue'),
      today: visible.filter((l) => dayBucket(l.followUpDate) === 'today'),
      upcoming: visible.filter((l) => dayBucket(l.followUpDate) === 'upcoming'),
      none: visible.filter((l) => dayBucket(l.followUpDate) === 'none'),
    };
  }, [leads, skipped]);

  // Ordered call queue (overdue → today → new → upcoming), skips filtered out.
  const queueOrder = useMemo(
    () => [...buckets.overdue, ...buckets.today, ...buckets.none, ...buckets.upcoming],
    [buckets],
  );

  // Mobile stage quick-nav: tap a stage chip to snap the Kanban to that column.
  const openFeedback = useCallback((lead: TeleCrmLead) => {
    setFeedbackLead(lead);
    setOutcome(null);
    setNotes('');
    setFollowChoice(null);
    setCustomDate('');
  }, []);

  // When the vendor returns to the tab after the dialer, show the feedback sheet.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && pendingFeedbackRef.current) {
        const lead = pendingFeedbackRef.current;
        pendingFeedbackRef.current = null;
        openFeedback(lead);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [openFeedback]);

  const initiateCall = (lead: TeleCrmLead) => {
    setFeedbackLead(null);
    setPrecall(lead);
    // Show lead info for ~1.6s, then open the dialer over the app.
    window.setTimeout(() => {
      callStartRef.current = Date.now();
      pendingFeedbackRef.current = lead;
      setPrecall(null);
      // Open feedback ready so it's there on return (robust on desktop where the
      // tab may not background); visibilitychange re-opens it on mobile return.
      openFeedback(lead);
      window.open(`tel:${lead.phone}`, '_self');
    }, 1600);
  };

  const toggleRecording = () => {
    const w = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setError('Voice capture is not supported in this browser. Type notes instead.'); return; }
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return; }
    const rec = new Ctor();
    rec.lang = 'en-IN'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i += 1) text += e.results[i][0].transcript + ' ';
      setNotes((prev) => (prev ? `${prev} ${text}`.trim() : text.trim()));
    };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec; rec.start(); setRecording(true);
  };

  const saveFeedback = async (callNext: boolean) => {
    if (!feedbackLead) return;
    setSaving(true);
    const current = feedbackLead;
    const oc = OUTCOMES.find((o) => o.value === outcome);
    const followUpAt = followChoice ? followUpIso(followChoice, customDate) : undefined;
    try {
      const duration = Math.round((Date.now() - callStartRef.current) / 1000);
      await adapter.logCall(current.id, { duration, outcome: outcome ?? undefined, notes: notes || undefined, followUpAt });
      if (oc) await adapter.updateLead(current.id, { status: oc.status, followUpDate: followUpAt });
      setFeedbackLead(null);
      const next = callNext ? queueOrder.find((l) => l.id !== current.id && !skipped.has(l.id)) : undefined;
      await load();
      if (callNext && next) initiateCall(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save call log');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (lead: TeleCrmLead, status: string) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    try { await adapter.updateLead(lead.id, { status }); } catch { load(); }
  };

  // Add / import contacts (vendor CRM only — see the consent note in the modal).
  const [addForm, setAddForm] = useState<{ name: string; phone: string; custom: Record<string, string> }>({ name: '', phone: '', custom: {} });
  const [addBusy, setAddBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const resetAdd = () => setAddForm({ name: '', phone: '', custom: {} });

  const addContact = async () => {
    if (!adapter.createLead || !addForm.name.trim() || !addForm.phone.trim()) return;
    setAddBusy(true); setError('');
    try {
      const customFields = Object.fromEntries(Object.entries(addForm.custom).filter(([, v]) => v?.trim()));
      await adapter.createLead({ name: addForm.name.trim(), phone: addForm.phone.trim(), customFields: Object.keys(customFields).length ? customFields : undefined });
      resetAdd(); setAddOpen(false); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add contact'); } finally { setAddBusy(false); }
  };

  const importCsv = async (file: File) => {
    if (!adapter.importLeads) return;
    setAddBusy(true); setImportMsg('');
    try {
      const text = await file.text();
      const rows = text.split(/\r?\n/).map((line) => line.split(',')).filter((c) => c.length >= 2);
      const contacts = rows
        .map(([name, phone]) => ({ name: (name || '').trim(), phone: (phone || '').trim() }))
        .filter((c) => c.name && c.phone && !/^name$/i.test(c.name)); // skip blanks + a header row
      if (contacts.length === 0) { setImportMsg('No valid rows found. Expected: name,phone per line.'); return; }
      const res = await adapter.importLeads(contacts);
      setImportMsg(`Imported ${res.imported} contact${res.imported === 1 ? '' : 's'} into your call list.`);
      load();
    } catch (e) { setImportMsg(e instanceof Error ? e.message : 'Import failed'); } finally { setAddBusy(false); }
  };

  const tasks = [
    ...buckets.overdue.map((l) => ({ lead: l, group: 'overdue' as const })),
    ...buckets.today.map((l) => ({ lead: l, group: 'today' as const })),
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {adapter.createLead && (
          <Button size="sm" leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => { resetAdd(); setImportMsg(''); setAddOpen(true); }}>Add {contactNoun}</Button>
        )}
      </div>

      {/* View toggle — List is the default landing view; Pipeline (Kanban) is secondary */}
      <div className="mb-4 flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {([['list', 'List', ListIcon], ['pipeline', 'Pipeline', LayoutGrid]] as const).map(([v, label, Ic]) => (
          <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>
            <Ic className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {/* ── LIST VIEW (default) ─────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="space-y-5">
          {/* Search — always visible */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${contactNoun.toLowerCase()}s by name or number…`}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>

          {/* Today's Tasks */}
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarClock className="h-4 w-4 text-amber-500" />Today&apos;s Tasks {tasks.length > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-700">{tasks.length}</span>}</h2>
            {tasks.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No follow-ups due" desc="Follow-ups you schedule after a call show up here — grouped into Overdue and Today." />
            ) : (
              <div className="space-y-2">
                {tasks.map(({ lead, group }) => (
                  <div key={lead.id} className={`flex items-center justify-between rounded-xl border p-3 ${group === 'overdue' ? 'border-error-200 bg-error-50' : 'border-amber-200 bg-amber-50'}`}>
                    <button onClick={() => openDetail(lead)} className="min-w-0 text-left">
                      <div className="text-sm font-semibold text-slate-900">{lead.name}</div>
                      <div className="flex items-center gap-1 text-xs font-medium"><span className={group === 'overdue' ? 'text-error-600' : 'text-amber-700'}>{group === 'overdue' ? 'Overdue' : 'Today'}</span><span className="text-slate-400">· {lead.phone}</span></div>
                    </button>
                    <button onClick={() => initiateCall(lead)} className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"><Phone className="h-3.5 w-3.5" />Call</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Calls */}
          {adapter.recentCalls && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><PhoneIncoming className="h-4 w-4 text-emerald-500" />Recent Calls</h2>
              {recent.length === 0 ? (
                <EmptyState icon={PhoneIncoming} title="No calls yet" desc="Your call history appears here after you make your first call and log the outcome." />
              ) : (
                <div className="space-y-2">
                  {recent.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500"><span className="capitalize">{c.outcome?.replace(/_/g, ' ') || 'Call'}</span> · {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{c.duration ? ` · ${c.duration}s` : ''}</div>
                      </div>
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-primary-600 hover:bg-slate-50"><Phone className="h-3.5 w-3.5" />Call</a>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Contact list */}
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><Users className="h-4 w-4 text-primary-500" />{contactNoun}s {leads.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{leads.length}</span>}</h2>
            {leads.length === 0 ? (
              <EmptyState icon={Inbox} title={`No ${contactNoun.toLowerCase()}s yet`} desc={`Add your first ${contactNoun.toLowerCase()} — a name and number is all it takes — to start calling and tracking.`}
                action={adapter.createLead ? { label: `Add your first ${contactNoun.toLowerCase()}`, onClick: () => { resetAdd(); setAddOpen(true); } } : undefined} />
            ) : filteredLeads.length === 0 ? (
              <EmptyState icon={Search} title="No matches" desc={`No ${contactNoun.toLowerCase()}s match “${search}”.`} />
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {filteredLeads.map((lead) => {
                  const stage = PIPELINE.find((s) => s.key === (lead.status || 'new'));
                  const last = lead.callLogs?.[0]?.createdAt ?? null;
                  return (
                    <div key={lead.id} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                      <button onClick={() => openDetail(lead)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">{lead.name}</span>
                          {stage && <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: stage.color }}>{stage.label}</span>}
                        </div>
                        <div className="text-xs text-slate-500">{lead.phone}{last ? ` · last called ${new Date(last).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</div>
                      </button>
                      <button onClick={() => initiateCall(lead)} className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"><Phone className="h-3.5 w-3.5" />Call</button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── PIPELINE VIEW (secondary — the demoted Kanban) ──────────────────── */}
      {view === 'pipeline' && (
      <>
      {leads.length === 0 && (
        <EmptyState icon={LayoutGrid} title="Your pipeline is empty" desc="As you add contacts and move them through stages, they'll appear on this board. Prefer a simple list? Switch to the List tab above." />
      )}
      {/* Kanban pipeline — gesture-native: horizontal swipe with scroll-snap and
          NO visible scrollbar (reads app-native, not webapp). `touch-action: pan-x`
          + `overscroll-x: contain` keep the swipe from fighting the PWA nav / browser
          back-swipe. On mobile each column is ~86vw so one stage fills the screen and
          you swipe between stages; desktop shows several at once. */}
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-x' }}
      >
        {PIPELINE.map((stage) => {
          const items = leads.filter((l) => (l.status || 'new') === stage.key);
          return (
            <div key={stage.key} className="w-[86vw] max-w-[20rem] flex-shrink-0 snap-start sm:w-72 lg:w-64"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); const lead = leads.find((l) => l.id === id); if (lead) changeStatus(lead, stage.key); }}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />{stage.label}</span>
                <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{items.length}</span>
              </div>
              <div className="min-h-[120px] space-y-2 rounded-xl bg-slate-50 p-2">
                {items.map((lead) => (
                  <div key={lead.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
                    onClick={() => openDetail(lead)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 hover:border-primary-300 active:cursor-grabbing">
                    <div className="text-sm font-semibold text-slate-900">{lead.name}</div>
                    <div className="text-xs text-slate-500">{lead.phone}</div>
                    {lead.followUpDate && (() => {
                      const b = dayBucket(lead.followUpDate);
                      if (b === 'none') return null;
                      const cls = b === 'overdue' ? 'bg-error-50 text-error-600' : b === 'today' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500';
                      const label = b === 'overdue' ? 'Follow-up overdue' : b === 'today' ? 'Follow-up today' : `Follow-up ${new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
                      return <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}><CalendarClock className="h-3 w-3" />{label}</span>;
                    })()}
                    <button onClick={(e) => { e.stopPropagation(); initiateCall(lead); }} className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary-600"><Phone className="h-3 w-3" />Call</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      {/* Per-lead SUMMARY panel (A4) — bottom sheet on mobile, centered on desktop */}
      {detail && (() => {
        const stage = PIPELINE.find((s) => s.key === (detail.status || 'new'));
        const logs = detail.callLogs ?? [];
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={() => setDetail(null)}>
            <div onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{detail.name}</h3>
                  <a href={`tel:${detail.phone}`} className="text-sm text-primary-600">{detail.phone}</a>
                </div>
                <div className="flex items-center gap-2">
                  {stage && <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: stage.color }}>{stage.label}</span>}
                  <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                </div>
              </div>

              {/* Brief */}
              <div className="mt-4 space-y-1.5 text-sm">
                {detail.business && <div className="flex items-center gap-2 text-slate-600"><Building2 className="h-4 w-4 text-slate-400" />{detail.business}</div>}
                {detail.industry && <div className="flex items-center gap-2 text-slate-600"><Tag className="h-4 w-4 text-slate-400" />{detail.industry}</div>}
                {detail.interest && <div className="text-slate-600"><span className="text-slate-400">Interested in:</span> {detail.interest}</div>}
                {detail.followUpDate && <div className="flex items-center gap-2 text-slate-600"><CalendarClock className="h-4 w-4 text-slate-400" />Follow-up: {new Date(detail.followUpDate).toLocaleString('en-IN')}</div>}
                {detail.notes && <div className="rounded-lg bg-slate-50 p-2.5 text-slate-600">{detail.notes}</div>}
              </div>

              {/* Call history */}
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Call history ({logs.length})</div>
                {logs.length === 0 ? (
                  <p className="text-sm text-slate-400">No calls logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((cl) => (
                      <div key={cl.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold capitalize text-slate-800">{cl.outcome?.replace(/_/g, ' ') || 'Call'}</span>
                          <span className="text-xs text-slate-400">{new Date(cl.createdAt).toLocaleDateString('en-IN')}{cl.duration ? ` · ${cl.duration}s` : ''}</span>
                        </div>
                        {cl.notes && <p className="mt-1 text-sm text-slate-600">{cl.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Follow-up reminder (no AI) */}
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Follow-up reminder</div>
                <div className="flex flex-wrap items-center gap-2">
                  {[{ k: 'tomorrow', l: 'Tomorrow' }, { k: '2days', l: 'In 2 days' }, { k: 'week', l: 'Next week' }].map((f) => (
                    <button key={f.k} onClick={() => scheduleFollowUp(followUpIso(f.k, ''))}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-primary-400 hover:text-primary-700">{f.l}</button>
                  ))}
                  <input type="date" onChange={(e) => e.target.value && scheduleFollowUp(new Date(e.target.value).toISOString())}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 focus:border-primary-400 focus:outline-none" />
                </div>
                {detail.followUpDate && (
                  <p className="mt-2 text-xs text-primary-700">Reminder set for {new Date(detail.followUpDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} — it&apos;ll flag on the board when due.</p>
                )}
              </div>

              {/* Actions */}
              <div className="mt-5 flex gap-2">
                <Button fullWidth leftIcon={<Phone className="h-4 w-4" />} onClick={() => { setDetail(null); initiateCall(detail); }}>Call</Button>
                <a href={`https://wa.me/${detail.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button fullWidth variant="outline" leftIcon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button>
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PRE-CALL overlay */}
      {precall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center">
            <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-primary-100"><Phone className="h-6 w-6 text-primary-600" /></div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Calling {precall.name}</h3>
            <a href={`tel:${precall.phone}`} className="text-sm text-primary-600">{precall.phone}</a>
            {precall.notes && <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">Last note: {precall.notes}</p>}
            <p className="mt-4 text-xs text-slate-400">Opening dialer…</p>
          </div>
        </div>
      )}

      {/* FEEDBACK sheet (bottom sheet on mobile, centered on desktop) */}
      {feedbackLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={() => setFeedbackLead(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Call with {feedbackLead.name}</h3>
              <button onClick={() => setFeedbackLead(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {OUTCOMES.map((o) => {
                const Ic = o.icon; const active = outcome === o.value;
                return (
                  <button key={o.value} onClick={() => setOutcome(o.value)}
                    className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-xs font-semibold transition-colors ${active ? o.cls : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <Ic className="h-4 w-4" />{o.label}
                  </button>
                );
              })}
            </div>

            <div className="relative mt-4">
              <textarea autoFocus rows={3} placeholder="Quick notes about the call..." value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 pr-10 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <button onClick={toggleRecording} title="Voice note" className={`absolute right-2 top-2 rounded-lg p-1.5 ${recording ? 'animate-pulse bg-error-50 text-error-600' : 'text-slate-400 hover:bg-slate-100'}`}><Mic className="h-4 w-4" /></button>
            </div>

            {outcome === 'callback' && (
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Follow-up</label>
                <div className="flex flex-wrap gap-2">
                  {[{ k: 'tomorrow', l: 'Tomorrow' }, { k: '2days', l: 'In 2 Days' }, { k: 'week', l: 'Next Week' }, { k: 'custom', l: 'Custom Date' }].map((f) => (
                    <button key={f.k} onClick={() => setFollowChoice(f.k)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${followChoice === f.k ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600'}`}>{f.l}</button>
                  ))}
                </div>
                {followChoice === 'custom' && (
                  <input type="datetime-local" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                )}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <Button fullWidth loading={saving} onClick={() => saveFeedback(true)}>💾 Save &amp; Call Next →</Button>
              <button onClick={() => saveFeedback(false)} disabled={saving} className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700">Save &amp; Back to Queue</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / IMPORT contacts (vendor CRM call list only) */}
      {addOpen && adapter.createLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={() => setAddOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add {contactNoun}</h3>
              <button onClick={() => setAddOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            {/* Single add */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
                <input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder={`${contactNoun} name`}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Phone number</label>
                <input value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91…" inputMode="tel"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              {contactFields.map((cf) => (
                <div key={cf.key}>
                  <label className="mb-1 block text-xs font-medium text-slate-500">{cf.label}</label>
                  {cf.type === 'select' && cf.options ? (
                    <select value={addForm.custom[cf.key] ?? ''} onChange={(e) => setAddForm((f) => ({ ...f, custom: { ...f.custom, [cf.key]: e.target.value } }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                      <option value="">Select…</option>
                      {cf.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'} value={addForm.custom[cf.key] ?? ''}
                      onChange={(e) => setAddForm((f) => ({ ...f, custom: { ...f.custom, [cf.key]: e.target.value } }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  )}
                </div>
              ))}
              <Button fullWidth loading={addBusy} disabled={!addForm.name.trim() || !addForm.phone.trim()} onClick={addContact}>Add to call list</Button>
            </div>

            {/* CSV import */}
            {adapter.importLeads && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="mb-1 text-sm font-semibold text-slate-800">Import a list (CSV)</div>
                <p className="mb-3 text-xs text-slate-500">One contact per line: <code className="rounded bg-slate-100 px-1">name,phone</code>. A header row is skipped automatically.</p>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm font-medium text-slate-600 hover:border-primary-400 hover:text-primary-700">
                  <Upload className="h-4 w-4" />Choose CSV file
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
                </label>
                {importMsg && <p className="mt-2 text-xs font-medium text-emerald-700">{importMsg}</p>}
              </div>
            )}

            {/* Consent boundary — this is the important labeling from the dispatch */}
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <span>These contacts go into <strong>your call list</strong> for one-to-one calling and follow-ups — <strong>not a campaign list</strong>. Uploading here does <strong>not</strong> give consent to bulk-message them by SMS, WhatsApp or email; that still needs each contact&apos;s opt-in.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Professional empty state — branded icon tile + one line + optional action. */
function EmptyState({ icon: Icon, title, desc, action }: { icon: typeof Inbox; title: string; desc: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-primary-500 shadow-sm ring-1 ring-slate-100"><Icon className="h-5 w-5" /></div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-500">{desc}</p>
      {action && <button onClick={action.onClick} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"><UserPlus className="h-3.5 w-3.5" />{action.label}</button>}
    </div>
  );
}
