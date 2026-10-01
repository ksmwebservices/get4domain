'use client';

import { useState } from 'react';
import { Mail, Phone, MapPin, MessageCircle, Clock, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { submitEnquiry } from '@/lib/site-data';

const WHATSAPP_NUMBER = '919566621288';
const EMAIL = 'click@deebi.com';
const ADDRESS = 'Surya Nagar, Madurai';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', date: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [leadSaved, setLeadSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    const whatsappText = `Hello Deebi Wedding Stories!%0A%0AName: ${form.name}%0APhone: ${form.phone}%0AEmail: ${form.email}%0AWedding Date: ${form.date}%0AMessage: ${form.message}`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}`;

    // Real CRM lead capture (engine.enquiry) - awaited so the on-screen
    // confirmation reflects what actually happened, alongside the WhatsApp
    // flow (never blocking or replacing it; the WhatsApp message is still
    // what the couple sees and sends).
    const saved = await submitEnquiry({
      name: form.name,
      phone: form.phone,
      message: `Email: ${form.email || 'Not provided'}\nWedding date: ${form.date || 'Not provided'}\nMessage: ${form.message || 'Not provided'}`,
    });
    setLeadSaved(saved);
    setStatus('success');
    window.open(whatsappUrl, '_blank');
    setTimeout(() => {
      setStatus('idle');
      setForm({ name: '', email: '', phone: '', date: '', message: '' });
    }, 6000);
  };

  const contactItems = [
    {
      icon: Phone,
      label: 'WhatsApp / Phone',
      value: '+91 95666 21288',
      href: `https://wa.me/${WHATSAPP_NUMBER}`,
    },
    {
      icon: Mail,
      label: 'Email',
      value: EMAIL,
      href: `mailto:${EMAIL}`,
    },
    {
      icon: MapPin,
      label: 'Studio Address',
      value: ADDRESS,
      href: 'https://maps.google.com/?q=Surya+Nagar+Madurai',
    },
    {
      icon: Clock,
      label: 'Working Hours',
      value: 'Mon - Sun: 9 AM - 8 PM',
      href: null,
    },
  ];

  return (
    <section id="contact" className="relative py-20 sm:py-32 px-5 sm:px-8">
      <div className="absolute top-0 left-0 right-0 h-px gold-line opacity-30" />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="h-px w-10 bg-gold" />
            <p className="font-cinzel text-gold tracking-[0.3em] text-xs uppercase">Get in Touch</p>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl text-cream">
            Let's Tell Your
            <span className="gold-gradient-text italic"> Love Story</span>
          </h2>
          <p className="mt-4 text-warm/60 max-w-2xl mx-auto">
            Reach out to check availability for your wedding date. We book limited weddings each year to ensure quality.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
          <div className="lg:col-span-2 space-y-4">
            {contactItems.map((item) => {
              const content = (
                <div className="flex items-start gap-4 p-5 border border-white/8 hover:border-gold/30 transition-all duration-300 rounded-sm bg-ink-light/50 group">
                  <div className="w-11 h-11 rounded-full border border-gold/40 flex items-center justify-center flex-shrink-0 group-hover:bg-gold transition-all duration-300">
                    <item.icon className="w-5 h-5 text-gold group-hover:text-ink transition-colors" />
                  </div>
                  <div>
                    <p className="text-warm-dark text-xs tracking-[0.15em] uppercase">{item.label}</p>
                    <p className="text-cream text-sm sm:text-base mt-1">{item.value}</p>
                  </div>
                </div>
              );

              return item.href ? (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="block">
                  {content}
                </a>
              ) : (
                <div key={item.label}>{content}</div>
              );
            })}

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hello%20Deebi%20Wedding%20Stories!%20I%20would%20like%20to%20enquire%20about%20your%20wedding%20photography%20services.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-5 bg-[#25D366] text-ink font-medium rounded-sm hover:bg-[#1ebd58] transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Chat on WhatsApp
            </a>
          </div>

          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8 border border-white/10 rounded-sm bg-ink-light/50">
              {status === 'success' && (
                <div className="flex items-start gap-3 p-4 border border-gold/40 bg-gold/10 rounded-sm">
                  <CheckCircle2 className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-cream text-sm font-medium">
                      {leadSaved ? 'Your enquiry has been received' : 'WhatsApp is ready'}
                    </p>
                    <p className="text-warm/60 text-xs mt-1">
                      {leadSaved
                        ? 'Deebi Wedding Stories has your details and will contact you shortly. We also opened WhatsApp so you can message us directly for the fastest response.'
                        : 'Your message is prepared in WhatsApp — send it to reach us directly.'}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-warm-dark text-xs tracking-[0.15em] uppercase mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-ink border border-white/10 focus:border-gold/50 px-4 py-3 text-cream text-sm rounded-sm outline-none transition-colors"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-warm-dark text-xs tracking-[0.15em] uppercase mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-ink border border-white/10 focus:border-gold/50 px-4 py-3 text-cream text-sm rounded-sm outline-none transition-colors"
                    placeholder="Your phone number"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-warm-dark text-xs tracking-[0.15em] uppercase mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-ink border border-white/10 focus:border-gold/50 px-4 py-3 text-cream text-sm rounded-sm outline-none transition-colors"
                    placeholder="Your email"
                  />
                </div>
                <div>
                  <label className="block text-warm-dark text-xs tracking-[0.15em] uppercase mb-2">
                    Wedding Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-ink border border-white/10 focus:border-gold/50 px-4 py-3 text-cream text-sm rounded-sm outline-none transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-warm-dark text-xs tracking-[0.15em] uppercase mb-2">
                  Tell us about your wedding
                </label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full bg-ink border border-white/10 focus:border-gold/50 px-4 py-3 text-cream text-sm rounded-sm outline-none transition-colors resize-none"
                  placeholder="Venue, number of events, what you're looking for..."
                />
              </div>

              <button
                type="submit"
                disabled={status !== 'idle'}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gold text-ink font-medium text-sm tracking-[0.15em] uppercase rounded-sm hover:bg-gold-light transition-colors disabled:opacity-60"
              >
                {status === 'idle' && (<><Send className="w-4 h-4" /> Send Enquiry</>)}
                {status === 'submitting' && (<><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>)}
                {status === 'success' && (<><CheckCircle2 className="w-4 h-4" /> {leadSaved ? 'Enquiry Received' : 'Opening WhatsApp...'}</>)}
              </button>

              <p className="text-center text-warm-dark text-xs">
                Your enquiry will be sent via WhatsApp for the fastest response.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
