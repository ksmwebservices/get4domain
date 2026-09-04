import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Rocket, CheckCircle2 } from 'lucide-react';
import { getCategory } from '@/data/demo-site';

export const metadata: Metadata = {
  title: "You're ready to build",
  description: 'You have explored the demos — let us turn one into your own live website with payments, bookings and enquiries.',
  robots: { index: false },
};

/**
 * Warm-lead conversion page. A visitor reaches here after using their 3 demo views
 * (or trying to jump to a different category) — they are a serious prospect, so this
 * converts rather than walls them off. The lead already exists in TeleCRM from the
 * OTP gate; this hands them the next step.
 */
export default async function TalkToSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; cat?: string }>;
}) {
  const { reason, cat } = await searchParams;
  const catName = cat ? getCategory(cat)?.name ?? '' : '';
  const capped = reason === 'cap_reached';

  const heading = capped
    ? "You've seen enough — let's build yours"
    : `Ready to build your ${catName || 'business'} website?`;
  const sub = capped
    ? "You've explored three live demos. Clearly you're serious about getting online — so let's turn what you've seen into your own site, with real bookings, enquiries and payments."
    : `You're already exploring ${catName || 'this industry'}. Instead of more demos, let's get your own site live — customised to your business in 24 hours.`;

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary-600/15 blur-[120px]" />
        <div className="absolute right-0 top-10 h-[26rem] w-[26rem] rounded-full bg-warning-500/10 blur-[110px]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-5 py-20 text-center md:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-warning-300 backdrop-blur-xl">
          <Rocket className="h-3.5 w-3.5" /> {capped ? 'Warm lead — you get priority onboarding' : "Let's get you live"}
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">{heading}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">{sub}</p>

        <ul className="mx-auto mt-8 grid max-w-lg gap-2.5 text-left sm:grid-cols-2">
          {['Live in 24 hours', 'Real bookings & payments', 'WhatsApp, SMS & email built in', 'Your own domain'].map((f) => (
            <li key={f} className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-slate-800/50 px-4 py-3 text-sm text-slate-200">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success-400" /> {f}
            </li>
          ))}
        </ul>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/book-demo" className="group inline-flex items-center gap-2 rounded-xl bg-warning-400 px-7 py-3.5 text-sm font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber">
            <CalendarClock className="h-4 w-4" /> Book a call with us
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-7 py-3.5 text-sm font-medium text-white hover:bg-white/5">
            Get started now
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Want to keep exploring? <Link href="/industries" className="text-primary-300 hover:text-primary-200">See all industries</Link>
        </p>
      </div>
    </div>
  );
}
