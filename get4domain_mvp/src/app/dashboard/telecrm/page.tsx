'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Phone, SkipForward, Loader2, X, ThumbsUp, ThumbsDown, PhoneCall, Trophy, CalendarClock,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';

interface CrmLead {
  id: string;
  name: string;
  phone: string;
  status: string;
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
}

const OUTCOMES = [
  { value: 'interested', label: 'Interested', icon: ThumbsUp, color: 'bg-success-50 text-success-700 border-success-200' },
  { value: 'not_interested', label: 'Not Interested', icon: ThumbsDown, color: 'bg-error-50 text-error-700 border-error-200' },
  { value: 'callback', label: 'Callback', icon: PhoneCall, color: 'bg-warning-50 text-warning-700 border-warning-200' },
  { value: 'won', label: 'Won', icon: Trophy, color: 'bg-primary-50 text-primary-700 border-primary-200' },
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TeleCrmPage() {
  const [queue, setQueue] = useState<CrmLead[]>([]);
  const [followups, setFollowups] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeLead, setActiveLead] = useState<CrmLead | null>(null);
  const [duration, setDuration] = useState(0);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.getTelecrmQueue(), api.getTelecrmFollowups()])
      .then(([q, f]) => {
        setQueue(q.data ?? []);
        setFollowups(f.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load queue'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function startCall(lead: CrmLead) {
    setActiveLead(lead);
    setDuration(0);
    setOutcome(null);
    setNotes(lead.notes ?? '');
    setFollowUpAt('');
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }

  function closeCallModal() {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveLead(null);
  }

  function skip(id: string) {
    setQueue((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.push(item);
      return next;
    });
  }

  async function saveCallLog() {
    if (!activeLead) return;
    setSaving(true);
    try {
      await api.logCrmCall(activeLead.id, {
        duration,
        outcome: outcome ?? undefined,
        notes: notes || undefined,
        followUpAt: followUpAt || undefined,
      });
      closeCallModal();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save call log');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">TeleCRM</h2>
        <p className="mt-1 text-sm text-slate-500">Call your leads and log outcomes.</p>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Today&apos;s Call Queue</h3>
        {queue.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No calls in your queue right now.</p>
        ) : (
          <div className="space-y-3">
            {queue.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">{lead.name}</div>
                  <div className="text-xs text-slate-500">{lead.phone} · <span className="capitalize">{lead.status}</span></div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" leftIcon={<Phone className="h-3.5 w-3.5" />} onClick={() => startCall(lead)}>Call Now</Button>
                  <Button size="sm" variant="ghost" leftIcon={<SkipForward className="h-3.5 w-3.5" />} onClick={() => skip(lead.id)}>Skip</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Follow-ups Due</h3>
        {followups.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No upcoming follow-ups.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {followups.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-700">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'}
                </div>
                <div className="mt-1.5 text-sm font-bold text-slate-900">{lead.name}</div>
                <div className="text-xs text-slate-500">{lead.phone}</div>
                <Button size="sm" fullWidth className="mt-3" leftIcon={<Phone className="h-3.5 w-3.5" />} onClick={() => startCall(lead)}>Call Now</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call modal */}
      {activeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{activeLead.name}</h3>
                <p className="text-xs text-slate-500">{activeLead.phone}</p>
              </div>
              <button onClick={closeCallModal} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            <div className="text-center py-2">
              <div className="text-3xl font-bold text-primary-600 tabular-nums">{formatDuration(duration)}</div>
              <div className="text-xs text-slate-400 mt-0.5">Call duration</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((o) => {
                const Icon = o.icon;
                const active = outcome === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setOutcome(o.value)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${active ? o.color : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Icon className="h-3.5 w-3.5" />{o.label}
                  </button>
                );
              })}
            </div>

            <textarea
              rows={3}
              placeholder="Call notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
            />

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Follow-up date (optional)</label>
              <input
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            <Button fullWidth loading={saving} onClick={saveCallLog}>Save Call Log</Button>
          </div>
        </div>
      )}
    </div>
  );
}
