'use client';

import { useState } from 'react';
import { BUSINESS } from '@/lib/constants';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = encodeURIComponent(
      `Hi Allwin Tours & Travels,\nName: ${name}\nPhone: ${phone}\nMessage: ${message}`
    );
    window.open(`https://wa.me/${BUSINESS.whatsapp}?text=${text}`, '_blank');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-bg-card rounded-xl border border-white/5 p-8 space-y-4">
      <div>
        <label className="block text-sm text-text-light mb-1.5">Full Name *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-text-grey focus:outline-none focus:border-accent"
          placeholder="Your name"
        />
      </div>
      <div>
        <label className="block text-sm text-text-light mb-1.5">Phone Number *</label>
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-text-grey focus:outline-none focus:border-accent"
          placeholder="10-digit mobile number"
        />
      </div>
      <div>
        <label className="block text-sm text-text-light mb-1.5">Message *</label>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-text-grey focus:outline-none focus:border-accent"
          placeholder="How can we help you?"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-accent hover:bg-accent-hover text-slate-900 font-semibold py-3 rounded-lg transition-colors"
      >
        📤 Send via WhatsApp
      </button>
    </form>
  );
}
