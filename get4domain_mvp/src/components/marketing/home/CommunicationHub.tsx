'use client';

import { useState } from 'react';
import { MessageCircle, Send, Mail, Smartphone, Bell, Check, type LucideIcon } from 'lucide-react';

interface Channel { id: string; name: string; icon: LucideIcon; color: string; desc: string; cost: string; }

// Real cost framing: subscription gives tool access; variable messaging is
// pay-per-use from the wallet. WhatsApp API has no monthly platform fee.
const CHANNELS: Channel[] = [
  { id: 'whatsapp', name: 'WhatsApp API', icon: MessageCircle, color: 'from-success-400 to-success-600', desc: 'Send invoices, confirmations and reminders automatically', cost: 'No monthly fee' },
  { id: 'sms-t', name: 'Transactional SMS', icon: Smartphone, color: 'from-primary-400 to-primary-600', desc: 'OTP, alerts and booking confirmations', cost: 'Pay per SMS' },
  { id: 'sms-p', name: 'Promotional SMS', icon: Send, color: 'from-warning-400 to-secondary-500', desc: 'Campaigns, offers and bulk marketing', cost: 'Pay per SMS' },
  { id: 'email', name: 'Email', icon: Mail, color: 'from-error-400 to-error-600', desc: 'Newsletters, receipts and reports', cost: 'Included' },
];

export default function CommunicationHub() {
  const [active, setActive] = useState('whatsapp');
  const ch = CHANNELS.find((c) => c.id === active)!;

  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* left: text + channel tabs */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
              <MessageCircle className="h-3.5 w-3.5" /> Communication Hub
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Talk to your customers <span className="text-gradient-hero">on every channel</span>
            </h2>
            <p className="mb-6 leading-relaxed text-slate-400">
              WhatsApp Business API with no monthly platform fee. Transactional and promotional SMS. Email. All managed from one unified inbox — variable usage is billed per use from your wallet.
            </p>

            <div className="mb-6 grid grid-cols-2 gap-2.5">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                const isActive = c.id === active;
                return (
                  <button key={c.id} onClick={() => setActive(c.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-300 ${isActive ? 'border-primary-400/30 bg-primary-500/10 shadow-glow' : 'border-white/5 bg-slate-800/40 hover:bg-slate-800/70'}`}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${c.color}`}><Icon className="h-4 w-4 text-white" /></div>
                    <div className="min-w-0">
                      <div className={`truncate text-xs font-semibold ${isActive ? 'text-primary-200' : 'text-slate-200'}`}>{c.name}</div>
                      <div className="text-[10px] text-slate-400">{c.cost}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Check className="h-4 w-4 text-primary-400" />
              Unified inbox · templates · auto-replies · delivery reports
            </div>
          </div>

          {/* right: animated phone mockup */}
          <div className="relative flex justify-center">
            <div className="animate-float">
              <div className="relative rounded-[2rem] bg-slate-950 p-2.5 shadow-device-phone" style={{ width: 'clamp(240px, 28vw, 320px)' }}>
                <div className="relative overflow-hidden rounded-[1.6rem] bg-slate-50" style={{ aspectRatio: '9 / 19' }}>
                  <div className="flex h-full flex-col">
                    <div className={`bg-gradient-to-br px-4 py-3 text-white ${ch.color}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2"><ch.icon className="h-5 w-5" /><span className="text-sm font-semibold">{ch.name}</span></div>
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="text-xs text-white/80">{ch.desc}</div>
                    </div>
                    <div className="flex-1 space-y-2 overflow-hidden p-3">
                      {active === 'whatsapp' && <WhatsAppChat />}
                      {active === 'sms-t' && <SMSView type="transactional" />}
                      {active === 'sms-p' && <SMSView type="promotional" />}
                      {active === 'email' && <EmailView />}
                    </div>
                  </div>
                </div>
                <div className="absolute left-1/2 top-4 z-10 h-3.5 w-14 -translate-x-1/2 rounded-full bg-slate-950" />
              </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 h-8 w-2/3 -translate-x-1/2 rounded-full bg-primary-500/15 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatsAppChat() {
  return (
    <div className="animate-fade-in space-y-2">
      <div className="ml-auto max-w-[80%] rounded-lg rounded-tr-none bg-success-100 p-2.5">
        <div className="mb-0.5 text-[10px] font-semibold text-success-700">CareWell Clinic</div>
        <div className="text-[10px] text-slate-700">Hi Ravi! Your appointment is confirmed for tomorrow at 10:00 AM with Dr. Anjali.</div>
        <div className="mt-0.5 text-right text-[8px] text-slate-400">10:24 AM ✓✓</div>
      </div>
      <div className="max-w-[80%] rounded-lg rounded-tl-none bg-white p-2.5">
        <div className="text-[10px] text-slate-700">Thank you! I&apos;ll be there.</div>
        <div className="mt-0.5 text-right text-[8px] text-slate-400">10:25 AM</div>
      </div>
      <div className="ml-auto max-w-[80%] rounded-lg rounded-tr-none bg-success-100 p-2.5">
        <div className="text-[10px] text-slate-700">Your invoice for ₹500 is ready. Pay via UPI: carewell@upi</div>
        <div className="mt-0.5 text-right text-[8px] text-slate-400">10:26 AM ✓✓</div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[10px] text-slate-400">Type a message...</div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success-500"><Send className="h-3.5 w-3.5 text-white" /></div>
      </div>
    </div>
  );
}

function SMSView({ type }: { type: 'transactional' | 'promotional' }) {
  return (
    <div className="animate-fade-in space-y-2">
      {type === 'transactional' ? (
        <>
          <div className="rounded-lg bg-white p-2.5 shadow-sm">
            <div className="text-[9px] font-semibold text-primary-600">CAREWELL</div>
            <div className="mt-0.5 text-[10px] text-slate-700">Your OTP is 482913. Valid for 5 min. Do not share.</div>
            <div className="mt-0.5 text-[8px] text-slate-400">10:24 AM</div>
          </div>
          <div className="rounded-lg bg-white p-2.5 shadow-sm">
            <div className="text-[9px] font-semibold text-primary-600">CAREWELL</div>
            <div className="mt-0.5 text-[10px] text-slate-700">Appt confirmed: Dr. Anjali, 25 Aug 10:00 AM. Reply C to cancel.</div>
            <div className="mt-0.5 text-[8px] text-slate-400">10:25 AM</div>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg bg-white p-2.5 shadow-sm">
            <div className="text-[9px] font-semibold text-warning-600">CAREWELL</div>
            <div className="mt-0.5 text-[10px] text-slate-700">Flat 40% OFF on health checkups! Valid till Aug 31. Book: clinic.get4domain.com</div>
            <div className="mt-0.5 text-[8px] text-slate-400">10:24 AM</div>
          </div>
          <div className="rounded-lg bg-white p-2.5 shadow-sm">
            <div className="text-[9px] font-semibold text-warning-600">CAREWELL</div>
            <div className="mt-0.5 text-[10px] text-slate-700">Refer a friend &amp; both get ₹200 off your next visit. clinic.get4domain.com/refer</div>
            <div className="mt-0.5 text-[8px] text-slate-400">10:25 AM</div>
          </div>
        </>
      )}
    </div>
  );
}

function EmailView() {
  return (
    <div className="animate-fade-in space-y-2">
      {[
        { t: 'Your monthly health report', b: 'Hi Ravi, your August health summary is ready. You had 2 visits this month...' },
        { t: 'Invoice #1042 — Payment received', b: 'Thank you for your payment of ₹1,500. Your receipt is attached...' },
      ].map((e) => (
        <div key={e.t} className="rounded-lg bg-white p-2.5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-error-500 text-[8px] font-semibold text-white">CW</div>
            <div className="flex-1">
              <div className="text-[10px] font-semibold text-slate-700">{e.t}</div>
              <div className="text-[8px] text-slate-400">carewell@get4domain.com</div>
            </div>
          </div>
          <div className="text-[9px] leading-relaxed text-slate-500">{e.b}</div>
        </div>
      ))}
    </div>
  );
}
