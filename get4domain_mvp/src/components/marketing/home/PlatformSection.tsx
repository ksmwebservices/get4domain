'use client';

import { useState } from 'react';
import { Smartphone, Monitor, Tablet, Store, User, Globe, Check } from 'lucide-react';

type Platform = 'webapp' | 'vendor' | 'client';

// Real Get4Domain apps. Webapp preview uses our real Playwright screenshots
// (clinic sample); vendor/client are lightweight simulated panels.
const PLATFORMS: { id: Platform; label: string; icon: typeof Smartphone; desc: string; features: string[]; color: string }[] = [
  { id: 'webapp', label: 'Webapp', icon: Globe, desc: 'Your industry website on a Get4Domain subdomain — marketing pages, SEO, lead capture and online enquiry.', features: ['Subdomain (clinic.get4domain.com)', 'SEO-optimized pages', 'Enquiry & lead forms', 'WhatsApp & call CTAs', 'Mobile responsive'], color: 'from-primary-400 to-primary-600' },
  { id: 'vendor', label: 'Vendor App', icon: Store, desc: 'Run your business from the Workplace — leads, bookings, tasks, POS, payments and CRM in one dashboard.', features: ['Bookings & appointments', 'Task management', 'Point of sale (POS)', 'Payment tracking', 'CRM + TeleCRM', 'Reports & analytics'], color: 'from-warning-400 to-secondary-500' },
  { id: 'client', label: 'Client App', icon: User, desc: 'Your customers get their own installable PWA — book, pay, track and chat with you from any phone.', features: ['Book & pay online', 'Order/booking tracking', 'WhatsApp chat', 'Push notifications', 'Installable PWA', 'Review & rate'], color: 'from-success-400 to-success-600' },
];

const DEVICES = [
  { id: 'mobile', icon: Smartphone, label: 'Mobile' },
  { id: 'tablet', icon: Tablet, label: 'Tablet' },
  { id: 'desktop', icon: Monitor, label: 'Desktop' },
];

export default function PlatformSection() {
  const [platform, setPlatform] = useState<Platform>('vendor');
  const [device, setDevice] = useState('mobile');
  const active = PLATFORMS.find((p) => p.id === platform)!;
  const ActiveIcon = active.icon;

  return (
    <section id="platform" className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
            <Smartphone className="h-3.5 w-3.5" /> Three apps. One platform.
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Webapp. Vendor. Client. <span className="text-gradient-hero">All included.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Every Get4Domain subscription includes a public website, a vendor management dashboard, and a client-facing PWA — responsive on every device.
          </p>
        </div>

        {/* platform tabs */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-white/5 bg-slate-800/60 p-1 backdrop-blur-xl">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isActive = p.id === platform;
              return (
                <button key={p.id} onClick={() => setPlatform(p.id)}
                  className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all sm:px-5 ${isActive ? 'text-slate-900' : 'text-slate-300 hover:text-white'}`}>
                  {isActive && <span className={`absolute inset-0 rounded-full bg-gradient-to-r ${p.color}`} />}
                  <span className="relative flex items-center gap-2"><Icon className="h-4 w-4" />{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* left: description */}
          <div>
            <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${active.color}`}>
              <ActiveIcon className="h-7 w-7 text-white" />
            </div>
            <h3 className="mb-3 text-2xl font-bold text-white">{active.label}</h3>
            <p className="mb-5 leading-relaxed text-slate-400">{active.desc}</p>
            <ul className="space-y-2.5">
              {active.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-200">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15"><Check className="h-3 w-3 text-primary-300" /></span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* right: device preview */}
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-slate-800/50 p-1">
              {DEVICES.map((d) => {
                const Icon = d.icon;
                const isActive = d.id === device;
                return (
                  <button key={d.id} onClick={() => setDevice(d.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${isActive ? 'bg-primary-500/15 text-primary-300' : 'text-slate-400 hover:text-slate-200'}`}>
                    <Icon className="h-3.5 w-3.5" />{d.label}
                  </button>
                );
              })}
            </div>

            <div className="flex w-full justify-center">
              {device === 'mobile' && (
                <div className="relative mx-auto rounded-[2rem] bg-slate-950 p-2.5 shadow-device-phone" style={{ width: '260px' }}>
                  <div className="relative overflow-hidden rounded-[1.6rem] bg-slate-50" style={{ aspectRatio: '9 / 19' }}>
                    <PlatformMock platform={platform} device="mobile" />
                  </div>
                  <div className="absolute left-1/2 top-4 z-10 h-3.5 w-14 -translate-x-1/2 rounded-full bg-slate-950" />
                </div>
              )}
              {device === 'tablet' && (
                <div className="mx-auto w-full max-w-[420px] rounded-[1.5rem] bg-slate-950 p-3 shadow-device">
                  <div className="overflow-hidden rounded-xl bg-slate-50" style={{ aspectRatio: '4 / 3' }}>
                    <PlatformMock platform={platform} device="tablet" wide />
                  </div>
                </div>
              )}
              {device === 'desktop' && (
                <div className="mx-auto w-full max-w-[640px] rounded-t-xl rounded-b-md bg-slate-950 p-2 shadow-device">
                  <div className="overflow-hidden rounded-lg bg-slate-50" style={{ aspectRatio: '16 / 10' }}>
                    <PlatformMock platform={platform} device="desktop" wide />
                  </div>
                  <div className="h-3 rounded-b-lg bg-gradient-to-b from-slate-700 to-slate-800">
                    <div className="mx-auto h-1 w-12 rounded-b-md bg-slate-600" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformMock({ platform, device, wide = false }: { platform: Platform; device: string; wide?: boolean }) {
  if (platform === 'webapp') {
    // Real Playwright screenshots (clinic sample) — mobile crop vs wide home.
    const src = device === 'mobile' ? '/hero-shots/clinic-mobile.webp' : '/hero-shots/clinic-home.webp';
    return <img src={src} alt="Get4Domain industry website" className="h-full w-full object-cover object-top" loading="lazy" />;
  }
  if (platform === 'vendor') return <VendorMock wide={wide} />;
  return <ClientMock wide={wide} />;
}

function VendorMock({ wide }: { wide: boolean }) {
  return (
    <div className="flex h-full bg-slate-50 text-slate-800">
      {wide && (
        <div className="hidden w-24 flex-col gap-1 border-r border-slate-100 bg-white p-2 md:flex">
          <div className="mb-1 text-[7px] font-semibold uppercase text-slate-400">Menu</div>
          {['Overview', 'Bookings', 'Tasks', 'POS', 'Clients', 'Payments'].map((m, i) => (
            <div key={m} className={`rounded px-2 py-1.5 text-[8px] ${i === 0 ? 'bg-primary-100 font-medium text-primary-700' : 'text-slate-500'}`}>{m}</div>
          ))}
        </div>
      )}
      <div className="flex-1 p-3">
        <div className="mb-2 text-[10px] font-bold">Overview</div>
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {[{ l: 'Revenue', v: '₹48k' }, { l: 'Bookings', v: '128' }, { l: 'Clients', v: '1.2k' }, { l: 'Rating', v: '4.9' }].map((s) => (
            <div key={s.l} className="rounded-lg bg-white p-2 shadow-sm">
              <div className="text-[8px] text-slate-400">{s.l}</div>
              <div className="text-[11px] font-bold">{s.v}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-white p-2 shadow-sm">
          <div className="mb-1 text-[8px] font-semibold">Recent activity</div>
          {['New booking — Ravi K.', 'Payment ₹1,500 — Sneha P.', 'New lead — Mohan J.'].map((a) => (
            <div key={a} className="border-b border-slate-100 py-0.5 text-[7px] text-slate-500 last:border-0">{a}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientMock({ wide }: { wide: boolean }) {
  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-800">
      <div className="bg-gradient-to-br from-success-500 to-success-600 px-3 py-2.5 text-white">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold">CareWell</span>
          <div className="flex gap-1.5"><div className="h-4 w-4 rounded-full bg-white/20" /><div className="h-4 w-4 rounded-full bg-white/20" /></div>
        </div>
        <div className="text-[8px] text-white/70">Find your doctor</div>
      </div>
      <div className="flex-1 p-2.5">
        <div className="mb-2 rounded-lg bg-white p-2 shadow-sm">
          <div className="mb-1.5 flex h-12 items-end rounded bg-gradient-to-br from-primary-400 to-primary-500 p-1.5">
            <div><div className="text-[8px] font-bold text-white">Dr. Anjali Rao</div><div className="text-[6px] text-white/80">Cardiologist · 4.9★</div></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-bold text-success-600">₹500</span>
            <div className="rounded-full bg-success-500 px-2 py-0.5 text-[7px] text-white">Book</div>
          </div>
        </div>
        <div className={`grid gap-1.5 ${wide ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {[{ t: 'General', p: '₹300', c: 'from-primary-300 to-primary-400' }, { t: 'Dental', p: '₹400', c: 'from-success-300 to-success-400' }, { t: 'Skin', p: '₹450', c: 'from-warning-300 to-warning-400' }].map((g) => (
            <div key={g.t} className="rounded-lg bg-white p-1.5 shadow-sm">
              <div className={`mb-1 h-6 rounded bg-gradient-to-br ${g.c}`} />
              <div className="text-[7px] font-semibold">{g.t}</div>
              <div className="text-[6px] text-slate-400">{g.p}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
