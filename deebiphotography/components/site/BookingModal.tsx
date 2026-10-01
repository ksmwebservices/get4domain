'use client';

import { createContext, useContext, useState } from 'react';
import { CalendarDays, CheckCircle2, Loader2, MessageCircle, X } from 'lucide-react';
import { submitEnquiry } from '@/lib/site-data';

const WHATSAPP_NUMBER = '919566621288';

type BookingContextValue = { openBooking: (service?: string) => void };
const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState('Wedding Photography');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [form, setForm] = useState({ name: '', phone: '', date: '', city: '', notes: '' });

  const openBooking = (selectedService?: string) => {
    setService(selectedService || 'Wedding Photography');
    setStatus('idle');
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('sending');
    const message = [
      'Hello Deebi Wedding Stories!',
      '',
      `I would like to book: ${service}`,
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Wedding date: ${form.date}`,
      `City / venue: ${form.city}`,
      `Notes: ${form.notes || 'Not provided'}`,
    ].join('\n');

    // Real CRM lead capture (engine.enquiry) - fire alongside the WhatsApp flow,
    // never blocking or replacing it; the WhatsApp message is still what the
    // couple sees and sends.
    submitEnquiry({
      name: form.name,
      phone: form.phone,
      message: `Service: ${service}\nWedding date: ${form.date || 'Not provided'}\nCity / venue: ${form.city || 'Not provided'}\nNotes: ${form.notes || 'Not provided'}`,
    });

    window.setTimeout(() => {
      setStatus('sent');
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
    }, 500);
  };

  return (
    <BookingContext.Provider value={{ openBooking }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-ink/80 backdrop-blur-sm p-0 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="booking-title">
          <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-ink-light border border-gold/30 rounded-t-xl sm:rounded-sm shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute top-5 right-5 text-warm/60 hover:text-gold transition-colors" aria-label="Close booking form">
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-full border border-gold/40 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-gold" /></div>
                <div>
                  <p className="font-cinzel text-gold text-[10px] tracking-[0.3em] uppercase">Check availability</p>
                  <h2 id="booking-title" className="font-playfair text-2xl text-cream">Book your date</h2>
                </div>
              </div>
              {status === 'sent' ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="w-12 h-12 text-gold mx-auto mb-4" />
                  <h3 className="font-playfair text-2xl text-cream">WhatsApp is ready</h3>
                  <p className="text-warm/60 mt-2">Your booking details are prepared. We will reply with availability and package options.</p>
                  <button onClick={() => setOpen(false)} className="mt-6 px-6 py-3 bg-gold text-ink text-sm rounded-sm">Close</button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div className="p-3 border border-gold/20 bg-ink rounded-sm"><p className="text-warm-dark text-[10px] tracking-[0.2em] uppercase">Selected service</p><p className="text-gold text-sm mt-1">{service}</p></div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="booking-input" placeholder="Your name *" />
                    <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="booking-input" placeholder="Phone number *" type="tel" />
                    <input required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="booking-input [color-scheme:dark]" type="date" />
                    <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className="booking-input" placeholder="City / venue" />
                  </div>
                  <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="booking-input min-h-24 resize-none" placeholder="Tell us about your wedding events" />
                  <button disabled={status === 'sending'} className="w-full flex items-center justify-center gap-2 py-3.5 bg-gold text-ink text-sm font-medium tracking-wide rounded-sm hover:bg-gold-light transition-colors disabled:opacity-60">
                    {status === 'sending' ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing WhatsApp</> : <><MessageCircle className="w-4 h-4" /> Request availability</>}
                  </button>
                  <p className="text-warm-dark text-xs text-center">No payment is taken here. This form starts a conversation with Deebi Wedding Stories.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBooking must be used inside BookingProvider');
  return context;
}

export function BookButton({ service, children = 'Book Now', className = '' }: { service?: string; children?: React.ReactNode; className?: string }) {
  const { openBooking } = useBooking();
  return <button onClick={() => openBooking(service)} className={className}>{children}</button>;
}
