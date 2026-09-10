'use client';

import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { SITE } from '@/data/site';

/**
 * No-backend contact form.
 *
 * The previous `<form action="mailto:…" method="post">` was unreliable — most
 * browsers ignore a POST mailto action, so enquiries never reached the inbox.
 * Instead we intercept submit and open the visitor's mail client with a
 * pre-filled `mailto:` URL (subject + body), which every OS mail app honours.
 */
export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [opened, setOpened] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const subject = `Website enquiry — ${name.trim() || 'New contact'}`;
    const body =
      `Name: ${name.trim()}\n` +
      `Email: ${email.trim()}\n\n` +
      `${message.trim()}\n\n` +
      `— Sent from ${SITE.url}`;
    const href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setOpened(true);
  };

  return (
    <form onSubmit={handleSubmit} className="card mt-4 grid gap-4 p-7 md:p-9">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Your name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[var(--accent)]/60"
            placeholder="Jane Doe"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Email</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[var(--accent)]/60"
            placeholder="you@company.com"
          />
        </label>
      </div>
      <label className="text-sm">
        <span className="mb-1.5 block text-[var(--muted)]">How can we help?</span>
        <textarea
          name="message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[var(--accent)]/60"
          placeholder="Tell us about your business or project…"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">
          {opened ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--accent-cyan)]">
              <CheckCircle2 className="h-4 w-4" /> Your email app should have opened. If it didn&apos;t, write to{' '}
              <a href={`mailto:${SITE.email}`} className="underline">{SITE.email}</a>.
            </span>
          ) : (
            <>Opens your email app addressed to {SITE.email}.</>
          )}
        </p>
        <button type="submit" className="btn-primary">
          Send message <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
