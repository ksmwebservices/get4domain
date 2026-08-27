'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  MessageCircle, Mail, Smartphone, Send, ChevronLeft, Inbox, Settings2,
  Loader2, Save, ShieldCheck, ShieldAlert, Clock,
} from 'lucide-react';
import { api, type VendorCommsSettings, type VendorCommsPatch } from '@/lib/api';
import Button from '@/components/ui/Button';

// Single Communication Hub — a real unified inbox + real self-service channel
// settings, replacing the two previously-separate pages (the old inbox stub and
// the standalone Comms Settings). Dark vendor-ui theme; shared across all industries.
export default function CommunicationHubPage() {
  const [view, setView] = useState<'inbox' | 'settings'>('inbox');

  return (
    <div className="vendor-ui -m-5 min-h-[calc(100vh-4rem)] bg-ink-950 bg-radial-glow p-5 text-ink-100 lg:-m-8 lg:p-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Communication Hub</h1>
        <p className="text-sm text-slate-500">One place for your WhatsApp, Email &amp; SMS — messages and settings.</p>
      </div>

      <div className="mb-5 flex w-fit rounded-xl border border-slate-200 bg-white p-1">
        {([['inbox', 'Inbox', Inbox], ['settings', 'Settings', Settings2]] as const).map(([k, label, Ic]) => (
          <button key={k} onClick={() => setView(k)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === k ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>
            <Ic className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {view === 'inbox' ? <InboxTab onConfigure={() => setView('settings')} /> : <SettingsTab />}
    </div>
  );
}

// ── Inbox ─────────────────────────────────────────────────────────────────────
type Channel = 'whatsapp' | 'email' | 'sms';
interface Thread { contactId: string; name: string; phone: string; email: string | null; lastMessage: string }
interface Msg { id: string; direction: 'out' | 'in'; subject: string | null; body: string; status: string; createdAt: string }

const CHANNELS: { key: Channel; label: string; icon: typeof Mail }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'SMS', icon: Smartphone },
];
// Email is live (Resend). WhatsApp/SMS outbound needs the channel configured first.
const NEEDS_SETUP: Record<Channel, boolean> = { whatsapp: true, email: false, sms: true };
const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: 'WhatsApp Messaging', email: 'Email', sms: 'SMS Messaging' };

function InboxTab({ onConfigure }: { onConfigure: () => void }) {
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Thread | null>(null);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api.commThreads().then((res) => setThreads(res.data ?? [])).catch(() => setThreads([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadHistory = useCallback(() => {
    if (!active) { setMessages([]); return; }
    api.commHistory(active.contactId, channel).then((res) => setMessages(res.data ?? [])).catch(() => setMessages([]));
  }, [active, channel]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const send = async () => {
    if (!active || !draft.trim()) return;
    const to = channel === 'email' ? (active.email ?? '') : active.phone;
    if (!to) { alert(`No ${channel === 'email' ? 'email' : 'phone'} on file for this contact.`); return; }
    setSending(true);
    try {
      await api.commSend({ channel, to, message: draft, subject: subject || undefined, contactId: active.contactId });
      setDraft('');
      loadHistory();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex w-fit rounded-xl border border-slate-200 bg-white p-1">
        {CHANNELS.map((c) => {
          const Ic = c.icon;
          return (
            <button key={c.key} onClick={() => setChannel(c.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${channel === c.key ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}>
              <Ic className="h-4 w-4" />{c.label}
              {NEEDS_SETUP[c.key] && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">Setup</span>}
            </button>
          );
        })}
      </div>

      {NEEDS_SETUP[channel] ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            {channel === 'whatsapp' ? <MessageCircle className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
          </div>
          <h2 className="text-lg font-bold text-slate-900">{CHANNEL_LABEL[channel]}</h2>
          <p className="mt-2 text-sm text-slate-500">Set up your {channel === 'whatsapp' ? 'WhatsApp number' : 'SMS sender'} to start sending. Incoming messages are still saved.</p>
          <button onClick={onConfigure} className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            <Settings2 className="h-4 w-4" />Configure in Settings
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
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
                  {messages.map((m) => (
                    m.direction === 'out' ? (
                      <div key={m.id} className="ml-auto max-w-[75%] rounded-2xl rounded-tr-sm bg-primary-600 px-3.5 py-2 text-sm text-white">
                        {m.subject && <div className="mb-0.5 text-[11px] font-semibold text-primary-100">{m.subject}</div>}
                        {m.body}
                        <span className="mt-0.5 block text-[10px] text-primary-100">
                          {new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {m.status === 'mock' ? ' · mock (provider pending)' : m.status === 'failed' ? ' · failed' : ' · sent'}
                        </span>
                      </div>
                    ) : (
                      <div key={m.id} className="max-w-[75%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2 text-sm text-slate-700">
                        {m.body}
                        <span className="mt-0.5 block text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )
                  ))}
                  {messages.length === 0 && (
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
                    <Button skin="dark" loading={sending} onClick={send} leftIcon={<Send className="h-4 w-4" />}>Send</Button>
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

// ── Settings ────────────────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

function SettingsTab() {
  const [settings, setSettings] = useState<VendorCommsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMyCommsSettings()
      .then((r) => setSettings(r.data ?? null))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your communication settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof VendorCommsSettings>(key: K, value: VendorCommsSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null);

  async function save() {
    if (!settings) return;
    setSaving(true); setSaved(false); setError('');
    const payload: VendorCommsPatch = {
      waEnabled: settings.waEnabled,
      waPhoneNumberId: blankToNull(settings.waPhoneNumberId),
      waDisplayNumber: blankToNull(settings.waDisplayNumber),
      waTemplateId: blankToNull(settings.waTemplateId),
      waGreeting: blankToNull(settings.waGreeting),
      smsBusinessName: blankToNull(settings.smsBusinessName),
      emailFromName: blankToNull(settings.emailFromName),
      emailReplyTo: blankToNull(settings.emailReplyTo),
    };
    try {
      const r = await api.updateMyCommsSettings(payload);
      setSettings(r.data ?? settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (!settings) return <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error || 'Not available.'}</div>;

  return (
    <div className="max-w-3xl space-y-6">
      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {/* WhatsApp — full self-service */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><MessageCircle className="h-5 w-5" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">WhatsApp — your own number</h2>
              <p className="mt-0.5 text-xs text-slate-500">Messages go out from your business&apos;s own WhatsApp number, not ours.</p>
            </div>
          </div>
          <WaStatusBadge status={settings.waStatus} />
        </div>

        <label className="mt-4 flex items-center gap-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={settings.waEnabled} onChange={(e) => set('waEnabled', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-400" />
          WhatsApp channel is on
          <span className="text-xs text-slate-400">(turn off and the bot stops replying — incoming messages are still saved)</span>
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">WhatsApp number (display)</label>
            <input className={inputCls} placeholder="+91 98765 43210" value={settings.waDisplayNumber ?? ''} onChange={(e) => set('waDisplayNumber', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Provider number ID</label>
            <input className={inputCls} placeholder="1122334455" value={settings.waPhoneNumberId ?? ''} onChange={(e) => set('waPhoneNumberId', e.target.value)} />
            <p className="mt-1 text-[11px] text-slate-400">From your WhatsApp Business provider. This routes incoming messages to your account — changing it needs a fresh verification by our team.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Your message template ID (optional)</label>
            <input className={inputCls} placeholder="Leave blank to use ours" value={settings.waTemplateId ?? ''} onChange={(e) => set('waTemplateId', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Bot greeting (optional)</label>
            <input className={inputCls} placeholder={`Thanks for messaging ${settings.businessName}!`} value={settings.waGreeting ?? ''} onChange={(e) => set('waGreeting', e.target.value)} />
          </div>
        </div>
      </section>

      {/* SMS — branding only */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Smartphone className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">SMS — your business name</h2>
            <p className="mt-0.5 text-xs text-slate-500">SMS in India goes out on a TRAI-registered (DLT) sender ID that we hold for the platform. You can&apos;t be given a separate one without your own DLT registration — but your business name goes inside every message, so customers know it&apos;s you.</p>
          </div>
        </div>
        <div className="mt-4 sm:max-w-sm">
          <label className="mb-1 block text-xs font-medium text-slate-600">Business name shown in SMS</label>
          <input className={inputCls} placeholder={settings.businessName} value={settings.smsBusinessName ?? ''} onChange={(e) => set('smsBusinessName', e.target.value)} />
          <p className="mt-1 text-[11px] text-slate-400">Blank uses your account name, {settings.businessName}.</p>
        </div>
      </section>

      {/* Email — branding only */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Mail className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Email — your sender name</h2>
            <p className="mt-0.5 text-xs text-slate-500">Email is sent from our verified sending domain so it reliably reaches the inbox. The address stays ours, but the name your customer sees is yours — and their replies come straight to you.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">From name</label>
            <input className={inputCls} placeholder={settings.businessName} value={settings.emailFromName ?? ''} onChange={(e) => set('emailFromName', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Replies go to</label>
            <input className={inputCls} type="email" placeholder="you@yourbusiness.com" value={settings.emailReplyTo ?? ''} onChange={(e) => set('emailReplyTo', e.target.value)} />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Customers will see: <span className="font-medium text-slate-500">{(settings.emailFromName || settings.businessName).trim()}</span> &lt;our verified address&gt;</p>
      </section>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-sm font-medium text-success-600">✓ Saved</span>}
      </div>
    </div>
  );
}

function WaStatusBadge({ status }: { status: string }) {
  if (status === 'verified') return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700"><ShieldCheck className="h-3.5 w-3.5" /> Verified</span>;
  if (status === 'pending') return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"><Clock className="h-3.5 w-3.5" /> Awaiting verification</span>;
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500"><ShieldAlert className="h-3.5 w-3.5" /> Not set up</span>;
}
