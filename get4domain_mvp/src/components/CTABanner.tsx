import Link from 'next/link';
import { ArrowRight, Play, Sparkles } from 'lucide-react';

/**
 * Shared bottom CTA for inner pages — the standard dark Buy Now / Visit Demo
 * pair, consistent with the homepage bottom CTA. (Replaces the old "Let's Launch
 * Your Business the Right Way / consultant calls within 24 hours" banner.)
 */
export default function CTABanner() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-800/60 p-8 text-center backdrop-blur-xl sm:p-12">
          {/* glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-primary-500/15 blur-[80px]" />
            <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-warning-500/10 blur-[60px]" />
          </div>

          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary-500/15 px-3.5 py-1.5 text-xs font-medium text-primary-300">
            <Sparkles className="h-3.5 w-3.5" /> Get started today
          </div>

          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything your business needs, <span className="text-gradient-hero">for ₹999/month.</span>
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-slate-400">
            Instant deploy, live in 24 hours. No setup fees, no contracts, no per-feature pricing.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/book-demo" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
              Buy Now — ₹999/mo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/demo/clinic" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-slate-800/60 px-6 py-3 font-medium text-slate-100 backdrop-blur-xl transition-all hover:bg-slate-800/80 sm:w-auto">
              <Play className="h-4 w-4 text-primary-300" /> Visit Demo
            </Link>
          </div>

          <div className="mt-6 text-xs text-slate-400">
            14-day money-back guarantee · Cancel anytime · GST compliant
          </div>
        </div>
      </div>
    </section>
  );
}
