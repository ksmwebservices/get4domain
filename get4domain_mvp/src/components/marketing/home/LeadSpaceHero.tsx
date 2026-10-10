import Link from 'next/link';
import { ArrowRight, Check, Home, Info, MessageCircle, Wallet, Wrench } from 'lucide-react';

const STEPS: { title: string; blurb: string }[] = [
  { title: 'Make your free page', blurb: 'Tell us your trade and city. Your page is ready in minutes, with your services, pictures and prices.' },
  { title: 'Customers verify on WhatsApp', blurb: 'Every enquiry, booking or order is confirmed with a WhatsApp code before it reaches you.' },
  { title: 'Pay only per verified customer', blurb: 'No monthly fee. Top up a wallet and each verified customer is charged once, at a price you see first.' },
];

const SERVICES = [
  { name: 'Tap repair', price: 'Rs 350' },
  { name: 'Geyser fitting', price: 'Rs 900' },
  { name: 'Pipe leak fix', price: 'Rs 600' },
];

/** The first thing a visitor sees on the home page: LeadSpace, our own product, ahead of DomainApp. No per-customer price is typed here; it is set per trade and city in the admin. */
export default function LeadSpaceHero() {
  return (
    <section id="leadspace" className="relative overflow-hidden bg-slate-950">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-40 h-[36rem] w-[36rem] rounded-full bg-primary-600/15 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[28rem] w-[28rem] rounded-full bg-warning-500/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-8">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-400" /></span>
            Your online visible partner
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Get found online. <span className="text-gradient-hero">Pay only for real customers.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-400 lg:mx-0">
            LeadSpace gives your business a free page that works like a small app. Customers ask for you on it and confirm on WhatsApp. You pay a small amount only for each verified customer.
          </p>
          <ul className="mx-auto mt-5 flex max-w-xl flex-col gap-2 text-left text-sm text-slate-300 lg:mx-0">
            {['No website to build, no ads to manage', 'Your phone number and address stay private', 'Prepaid wallet: you control every rupee'].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 flex-shrink-0 text-warning-300" aria-hidden />{t}</li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/register?product=leadspace" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
              Create your free page <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/leadspace" className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-800 sm:w-auto">
              How LeadSpace works
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">For drivers, freelancers, clinics, tutors, salons, start-ups and small shops. Running a bigger business? <a href="#domainapp" className="text-primary-300 underline">See DomainApp</a>.</p>
        </div>

        {/* a small LeadSpace page, drawn in markup (sample business, no real data) */}
        <div className="mx-auto w-full max-w-[300px]" aria-hidden>
          <div className="rounded-[2.2rem] border border-slate-700/80 bg-gradient-to-b from-slate-800 to-slate-900 p-[5px] shadow-device-phone ring-1 ring-white/10">
            <div className="overflow-hidden rounded-[1.85rem] bg-white text-slate-900">
              <div className="px-4 pb-3 pt-5" style={{ background: '#fffbeb' }}>
                <p className="text-[11px] font-semibold" style={{ color: '#92400e' }}>Ravi Plumbing Works</p>
                <p className="text-[10px] text-slate-500">Handyman and home services · Chennai</p>
                <p className="mt-3 text-base font-bold leading-tight" style={{ color: '#92400e' }}>Leaks fixed the same day</p>
                <span className="mt-3 inline-block rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white" style={{ background: '#d97706' }}>Book a visit</span>
              </div>
              <div className="space-y-2 px-4 py-3">
                {SERVICES.map((s) => (
                  <div key={s.name} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold" style={{ background: '#fffbeb', color: '#92400e' }}>{s.name[0]}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{s.name}</p><p className="text-[10px] text-slate-500">{s.price}</p></div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-around border-t border-slate-100 py-2 text-[9px] text-slate-500">
                {[[Home, 'Home'], [Wrench, 'Services'], [Info, 'About'], [MessageCircle, 'Book']].map(([Ic, label], i) => {
                  const Icon = Ic as typeof Home;
                  return <span key={String(label)} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'font-semibold' : ''}`} style={i === 0 ? { color: '#d97706' } : undefined}><Icon className="h-3.5 w-3.5" />{String(label)}</span>;
                })}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400"><Wallet className="h-3.5 w-3.5 text-warning-300" aria-hidden />Verified on WhatsApp · billed from your wallet</div>
        </div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-white/5 bg-slate-800/60 p-5 backdrop-blur-xl">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/20 text-sm font-bold text-primary-300">{i + 1}</div>
              <h2 className="mt-3 text-base font-bold text-white">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
