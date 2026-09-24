import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Phone, Clock, MessageCircle, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactForm } from '@/components/contact/ContactForm';

export const metadata: Metadata = {
  title: 'Contact — Step N Rock · Vadapalani, Chennai',
  description:
    'Contact Step N Rock — Rahaat Plaza, First Floor, Vadapalani, Chennai. Call or WhatsApp +91 93600 11107. Open Mon–Sun 10:30 AM to 9:00 PM. Send us an enquiry and we usually reply within the hour.',
  keywords: ['Step N Rock contact', 'Vadapalani shoe store', 'Chennai footwear contact', 'Rahaat Plaza', 'WhatsApp shoe shop Chennai'],
  alternates: { canonical: 'https://stepnrock.com/contact' },
  openGraph: {
    title: 'Contact — Step N Rock · Vadapalani, Chennai',
    description: 'Rahaat Plaza, First Floor, Vadapalani, Chennai. Call or WhatsApp +91 93600 11107.',
    url: 'https://stepnrock.com/contact',
  },
};

const heroBg = 'https://images.pexels.com/photos/2908975/pexels-photo-2908975.jpeg?auto=compress&cs=tinysrgb&w=1400';

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[40vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Contact Step N Rock" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/60 to-foreground/30" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <nav className="text-sm text-background/70 mb-4">
            <Link href="/" className="hover:text-primary">Home</Link> / Contact
          </nav>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-background mb-3 text-balance">
            Let&apos;s talk footwear
          </h1>
          <p className="text-background/80 max-w-xl">
            Questions about a product, a size, or an order? Call, WhatsApp, or send us a note — we usually reply within the hour during store hours.
          </p>
        </div>
      </section>

      {/* Contact section */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Info card */}
            <div className="bg-foreground text-background rounded-3xl p-8 space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">Step N Rock</h2>
                <p className="text-background/60 text-sm">Footwear & Apparel · Vadapalani, Chennai</p>
              </div>

              <div className="space-y-5">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-background/50 uppercase tracking-wider mb-1">Store address</p>
                    <p className="text-sm leading-relaxed">Rahaat Plaza, First Floor<br />Vadapalani, Chennai — 600026</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-background/50 uppercase tracking-wider mb-1">Call / WhatsApp</p>
                    <a href="tel:+919360011107" className="text-sm hover:text-primary transition-colors">+91 93600 11107</a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-background/50 uppercase tracking-wider mb-1">Store hours</p>
                    <p className="text-sm">Mon – Sun · 10:30 AM – 9:00 PM</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-background/10">
                <Button asChild size="lg" className="flex-1">
                  <a href="https://wa.me/919360011107" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp us
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="flex-1 bg-transparent border-background/30 text-background hover:bg-background/10 hover:text-background">
                  <a href="tel:+919360011107">
                    <Phone className="h-4 w-4 mr-2" /> Call now
                  </a>
                </Button>
              </div>
            </div>

            {/* Enquiry form */}
            <ContactForm />
          </div>

          {/* Map */}
          <div className="mt-8 rounded-3xl overflow-hidden border border-border">
            <iframe
              src="https://www.google.com/maps?q=Vadapalani,Chennai&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Step N Rock location — Vadapalani, Chennai"
              className="w-full h-[350px] md:h-[450px]"
            />
          </div>
        </div>
      </section>
    </>
  );
}
