import type { Metadata } from 'next';
import { BUSINESS } from '@/lib/constants';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us | Allwin Tours & Travels',
  description: 'Get in touch with Allwin Tours & Travels, Cuddalore, Tamil Nadu.',
};

export default function ContactPage() {
  return (
    <section className="pt-32 pb-20 px-4 bg-bg-dark min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-accent font-semibold text-sm uppercase tracking-wide">
            Get In Touch
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2">
            Contact Us
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-bg-card rounded-xl border border-white/5 p-8 space-y-5">
            <div className="flex items-start gap-3">
              <span className="text-xl">📍</span>
              <div>
                <p className="text-white font-semibold">Address</p>
                <p className="text-text-grey text-sm">{BUSINESS.location}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">📞</span>
              <div>
                <p className="text-white font-semibold">Phone</p>
                <a href={`tel:${BUSINESS.phone}`} className="text-text-grey text-sm hover:text-accent">
                  {BUSINESS.phone}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">💬</span>
              <div>
                <p className="text-white font-semibold">WhatsApp</p>
                <a
                  href={`https://wa.me/${BUSINESS.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-grey text-sm hover:text-accent"
                >
                  {BUSINESS.phone}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">🕐</span>
              <div>
                <p className="text-white font-semibold">Hours</p>
                <p className="text-text-grey text-sm">24 Hours · 7 Days</p>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden border border-white/10 mt-4">
              <iframe
                title="Allwin Tours & Travels location"
                width="100%"
                height="240"
                loading="lazy"
                style={{ border: 0 }}
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  BUSINESS.location
                )}&output=embed`}
              />
            </div>
          </div>

          <ContactForm />
        </div>
      </div>
    </section>
  );
}
