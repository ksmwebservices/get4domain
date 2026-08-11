'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone, Loader2, X, ThumbsUp, ThumbsDown, PhoneCall, Trophy, PhoneOff,
  Mic, Sparkles, MessageCircle, CalendarClock, Building2, Tag,
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
  // Kanban is the only view now (List removed). `skipped` still powers the
  // Call-Next queue traversal below (leads skipped during a session).
  const [skipped] = useState<Set<string>>(new Set());

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

  // Per-lead summary panel (A4): tap a card to see the lead brief + call history.
  const [detail, setDetail] = useState<TeleCrmLead | null>(null);
  const openDetail = async (lead: TeleCrmLead) => {
    setDetail(lead); // optimistic
    try { setDetail(await adapter.getLead(lead.id)); } catch { /* keep card data */ }
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

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

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
                    <button onClick={(e) => { e.stopPropagation(); initiateCall(lead); }} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-600"><Phone className="h-3 w-3" />Call</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

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
                        {cl.aiSummary && <p className="mt-1 rounded-lg bg-primary-50 p-2 text-xs text-slate-700"><Sparkles className="mr-1 inline h-3 w-3 text-primary-600" />{cl.aiSummary}</p>}
                      </div>
                    ))}
                  </div>
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
