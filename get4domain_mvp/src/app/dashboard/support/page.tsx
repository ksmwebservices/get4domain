'use client';

import { useState } from 'react';
import { MessageCircle, Phone, Mail, CheckCircle2, ArrowRight, Sparkles, Loader2, Bot } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const categories = [
  'Technical Issue', 'Billing / Payment', 'Website Changes', 'Plan Upgrade',
  'New Module Request', 'Performance Issue', 'Other',
];

export default function SupportPage() {
  const { user } = useAuth();

  // Auto-bot (2B): the primary path. A request does NOT become a ticket unless the
  // vendor says the bot's answer didn't resolve it → then it escalates.
  const [question, setQuestion] = useState('');
  const [botAnswer, setBotAnswer] = useState('');
  const [botLoading, setBotLoading] = useState(false);
  const [botError, setBotError] = useState('');

  // Escalation → lightweight ticket for the admin escalation queue (2F).
  const [escalating, setEscalating] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [escNote, setEscNote] = useState('');

  // Direct-ticket fallback (kept — de-emphasised, not removed).
  const [showTicket, setShowTicket] = useState(false);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketDone, setTicketDone] = useState(false);
  const [error, setError] = useState('');

  const askBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setBotError(''); setBotAnswer(''); setBotLoading(true);
    try {
      const res = await api.chat({ message: question, context: 'dashboard', industry: user?.industry, vendorName: user?.businessName });
      setBotAnswer(res.data?.reply ?? 'Sorry, I could not generate an answer — please contact the team below.');
    } catch (err) {
      setBotError(err instanceof Error ? err.message : 'Could not reach the assistant. Please contact the team below.');
    } finally { setBotLoading(false); }
  };

  const escalate = async () => {
    setEscalating(true); setError('');
    try {
      await api.createTicket({
        category: 'Escalation',
        subject: question.slice(0, 80) || 'Support callback request',
        message: `Auto-bot did not resolve this. The vendor asked for the team to follow up.\n\nQuestion:\n${question}\n\nBot answer shown:\n${botAnswer}\n\nVendor note:\n${escNote || '(none)'}`,
      });
      setEscalated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send. Please WhatsApp us directly.');
    } finally { setEscalating(false); }
  };

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setTicketLoading(true);
    try {
      await api.createTicket({ category, subject, message });
      setTicketDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket. Please try again.');
    } finally { setTicketLoading(false); }
  };

  const resetAll = () => {
    setQuestion(''); setBotAnswer(''); setBotError(''); setEscalated(false); setEscNote('');
    setShowTicket(false); setCategory(''); setSubject(''); setMessage(''); setTicketDone(false); setError('');
  };

  if (escalated || ticketDone) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-100">
          <CheckCircle2 className="h-10 w-10 text-success-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{escalated ? 'Our team will call you back' : 'Ticket Raised!'}</h2>
        <p className="mt-2 text-sm text-slate-500">{escalated ? 'A team member will reach out on your registered email and WhatsApp to help resolve this.' : 'Our team will respond within 24 hours on your registered email and WhatsApp.'}</p>
        <div className="mt-6"><Button onClick={resetAll} variant="outline" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Ask something else</Button></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Support</h2>
        <p className="mt-1 text-sm text-slate-500">Get an instant answer from our assistant. If it doesn&apos;t help, we&apos;ll have the team follow up.</p>
      </div>

      {/* Quick contacts */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: MessageCircle, label: 'WhatsApp', value: '+91 98765 43210', href: 'https://wa.me/919876543210', color: 'text-success-600', bg: 'bg-success-50' },
          { icon: Phone, label: 'Call', value: '+91 98765 43210', href: 'tel:+919876543210', color: 'text-primary-600', bg: 'bg-primary-50' },
          { icon: Mail, label: 'Email', value: 'support@get4domain.com', href: 'mailto:support@get4domain.com', color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map((contact) => {
          const Icon = contact.icon;
          return (
            <a key={contact.label} href={contact.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-primary-200 hover:shadow-sm">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${contact.bg}`}><Icon className={`h-4.5 w-4.5 ${contact.color}`} /></div>
              <div><div className="text-xs font-semibold text-slate-500">{contact.label}</div><div className="truncate text-sm font-medium text-slate-900">{contact.value}</div></div>
            </a>
          );
        })}
      </div>

      {/* Auto-bot */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900"><Sparkles className="h-4 w-4 text-primary-600" /> Ask our assistant</h3>
        <form onSubmit={askBot} className="space-y-3">
          <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. How do I add a service? What does a WhatsApp message cost? How do I change my website banner?"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white text-slate-900 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          {botError && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700">{botError}</div>}
          <Button type="submit" loading={botLoading} leftIcon={<Sparkles className="h-4 w-4" />} disabled={!question.trim()}>Get an instant answer</Button>
        </form>

        {botLoading && <div className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</div>}

        {botAnswer && !botLoading && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-3 rounded-xl bg-slate-50 p-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700"><Bot className="h-4 w-4" /></div>
              <div className="whitespace-pre-line text-sm text-slate-700">{botAnswer}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-800">Did this resolve your question?</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={resetAll}>Yes, thanks</Button>
                <span className="flex-1" />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="text-sm font-medium text-slate-700">Not resolved? Have the team follow up.</div>
                <textarea rows={2} value={escNote} onChange={(e) => setEscNote(e.target.value)} placeholder="Anything to add for the team (optional)"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                {error && <div className="mt-2 rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">{error}</div>}
                <Button size="sm" className="mt-2" loading={escalating} onClick={escalate} rightIcon={<ArrowRight className="h-4 w-4" />}>No — get the team to call me back</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Direct-ticket fallback (kept) */}
      {!showTicket ? (
        <button onClick={() => setShowTicket(true)} className="text-sm font-medium text-primary-600 hover:underline">Prefer to raise a ticket directly? →</button>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="mb-5 text-base font-bold text-slate-900">Raise a Support Ticket</h3>
          {error && <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
          <form onSubmit={submitTicket} className="space-y-4">
            <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
              <option value="">Select category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input required type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of your issue" className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue in detail." className="w-full resize-none rounded-xl border border-slate-200 bg-white text-slate-900 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <Button type="submit" size="lg" fullWidth loading={ticketLoading} rightIcon={<ArrowRight className="h-4 w-4" />}>Submit Ticket</Button>
          </form>
        </div>
      )}
    </div>
  );
}
