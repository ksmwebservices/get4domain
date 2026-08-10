'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone, Loader2, X, ThumbsUp, ThumbsDown, PhoneCall, Trophy, PhoneOff,
  Mic, Sparkles, LayoutList, Columns3, SkipForward,
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
}

/** Data source for the board — swap to point at vendor campaign leads or admin demo-booking leads. */
export interface TeleCrmAdapter {
  listLeads: () => Promise<TeleCrmLead[]>;
  getLead: (id: string) => Promise<TeleCrmLead>;
  updateLead: (id: string, data: { status?: string; notes?: string; followUpDate?: string }) => Promise<void>;
  logCall: (
    id: string,
    data: { duration?: number; outcome?: string; notes?: string; aiSummary?: string; followUpAt?: string },
  ) => Promise<void>;
  aiSummary: (data: { textNotes: string; leadName: string; callDuration?: number }) => Promise<string>;
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

const AI_SUMMARY_COST = 3;

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

function relativeContact(lead: TeleCrmLead): string {
  const last = lead.callLogs?.[0]?.createdAt;
  if (!last) return 'Never contacted';
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  if (days <= 0) return 'Contacted today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
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
}

export default function TeleCrmBoard({ adapter, title = 'TeleCRM', subtitle = 'Call leads, log outcomes, move the pipeline.' }: TeleCrmBoardProps) {
  const [leads, setLeads] = useState<TeleCrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'queue' | 'pipeline'>('queue');
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  // Call flow
  const [precall, setPrecall] = useState<TeleCrmLead | null>(null); // pre-call overlay
  const [feedbackLead, setFeedbackLead] = useState<TeleCrmLead | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [followChoice, setFollowChoice] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);

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

  const openFeedback = useCallback((lead: TeleCrmLead) => {
    setFeedbackLead(lead);
    setOutcome(null);
    setNotes('');
    setFollowChoice(null);
    setCustomDate('');
    setAiSummary('');
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

  const skip = (lead: TeleCrmLead) => {
    setSkipped((prev) => new Set(prev).add(lead.id));
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

  const runAiSummary = async () => {
    if (!feedbackLead || !notes.trim()) return;
    setSummarizing(true);
    try {
      const s = await adapter.aiSummary({ textNotes: notes, leadName: feedbackLead.name, callDuration: Math.round((Date.now() - callStartRef.current) / 1000) });
      setAiSummary(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI summary failed');
    } finally {
      setSummarizing(false);
    }
  };

  const saveFeedback = async (callNext: boolean) => {
    if (!feedbackLead) return;
    setSaving(true);
    const current = feedbackLead;
    const oc = OUTCOMES.find((o) => o.value === outcome);
    const followUpAt = followChoice ? followUpIso(followChoice, customDate) : undefined;
    try {
      const duration = Math.round((Date.now() - callStartRef.current) / 1000);
      await adapter.logCall(current.id, { duration, outcome: outcome ?? undefined, notes: notes || undefined, aiSummary: aiSummary || undefined, followUpAt });
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

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  const LeadCard = ({ lead }: { lead: TeleCrmLead }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-bold text-slate-900">{lead.name}</div>
          <div className="text-sm text-slate-500">{lead.phone}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">{lead.status || 'new'}</span>
            <span className="text-[11px] text-slate-400">{relativeContact(lead)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" fullWidth leftIcon={<Phone className="h-4 w-4" />} onClick={() => initiateCall(lead)}>Call</Button>
        <Button size="sm" variant="outline" leftIcon={<SkipForward className="h-4 w-4" />} onClick={() => skip(lead)}>Skip</Button>
      </div>
    </div>
  );

  const QueueSection = ({ label, color, items }: { label: string; color: string; items: TeleCrmLead[] }) => (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{label}</span>
        <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{items.length}</span>
      </div>
      <div className="space-y-2.5">
        {items.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
        {items.length === 0 && <p className="px-1 py-1 text-xs text-slate-400">Nothing here.</p>}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setView('queue')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'queue' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}><LayoutList className="h-4 w-4" />List</button>
          <button onClick={() => setView('pipeline')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'pipeline' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}><Columns3 className="h-4 w-4" />Kanban</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {view === 'queue' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <QueueSection label="🔴 Overdue" color="#dc2626" items={buckets.overdue} />
          <QueueSection label="🟡 Today / New" color="#f59e0b" items={[...buckets.today, ...buckets.none]} />
          <QueueSection label="🟢 Upcoming" color="#16a34a" items={buckets.upcoming} />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE.map((stage) => {
            const items = leads.filter((l) => (l.status || 'new') === stage.key);
            return (
              <div key={stage.key} className="w-64 flex-shrink-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); const lead = leads.find((l) => l.id === id); if (lead) changeStatus(lead, stage.key); }}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />{stage.label}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{items.length}</span>
                </div>
                <div className="min-h-[120px] space-y-2 rounded-xl bg-slate-50 p-2">
                  {items.map((lead) => (
                    <div key={lead.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
                      className="cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 active:cursor-grabbing">
                      <div className="text-sm font-semibold text-slate-900">{lead.name}</div>
                      <div className="text-xs text-slate-500">{lead.phone}</div>
                      <button onClick={() => initiateCall(lead)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-600"><Phone className="h-3 w-3" />Call</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-xs text-slate-500">AI call summary</span>
              <Button size="sm" variant="outline" leftIcon={<Sparkles className="h-3.5 w-3.5" />} loading={summarizing} onClick={runAiSummary} disabled={!notes.trim()}>Summarize (~₹{AI_SUMMARY_COST})</Button>
            </div>
            {aiSummary && <p className="mt-2 rounded-lg bg-primary-50 p-2.5 text-xs text-slate-700">{aiSummary}</p>}

            <div className="mt-4 space-y-2">
              <Button fullWidth loading={saving} onClick={() => saveFeedback(true)}>💾 Save &amp; Call Next →</Button>
              <button onClick={() => saveFeedback(false)} disabled={saving} className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700">Save &amp; Back to Queue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
