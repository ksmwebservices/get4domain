'use client';

import { useState } from 'react';
import { Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { STEPNROCK_SUBDOMAIN } from '@/lib/site-data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', message: '' });

  // Posts to the platform's public engine.enquiry action, which lands the enquiry in this store's
  // CRM call list (same backend as checkout). Previously this only wrote to browser state.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/engine/public/${STEPNROCK_SUBDOMAIN}/actions/engine.enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim(), message: form.message.trim() || undefined, industry: 'retail' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Could not send your enquiry.');
      const lead = (json.data ?? json) as { id?: string };
      setTicketId(lead.id ? lead.id.slice(-8).toUpperCase() : null);
      setSubmitted(true);
      setForm({ name: '', phone: '', message: '' });
      setTimeout(() => setSubmitted(false), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your enquiry.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-background border border-border rounded-3xl p-8 space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold mb-1">Send an enquiry</h2>
        <p className="text-sm text-muted-foreground">Fill in your details and we&apos;ll get back to you — usually within an hour during store hours.</p>
      </div>

      {submitted && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 animate-fade-in">
          <Check className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Thanks! Your message has been received.</p>
            <p className="text-xs">{ticketId ? `Reference ${ticketId} — ` : ''}we&apos;ll call you back shortly.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">Your name</label>
          <Input
            id="name"
            type="text"
            placeholder="e.g. Arjun Kumar"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium">Phone number</label>
          <Input
            id="phone"
            type="tel"
            placeholder="+91 ..."
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="message" className="text-sm font-medium">Message</label>
          <Textarea
            id="message"
            placeholder="Tell us what you're looking for — a product, a size, a bulk order..."
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error} Please WhatsApp or call us on +91 93600 11107.</p>}
        <Button type="submit" size="lg" className="w-full" disabled={sending}>
          <Send className="h-4 w-4 mr-2" /> {sending ? 'Sending…' : 'Send enquiry'}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          To reach us right now, WhatsApp or call +91 93600 11107.
        </p>
      </form>
    </div>
  );
}
