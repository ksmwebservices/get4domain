'use client';

import { useState, useEffect } from 'react';
import { BUSINESS, BOOKING_SERVICES } from '@/lib/constants';
import { useBookingModal } from './BookingModalContext';

export default function BookingModal() {
  const { isOpen, closeModal, prefilledService } = useBookingModal();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('');
  const [date, setDate] = useState('');
  const [passengers, setPassengers] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setService(prefilledService);
    }
  }, [isOpen, prefilledService]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const buildMessage = () => {
    const lines = [
      `Hi Allwin Tours & Travels, I'd like to make a booking.`,
      `Name: ${name || '-'}`,
      `Phone: ${phone || '-'}`,
      `Service/Tour: ${service || '-'}`,
      `Travel Date: ${date || '-'}`,
      `Passengers: ${passengers || '-'}`,
      `Special Requirements: ${notes || '-'}`,
    ];
    return encodeURIComponent(lines.join('\n'));
  };

  const handleWhatsAppBook = () => {
    const url = `https://wa.me/${BUSINESS.whatsapp}?text=${buildMessage()}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90" onClick={closeModal} />

      <div className="relative bg-bg-card w-full max-w-lg rounded-xl border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-bg-card">
          <h3 className="text-xl font-bold text-white">Book Your Trip</h3>
          <button
            onClick={closeModal}
            className="text-text-grey hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          className="p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleWhatsAppBook();
          }}
        >
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
            <label className="block text-sm text-text-light mb-1.5">
              Phone Number (WhatsApp) *
            </label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-text-grey focus:outline-none focus:border-accent"
              placeholder="10-digit mobile number"
            />
          </div>

          <div>
            <label className="block text-sm text-text-light mb-1.5">Service/Tour *</label>
            <select
              required
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
            >
              <option value="">Select a service</option>
              {BOOKING_SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-light mb-1.5">Travel Date *</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-text-light mb-1.5">Passengers</label>
              <input
                type="number"
                min="1"
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-text-grey focus:outline-none focus:border-accent"
                placeholder="e.g. 4"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-light mb-1.5">
              Special Requirements
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-text-grey focus:outline-none focus:border-accent"
              placeholder="Any special requests..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-hover text-slate-900 font-semibold py-3 rounded-lg transition-colors"
          >
            📤 Book via WhatsApp
          </button>

          <p className="text-center text-sm text-text-grey">
            📞 Call:{' '}
            <a href={`tel:${BUSINESS.phone}`} className="text-accent">
              {BUSINESS.phone}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
