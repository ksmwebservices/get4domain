'use client';

import { Phone, Mail, MessageCircle, Headphones, MapPin, Clock } from 'lucide-react';
import { SectionHeading } from './ui/Accordion';
import Button from './ui/Button';

const contactCards = [
  { icon: Phone, title: 'Call Us', label: 'Sales & Support', value: '+91 75500 47567', action: 'Call Now', color: 'bg-primary-50 text-primary-600' },
  { icon: MessageCircle, title: 'WhatsApp', label: 'Quick Chat', value: '+91 75500 47567', action: 'Chat Now', color: 'bg-success-50 text-success-600' },
  { icon: Mail, title: 'Email', label: 'Support', value: 'support@get4domain.com', action: 'Send Email', color: 'bg-secondary-50 text-secondary-600' },
];

export default function Contact() {
  return (
    <section id="contact" className="section-py bg-slate-50">
      <div className="container-mx container-px">
        <SectionHeading eyebrow="Contact Us" title="Get in Touch" description="Have questions? Our sales and support teams are ready to help you launch your business online." />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            {contactCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="card-base card-hover p-5 flex items-center gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${card.color}`}><Icon className="h-6 w-6" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400">{card.label}</p>
                    <p className="text-sm font-bold text-slate-900">{card.title}</p>
                    <p className="text-sm text-slate-600 truncate">{card.value}</p>
                  </div>
                  <Button size="sm" variant="outline">{card.action}</Button>
                </div>
              );
            })}
            <div className="card-base p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50"><Headphones className="h-5 w-5 text-primary-600" /></div>
                <div><p className="text-sm font-bold text-slate-900">Dedicated Support</p><p className="text-xs text-slate-500">30 days included with every package</p></div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600"><Clock className="h-4 w-4 text-slate-400" /><span>Mon - Sat: 9:00 AM - 8:00 PM IST</span></div>
              <div className="mt-2 flex items-start gap-2 text-sm text-slate-600"><MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" /><span>Tidel Park, 1st Floor D Block, Tharamani, Chennai - 600113</span></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card-base overflow-hidden">
              <div className="relative h-64 bg-slate-100">
                <iframe
                  title="Get4Domain Office Location"
                  src="https://www.google.com/maps?q=Tidel+Park,+Tharamani,+Chennai,+Tamil+Nadu+600113&output=embed"
                  className="h-full w-full border-0"
                  loading="lazy"
                />
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 shadow-md backdrop-blur">
                  <MapPin className="h-4 w-4 text-primary-600" />
                  <span className="text-xs font-medium text-slate-700">Tidel Park, Tharamani, Chennai - 600113</span>
                </div>
              </div>
            </div>
            <div className="card-base p-5">
              <p className="mb-4 text-sm font-bold text-slate-900">Send a Quick Message</p>
              <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Your Name" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  <input type="tel" placeholder="Phone Number" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <textarea rows={3} placeholder="Your message..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none" />
                <Button type="submit" fullWidth leftIcon={<MessageCircle className="h-4 w-4" />}>Send Message</Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
