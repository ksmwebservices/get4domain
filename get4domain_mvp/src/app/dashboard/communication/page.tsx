'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Mail, Smartphone, Send, ChevronLeft } from 'lucide-react';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';

type Channel = 'whatsapp' | 'email' | 'sms';

interface Thread {
  contactId: string;
  name: string;
  phone: string;
  email: string | null;
  lastMessage: string;
}

const CHANNELS: { key: Channel; label: string; icon: typeof Mail }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'SMS', icon: Smartphone },
];

// Email is live (Resend). WhatsApp/SMS need BSP/gateway config — show Coming Soon.
const COMING_SOON: Record<Channel, boolean> = { whatsapp: true, email: false, sms: true };
const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: 'WhatsApp Messaging', email: 'Email', sms: 'SMS Messaging' };

export default function CommunicationPage() {
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Thread | null>(null);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ text: string; mock: boolean }[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api.commThreads().then((res) => setThreads(res.data ?? [])).catch(() => setThreads([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSent([]); }, [active, channel]);

  const send = async () => {
    if (!active || !draft.trim()) return;
    const to = channel === 'email' ? (active.email ?? '') : active.phone;
    if (!to) { alert(`No ${channel === 'email' ? 'email' : 'phone'} on file for this contact.`); return; }
    setSending(true);
    try {
      const res = await api.commSend({ channel, to, message: draft, subject: subject || undefined });
      setSent((prev) => [...prev, { text: draft, mock: res.data?.mock ?? false }]);
      setDraft('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Communication Hub</h1>
        <p className="text-sm text-slate-500">Unified inbox — WhatsApp, Email &amp; SMS</p>
      </div>

      <div className="mb-4 flex w-fit rounded-xl border border-slate-200 bg-white p-1">
        {CHANNELS.map((c) => {
          const Ic = c.icon;
          return (
            <button key={c.key} onClick={() => setChannel(c.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${channel === c.key ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}>
              <Ic className="h-4 w-4" />{c.label}
              {COMING_SOON[c.key] && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">Soon</span>}
            </button>
          );
        })}
      </div>

      {COMING_SOON[channel] ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-2xl">💬</div>
          <h2 className="text-lg font-bold text-slate-900">{CHANNEL_LABEL[channel]}</h2>
          <p className="mt-2 text-sm text-slate-500">This feature is being set up for your account.</p>
          <p className="text-sm text-slate-500">You&apos;ll be notified when it&apos;s ready.</p>
          <a href="/dashboard/support" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">📞 Contact Support for Updates</a>
        </div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className={`rounded-2xl border border-slate-200 bg-white ${active ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No contacts yet.</div>
          ) : (
            <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {threads.map((t) => (
                <button key={t.contactId} onClick={() => setActive(t)}
                  className={`flex w-full items-start gap-3 p-3.5 text-left hover:bg-slate-50 ${active?.contactId === t.contactId ? 'bg-primary-50' : ''}`}>
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{t.name}</div>
                    <div className="truncate text-xs text-slate-500">{channel === 'email' ? (t.email ?? 'no email') : t.phone}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread + compose */}
        <div className={`flex min-h-[60vh] flex-col rounded-2xl border border-slate-200 bg-white ${!active ? 'hidden lg:flex' : ''}`}>
          {active ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-100 p-4">
                <button onClick={() => setActive(null)} className="text-slate-400 lg:hidden"><ChevronLeft className="h-5 w-5" /></button>
                <div>
                  <div className="text-sm font-bold text-slate-900">{active.name}</div>
                  <div className="text-xs text-slate-500">{channel === 'email' ? (active.email ?? 'no email') : active.phone}</div>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {active.lastMessage && (
                  <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2 text-sm text-slate-700">{active.lastMessage}</div>
                )}
                {sent.map((m, i) => (
                  <div key={i} className="ml-auto max-w-[75%] rounded-2xl rounded-tr-sm bg-primary-600 px-3.5 py-2 text-sm text-white">
                    {m.text}
                    {m.mock && <span className="mt-0.5 block text-[10px] text-primary-100">sent (mock — provider pending)</span>}
                  </div>
                ))}
                {!active.lastMessage && sent.length === 0 && (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">No messages yet. Start the conversation.</div>
                )}
              </div>

              <div className="border-t border-slate-100 p-3">
                {channel === 'email' && (
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
                    className="mb-2 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                )}
                <div className="flex items-end gap-2">
                  <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message via ${channel}…`}
                    className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  <Button loading={sending} onClick={send} leftIcon={<Send className="h-4 w-4" />}>Send</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Select a conversation</div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
