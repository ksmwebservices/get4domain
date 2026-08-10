'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Phone, Loader2, X, ThumbsUp, ThumbsDown, PhoneCall, Trophy, PhoneOff,
  CalendarClock, Mic, Sparkles, LayoutList, Columns3, Clock, ChevronLeft,
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

/**
 * Data source for the TeleCRM board. Swap this to point the same UI at a
 * different backend (vendor campaign leads vs. admin demo-booking leads).
 */
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
  { key: 'qualified', label: 'Qualified', color: '#7c3aed' },
  { key: 'quoted', label: 'Quoted', color: '#f59e0b' },
  { key: 'won', label: 'Won', color: '#16a34a' },
  { key: 'lost', label: 'Lost', color: '#dc2626' },
];

const OUTCOMES = [
  { value: 'interested', label: 'Interested', icon: ThumbsUp },
  { value: 'not_interested', label: 'Not Interested', icon: ThumbsDown },
  { value: 'callback', label: 'Callback', icon: PhoneCall },
  { value: 'won', label: 'Won', icon: Trophy },
  { value: 'no_answer', label: 'No Answer', icon: PhoneOff },
];

const AI_SUMMARY_COST = 3;

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

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

// Minimal typing for the optional Web Speech API (voice-note transcription).
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
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

  const [selected, setSelected] = useState<TeleCrmLead | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  // Call modal
  const [inCall, setInCall] = useState(false);
  const [duration, setDuration] = useState(0);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [callNotes, setCallNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adapter.listLeads()
      .then((data) => setLeads(data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load leads'))
      .finally(() => setLoading(false));
  }, [adapter]);

  useEffect(() => { load(); }, [load]);

  const selectLead = async (lead: TeleCrmLead) => {
    setSelected(lead);
    setNotesDraft(lead.notes ?? '');
    try {
      const full = await adapter.getLead(lead.id);
      setSelected(full ?? lead);
    } catch { /* keep summary lead */ }
  };

  const changeStatus = async (status: string) => {
    if (!selected) return;
    setStatusSaving(true);
    try {
      await adapter.updateLead(selected.id, { status });
      setSelected({ ...selected, status });
      setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, status } : l)));
    } finally {
      setStatusSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    await adapter.updateLead(selected.id, { notes: notesDraft });
    setSelected({ ...selected, notes: notesDraft });
  };

  const startCall = (lead: TeleCrmLead) => {
    setSelected(lead);
    setInCall(true);
    setDuration(0);
    setOutcome(null);
    setCallNotes('');
    setFollowUpAt('');
    setAiSummary('');
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };

  const endCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* noop */ } }
    setInCall(false);
    setRecording(false);
  };

  const toggleRecording = () => {
    const w = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError('Voice capture is not supported in this browser. Type notes instead.');
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i += 1) text += e.results[i][0].transcript + ' ';
      setCallNotes((prev) => (prev ? `${prev} ${text}`.trim() : text.trim()));
    };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const runAiSummary = async () => {
    if (!selected || !callNotes.trim()) return;
    setSummarizing(true);
    try {
      const summary = await adapter.aiSummary({ textNotes: callNotes, leadName: selected.name, callDuration: duration });
      setAiSummary(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI summary failed');
    } finally {
      setSummarizing(false);
    }
  };

  const saveCallLog = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adapter.logCall(selected.id, {
        duration,
        outcome: outcome ?? undefined,
        notes: callNotes || undefined,
        aiSummary: aiSummary || undefined,
        followUpAt: followUpAt || undefined,
      });
      endCall();
      load();
      selectLead(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save call log');
    } finally {
      setSaving(false);
    }
  };

  // Drag & drop for pipeline
  const onDrop = async (status: string, e: React.DragEvent) => {
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try { await adapter.updateLead(id, { status }); } catch { load(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  const buckets = {
    overdue: leads.filter((l) => dayBucket(l.followUpDate) === 'overdue'),
    today: leads.filter((l) => dayBucket(l.followUpDate) === 'today'),
    upcoming: leads.filter((l) => dayBucket(l.followUpDate) === 'upcoming'),
    none: leads.filter((l) => dayBucket(l.followUpDate) === 'none'),
  };

  const QueueSection = ({ title: sectionTitle, color, items }: { title: string; color: string; items: TeleCrmLead[] }) => (
    <div>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{sectionTitle}</span>
        <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{items.length}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((lead) => (
          <button key={lead.id} onClick={() => selectLead(lead)}
            className={`w-full rounded-xl border p-3 text-left transition-colors ${selected?.id === lead.id ? 'border-primary-300 bg-primary-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <div className="text-sm font-semibold text-slate-900">{lead.name}</div>
            <div className="text-xs text-slate-500">{lead.phone}</div>
          </button>
        ))}
        {items.length === 0 && <p className="px-1 py-2 text-xs text-slate-400">Nothing here.</p>}
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
          <button onClick={() => setView('queue')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'queue' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}><LayoutList className="h-4 w-4" />Queue</button>
          <button onClick={() => setView('pipeline')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'pipeline' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}><Columns3 className="h-4 w-4" />Pipeline</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {view === 'queue' ? (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr_300px]">
          {/* Left: Queue */}
          <div className={`space-y-4 ${selected ? 'hidden lg:block' : ''}`}>
            <QueueSection title="Overdue" color="#dc2626" items={buckets.overdue} />
            <QueueSection title="Today" color="#f59e0b" items={buckets.today} />
            <QueueSection title="Upcoming" color="#16a34a" items={buckets.upcoming} />
            <QueueSection title="New / No follow-up" color="#64748b" items={buckets.none} />
          </div>

          {/* Center: Lead detail */}
          <div className={`${!selected ? 'hidden lg:block' : ''}`}>
            {selected ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <button onClick={() => setSelected(null)} className="mb-3 flex items-center gap-1 text-sm text-slate-500 lg:hidden"><ChevronLeft className="h-4 w-4" />Back</button>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                    <a href={`tel:${selected.phone}`} className="text-sm text-primary-600">{selected.phone}</a>
                  </div>
                  <Button leftIcon={<Phone className="h-4 w-4" />} onClick={() => startCall(selected)}>Call</Button>
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Status</label>
                  <select value={selected.status} disabled={statusSaving} onChange={(e) => changeStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                    {PIPELINE.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Notes</label>
                  <textarea rows={4} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} onBlur={saveNotes}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
                Select a lead to see details
              </div>
            )}
          </div>

          {/* Right: Activity timeline */}
          <div className={`${!selected ? 'hidden lg:block' : ''}`}>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900"><Clock className="h-4 w-4 text-slate-400" />Activity</h3>
              {selected?.callLogs && selected.callLogs.length > 0 ? (
                <div className="space-y-3">
                  {selected.callLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-primary-200 pl-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold capitalize text-slate-700">{log.outcome?.replace('_', ' ') ?? 'Call'}</span>
                        <span className="text-[11px] text-slate-400">{new Date(log.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                      {log.duration != null && <div className="text-[11px] text-slate-400">{formatDuration(log.duration)}</div>}
                      {log.aiSummary && <p className="mt-1 rounded-lg bg-primary-50 p-2 text-xs text-slate-600">{log.aiSummary}</p>}
                      {log.notes && !log.aiSummary && <p className="mt-1 text-xs text-slate-600">{log.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No calls logged yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Pipeline Kanban */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE.map((stage) => {
            const items = leads.filter((l) => (l.status || 'new') === stage.key);
            return (
              <div key={stage.key} className="w-64 flex-shrink-0"
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(stage.key, e)}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />{stage.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{items.length}</span>
                </div>
                <div className="min-h-[120px] space-y-2 rounded-xl bg-slate-50 p-2">
                  {items.map((lead) => (
                    <div key={lead.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
                      onClick={() => { setView('queue'); selectLead(lead); }}
                      className="cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 active:cursor-grabbing">
                      <div className="text-sm font-semibold text-slate-900">{lead.name}</div>
                      <div className="text-xs text-slate-500">{lead.phone}</div>
                      {lead.followUpDate && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-warning-600">
                          <CalendarClock className="h-3 w-3" />{new Date(lead.followUpDate).toLocaleDateString('en-IN')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Call modal */}
      {inCall && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selected.name}</h3>
                <a href={`tel:${selected.phone}`} className="text-xs text-primary-600">{selected.phone} · tap to dial</a>
              </div>
              <button onClick={endCall} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            <div className="py-1 text-center">
              <div className="text-3xl font-bold tabular-nums text-primary-600">{formatDuration(duration)}</div>
              <div className="mt-0.5 text-xs text-slate-400">Call duration</div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {OUTCOMES.map((o) => {
                const Ic = o.icon;
                const active = outcome === o.value;
                return (
                  <button key={o.value} onClick={() => setOutcome(o.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition-colors ${active ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <Ic className="h-4 w-4" />{o.label}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <textarea rows={3} placeholder="Call notes… (or use voice)" value={callNotes} onChange={(e) => setCallNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 pr-10 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <button onClick={toggleRecording} title="Voice note"
                className={`absolute right-2 top-2 rounded-lg p-1.5 ${recording ? 'bg-error-50 text-error-600 animate-pulse' : 'text-slate-400 hover:bg-slate-100'}`}>
                <Mic className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-xs text-slate-500">AI call summary</span>
              <Button size="sm" variant="outline" leftIcon={<Sparkles className="h-3.5 w-3.5" />} loading={summarizing}
                onClick={runAiSummary} disabled={!callNotes.trim()}>Summarize (~₹{AI_SUMMARY_COST})</Button>
            </div>
            {aiSummary && <p className="rounded-lg bg-primary-50 p-2.5 text-xs text-slate-700">{aiSummary}</p>}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Follow-up (optional)</label>
              <input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>

            <Button fullWidth loading={saving} onClick={saveCallLog}>Save Call Log</Button>
          </div>
        </div>
      )}
    </div>
  );
}
