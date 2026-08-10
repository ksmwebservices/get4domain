'use client';

import { useEffect, useState } from 'react';
import { FileSignature, Loader2, Sparkles, Send, Mail, MessageCircle, Smartphone, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Vendor { id: string; name: string; businessName: string; email: string; phone: string | null }
interface Quote {
  id: string;
  prospectName: string;
  itemLabel: string;
  amount: number;
  channel: string;
  status: 'sent' | 'viewed' | 'accepted';
  createdAt: string;
}

type QuoteType = 'domainapp_plan' | 'domaincampaign_wallet' | 'custom';
type Channel = 'email' | 'whatsapp' | 'sms';

const QUOTE_TYPES: { key: QuoteType; label: string }[] = [
  { key: 'domainapp_plan', label: 'DomainApp Plan' },
  { key: 'domaincampaign_wallet', label: 'DomainCampaign Wallet' },
  { key: 'custom', label: 'Custom' },
];

const CHANNELS: { key: Channel; label: string; icon: typeof Mail }[] = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'sms', label: 'SMS', icon: Smartphone },
];

const STATUS_STYLE: Record<Quote['status'], string> = {
  sent: 'bg-slate-500/15 text-slate-300',
  viewed: 'bg-primary-600/20 text-primary-300',
  accepted: 'bg-success-500/15 text-success-300',
};

export default function SendQuotePage() {
  const [mode, setMode] = useState<'vendor' | 'prospect'>('prospect');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [prospect, setProspect] = useState({ name: '', phone: '', email: '' });
  const [quoteType, setQuoteType] = useState<QuoteType>('domainapp_plan');
  const [itemLabel, setItemLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [message, setMessage] = useState('');

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600/30';

  function loadQuotes() {
    setLoadingQuotes(true);
    api.getQuotes()
      .then((res) => setQuotes(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingQuotes(false));
  }

  useEffect(() => {
    loadQuotes();
    api.getVendors().then((res) => setVendors(res.data ?? [])).catch(() => {});
  }, []);

  const selectedVendor = vendors.find((v) => v.id === vendorId);
  const prospectName = mode === 'vendor' ? (selectedVendor?.businessName ?? selectedVendor?.name ?? '') : prospect.name;

  async function handleGenerate() {
    setError('');
    if (!itemLabel) { setError('Enter what is being quoted first.'); return; }
    setGenerating(true);
    try {
      const res = await api.generateAiContent({
        channel: channel === 'email' ? 'email' : channel === 'whatsapp' ? 'whatsapp' : 'sms',
        vendorIndustry: selectedVendor ? 'general' : 'general',
        offerDetails: `Quote for ${itemLabel}${amount ? ` at ₹${amount}` : ''} to ${prospectName || 'a prospect'}. ${notes}`,
        tone: 'Professional',
      });
      const caption = res.data?.caption ?? res.data?.content ?? res.data?.text ?? '';
      setMessage(String(caption));
    } catch (err) {
      setError(err instanceof Error ? `AI copy unavailable (${err.message}). You can type the quote manually.` : 'AI copy unavailable.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const amt = Math.round(parseFloat(amount) * 100);
    if (!prospectName) { setError('Select a vendor or enter a prospect name.'); return; }
    if (!itemLabel) { setError('Enter what is being quoted.'); return; }
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return; }
    if (!message.trim()) { setError('Enter or generate the quote message.'); return; }
    setSending(true);
    try {
      await api.createQuote({
        vendorId: mode === 'vendor' ? vendorId || undefined : undefined,
        prospectName,
        prospectPhone: mode === 'prospect' ? prospect.phone || undefined : selectedVendor?.phone ?? undefined,
        prospectEmail: mode === 'prospect' ? prospect.email || undefined : selectedVendor?.email,
        quoteType,
        itemLabel,
        amount: amt,
        notes: notes || undefined,
        channel,
        message,
        subject: `Quote from Get4Domain — ${itemLabel}`,
      });
      setOk('Quote sent and logged.');
      setItemLabel(''); setAmount(''); setNotes(''); setMessage('');
      setProspect({ name: '', phone: '', email: '' });
      loadQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send quote');
    } finally {
      setSending(false);
    }
  }

  async function cycleStatus(q: Quote) {
    const next: Quote['status'] = q.status === 'sent' ? 'viewed' : q.status === 'viewed' ? 'accepted' : 'sent';
    try {
      await api.updateQuoteStatus(q.id, next);
      setQuotes((prev) => prev.map((x) => (x.id === q.id ? { ...x, status: next } : x)));
    } catch { /* noop */ }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-white"><FileSignature className="h-5 w-5 text-primary-400" />Send Quote</h2>
        <p className="mt-1 text-sm text-slate-400">Quote an existing vendor or a new prospect and send it over Email, WhatsApp or SMS.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Form */}
        <form onSubmit={handleSend} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          {error && <div className="rounded-xl border border-error-500/40 bg-error-500/10 px-4 py-3 text-sm text-error-300">{error}</div>}
          {ok && <div className="flex items-center gap-2 rounded-xl border border-success-500/40 bg-success-500/10 px-4 py-3 text-sm text-success-300"><CheckCircle2 className="h-4 w-4" />{ok}</div>}

          {/* Recipient mode */}
          <div className="flex rounded-xl border border-slate-700 bg-slate-800 p-1">
            <button type="button" onClick={() => setMode('prospect')} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${mode === 'prospect' ? 'bg-primary-600 text-white' : 'text-slate-400'}`}>New Prospect</button>
            <button type="button" onClick={() => setMode('vendor')} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${mode === 'vendor' ? 'bg-primary-600 text-white' : 'text-slate-400'}`}>Existing Vendor</button>
          </div>

          {mode === 'vendor' ? (
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputClass}>
              <option value="">Select a vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.businessName} ({v.email})</option>)}
            </select>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <input placeholder="Name" value={prospect.name} onChange={(e) => setProspect({ ...prospect, name: e.target.value })} className={inputClass} />
              <input placeholder="Phone" value={prospect.phone} onChange={(e) => setProspect({ ...prospect, phone: e.target.value })} className={inputClass} />
              <input placeholder="Email" value={prospect.email} onChange={(e) => setProspect({ ...prospect, email: e.target.value })} className={inputClass} />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Quoting</label>
              <select value={quoteType} onChange={(e) => setQuoteType(e.target.value as QuoteType)} className={inputClass}>
                {QUOTE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Amount (₹)</label>
              <input type="number" min="0" step="1" placeholder="24999" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </div>
          </div>

          <input placeholder="What is being quoted (e.g. DomainApp Enterprise — annual)" value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} className={inputClass} />

          <textarea rows={2} placeholder="Internal notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400">Quote message</label>
              <button type="button" onClick={handleGenerate} disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-500/40 px-2.5 py-1 text-xs font-semibold text-primary-300 hover:bg-primary-600/10 disabled:opacity-60">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Generate with AI
              </button>
            </div>
            <textarea rows={5} placeholder="Write the quote message, or generate it with AI…" value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Send via</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((c) => {
                const Ic = c.icon;
                const active = channel === c.key;
                return (
                  <button type="button" key={c.key} onClick={() => setChannel(c.key)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold ${active ? 'border-primary-500 bg-primary-600/15 text-primary-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                    <Ic className="h-4 w-4" />{c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={sending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send Quote
          </button>
        </form>

        {/* Sent quotes */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">Sent Quotes</h3>
          {loadingQuotes ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
          ) : quotes.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-500">No quotes sent yet.</div>
          ) : (
            <div className="space-y-2">
              {quotes.map((q) => (
                <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{q.prospectName}</div>
                      <div className="truncate text-xs text-slate-500">{q.itemLabel} · ₹{(q.amount / 100).toLocaleString('en-IN')} · {q.channel}</div>
                    </div>
                    <button onClick={() => cycleStatus(q)} title="Click to change status"
                      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[q.status]}`}>
                      {q.status}
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">{new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-600">Tip: click a status chip to cycle sent → viewed → accepted.</p>
        </div>
      </div>
    </div>
  );
}
