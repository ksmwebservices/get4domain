import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Smartphone, ShieldCheck, Wallet, BarChart3 } from 'lucide-react';
import Faq from '@/components/marketing/Faq';

export const metadata: Metadata = {
  title: 'LeadSpace: your online visible partner | free page, pay only for verified customers',
  description: 'A free mini web page for your business. Customers ask for you on it and confirm on WhatsApp, and you pay a small amount only for each verified customer, from a prepaid wallet you control.',
  alternates: { canonical: 'https://get4domain.com/leadspace' },
};

const HOW: { title: string; blurb: string }[] = [
  { title: 'Make your free page', blurb: 'Tell us your trade and city. We write the page for you in minutes: your name, what you offer with pictures and prices, why people trust you and answers to common questions.' },
  { title: 'Customers verify on WhatsApp', blurb: 'A visitor fills in a short request, gets a code on WhatsApp and confirms. You only receive real people who agreed to be contacted. Your own phone number is never shown on the page.' },
  { title: 'Pay per verified customer', blurb: 'Top up a prepaid wallet. Each verified customer is charged once, at a price you can see before you add a rupee. No monthly fee, no contract.' },
];

const INCLUDED: { icon: typeof Check; title: string; blurb: string }[] = [
  { icon: Smartphone, title: 'An app-style page for your business', blurb: 'One clean page that works like a small app on a phone, in a look that suits your trade. Share the link anywhere.' },
  { icon: ShieldCheck, title: 'Details stay private', blurb: 'Visitors see your business name, services and products. They contact you only through us, so your number and address are never published.' },
  { icon: Check, title: 'Your leads, one tap to call', blurb: 'New customers appear in your LeadSpace app with their request. Call or message in one tap, and set a day to call again.' },
  { icon: Wallet, title: 'Every rupee accounted for', blurb: 'See exactly where your wallet money went, by day and by customer, and download it as a spreadsheet. GST tax invoice for every refill.' },
  { icon: BarChart3, title: 'Know what is working', blurb: 'Page views, taps, started requests and verified customers in one simple view, so you know your real cost per customer.' },
  { icon: Check, title: 'Bookings, appointments, visits and orders', blurb: 'Pick the one thing you want visitors to do. Orders are requests you confirm; no payment is taken on the page.' },
];

const WHO = ['Drivers and travel', 'Freelancers', 'Clinics', 'Tutors', 'Salons and beauty', 'Photographers and events', 'Home services', 'Builders and interiors', 'Real estate agents', 'Start-ups', 'Small shops', 'Food and catering'];

const FAQ = [
  { q: 'Is LeadSpace really free?', a: 'The page is free and there is no monthly fee. You pay only when a customer verifies their number on WhatsApp, from a wallet you top up yourself. The price per verified customer depends on your trade and city and is shown to you before you add money.' },
  { q: 'What if my wallet runs out?', a: 'Your page keeps working. New customers are held for you and shown with a hidden number; when you refill, they are released oldest first. You can choose instead to show customers a polite message.' },
  { q: 'What if a lead is not real?', a: 'Report it from the lead within the dispute window. Our team checks it and, if it is a wrong number, spam or the same customer again, the amount goes back to your wallet.' },
  { q: 'What if a customer starts but does not finish?', a: 'You are charged only for a customer who completed the request and confirmed the WhatsApp code. A request that was started and never confirmed is never charged, and it is never shown to you as a lead.' },
  { q: 'Will my phone number be on the page?', a: 'No. Visitors cannot see your phone number, e-mail or address. They send their request through your page, and we pass it to you.' },
  { q: 'Which businesses can use it?', a: 'Drivers, freelancers, clinics, tutors, salons, photographers, home services, builders, real estate, start-ups, small shops, food and caterers, and more. Advocates and clinics get information-only pages and are not promoted unless our team allows it; real estate needs a RERA number.' },
  { q: 'I run a bigger business. Is there more?', a: 'Yes. DomainApp (Essentials and Pro) adds your full industry website, billing and GST invoices, stock, accounts and a customer CRM. Every plan includes LeadSpace credit for your wallet, and your leads flow in automatically.' },
  { q: 'Do you also run ads for businesses?', a: 'Yes, as a separate optional service called Managed Ads, where our team runs paid ads on your behalf for a monthly fee. It is not part of LeadSpace. See the pricing page for details.' },
];

export default function LeadSpacePage() {
  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60rem]">
        <div className="absolute -left-20 -top-32 h-[36rem] w-[36rem] rounded-full bg-primary-600/15 blur-[130px]" />
        <div className="absolute right-0 top-16 h-[28rem] w-[28rem] rounded-full bg-warning-500/10 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      {/* HERO */}
      <section className="relative mx-auto max-w-3xl px-4 pb-6 pt-16 text-center sm:px-6 md:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
          LeadSpace · Your online visible partner
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          A free page for your business. <span className="text-gradient-hero">Pay only for customers who verify.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          Get found online in minutes, with no website to build and no ads to manage. Every enquiry, booking, appointment, site visit and order is confirmed on WhatsApp before it reaches you.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="/register?product=leadspace" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
            Create your free page <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a href="#how" className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-800 sm:w-auto">
            How it works
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-500">No monthly fee. No contract. Your wallet, your control.</p>
      </section>

      {/* WHO IT IS FOR */}
      <section className="relative mx-auto max-w-4xl px-4 pb-4 pt-8 sm:px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Made for people who sell their time and skill</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {WHO.map((w) => <span key={w} className="rounded-full border border-white/5 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">{w}</span>)}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {HOW.map((h, i) => (
            <div key={h.title} className="rounded-2xl border border-white/5 bg-slate-800/60 p-6 backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500/20 text-sm font-bold text-primary-300">{i + 1}</div>
              <h2 className="mt-4 text-base font-bold text-white">{h.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{h.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section className="relative mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">What you get, <span className="text-gradient-hero">free page included</span></h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {INCLUDED.map((x) => {
            const Icon = x.icon;
            return (
              <div key={x.title} className="flex gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-5">
                <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-300" aria-hidden />
                <div><p className="text-sm font-semibold text-white">{x.title}</p><p className="mt-0.5 text-sm text-slate-400">{x.blurb}</p></div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-slate-400">The price of a verified customer is set per trade and city and shown to you before you add a rupee. A customer who is not real can be reported and the amount comes back to your wallet.</p>
      </section>

      {/* BIGGER BUSINESS */}
      <section className="relative border-t border-white/5 bg-slate-900/40 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Running a bigger business?</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">DomainApp gives you your full industry website and the software behind it: billing and GST invoices, stock, accounts and a customer CRM. LeadSpace is included, with credit for your wallet every year, and your leads flow in automatically.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/pricing" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-800">See DomainApp plans <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/book-demo" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-800">Book a free demo</Link>
          </div>
        </div>
      </section>

      <Faq items={FAQ} subtitle="LeadSpace, explained." />
    </div>
  );
}
