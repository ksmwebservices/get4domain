'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ArrowRight, Sparkles, Building2, Code2, Wallet, Clock, TrendingDown } from 'lucide-react';
import { PLAN_TERMS, gstOn, totalWithGst, formatINR, USAGE_VS_MARKET, fetchLivePricing, applyLivePricing } from '@/lib/pricing';

// Real, defensible comparison — Get4Domain vs. commissioning custom development.
const COMPARISON = [
  { feature: 'Instant deploy on a ready-made site', us: true, them: 'Built from scratch' },
  { feature: 'Webapp + vendor + client apps', us: true, them: '₹2–5L+ custom dev' },
  { feature: 'WhatsApp API integration', us: true, them: '₹500–2,000/mo extra' },
  { feature: 'AI content studio', us: true, them: '₹999+/mo separate' },
  { feature: 'POS & booking system', us: true, them: '₹1,000+/mo separate' },
  { feature: 'SMS & email campaigns', us: true, them: '₹500+/mo separate' },
  { feature: 'GST invoicing', us: true, them: '₹500+/mo separate' },
  { feature: 'PWA — install on any phone', us: true, them: 'Rare / costly' },
  { feature: 'Live + customized', us: 'In 24 hours', them: '2–6 months' },
  { feature: 'Monthly cost', us: '₹999', them: '₹5,000–15,000+' },
];

export default function HomePricing() {
  const [billing, setBilling] = useState<'quarterly' | 'yearly'>('yearly');
  // Live pricing from the admin source of truth (falls back to PLAN_TERMS defaults).
  const [terms, setTerms] = useState(PLAN_TERMS);
  useEffect(() => { fetchLivePricing().then((live) => { if (live) setTerms(applyLivePricing(live)); }); }, []);
  const tier = terms[billing];
  const total = totalWithGst(tier.baseAmount);

  return (
    <section id="pricing" className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-warning-300 backdrop-blur-xl">
            <Wallet className="h-3.5 w-3.5" /> Simple pricing
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            One price. <span className="text-gradient-hero">Everything included.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            No hidden fees, no per-feature add-ons. One flat price for the whole platform — webapp, vendor app, client app and all tools. Variable usage is pay-per-use from your wallet.
          </p>
        </div>

        {/* billing toggle */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-slate-800/60 p-1 backdrop-blur-xl">
            <button onClick={() => setBilling('quarterly')} className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all ${billing === 'quarterly' ? 'text-slate-900' : 'text-slate-300'}`}>
              {billing === 'quarterly' && <span className="absolute inset-0 rounded-full bg-gradient-to-r from-primary-300 to-warning-300" />}
              <span className="relative">Monthly</span>
            </button>
            <button onClick={() => setBilling('yearly')} className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all ${billing === 'yearly' ? 'text-slate-900' : 'text-slate-300'}`}>
              {billing === 'yearly' && <span className="absolute inset-0 rounded-full bg-gradient-to-r from-primary-300 to-warning-300" />}
              <span className="relative flex items-center gap-1.5">Yearly <span className="rounded-full bg-success-500/20 px-1.5 py-0.5 text-[10px] text-success-300">Save 17%</span></span>
            </button>
          </div>
        </div>

        {/* pricing card */}
        <div className="mx-auto max-w-md">
          <div className={`relative rounded-3xl border border-white/5 bg-slate-800/60 p-8 backdrop-blur-xl ${billing === 'yearly' ? 'border-primary-400/30 shadow-glow' : ''}`}>
            {billing === 'yearly' && (
              <div className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-warning-400 px-3 py-1 text-[11px] font-semibold text-slate-900">
                <Sparkles className="h-3 w-3" /> Best value
              </div>
            )}
            <div className="mb-4 text-center">
              <div className="mb-1 text-sm text-slate-400">{tier.label}</div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-gradient-hero text-5xl font-bold">{tier.headline}</span>
                <span className="text-sm text-slate-400">{tier.headlinePeriod}</span>
              </div>
              {/* Mandatory billing + GST disclosure — never the headline alone. */}
              <div className="mt-2 space-y-0.5">
                <p className="text-xs font-medium text-warning-300">{tier.billingNote}</p>
                <p className="text-[11px] text-slate-500">
                  {formatINR(tier.baseAmount)} + {formatINR(gstOn(tier.baseAmount))} GST = <span className="font-semibold text-slate-300">{formatINR(total)}</span> {tier.cycleLabel}
                </p>
              </div>
            </div>
            <div className="mb-6 space-y-2.5">
              {tier.features.map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15"><Check className="h-3 w-3 text-primary-300" /></span>
                  <span className="text-slate-200">{f}</span>
                </div>
              ))}
            </div>
            <Link href="/book-demo" className="group flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber">
              {tier.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-3 text-center text-[11px] text-slate-500">Prices exclusive of 18% GST. Cancel anytime — site stays live until the paid term ends.</p>
          </div>
        </div>

        {/* comparison table — vs custom development */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h3 className="mb-6 text-center text-xl font-semibold text-white">
            Why pay more? <span className="text-sm font-normal text-slate-400">Get4Domain vs. custom development</span>
          </h3>
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-800/60 backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-2 border-b border-white/5 px-5 py-3 text-xs font-semibold text-slate-300">
              <span>Feature</span>
              <span className="flex items-center gap-1 text-primary-300"><Sparkles className="h-3 w-3" /> Get4Domain</span>
              <span className="flex items-center gap-1 text-slate-400"><Code2 className="h-3 w-3" /> Custom dev</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 border-b border-white/5 px-5 py-2.5 text-xs transition-colors last:border-0 hover:bg-white/[0.02]">
                <span className="text-slate-300">{row.feature}</span>
                <span className="flex items-center gap-1 text-primary-300">{row.us === true ? <Check className="h-3.5 w-3.5" /> : row.us}</span>
                <span className="text-slate-400">{row.them}</span>
              </div>
            ))}
          </div>
        </div>

        {/* item 4 — do-it-yourself / market rate vs pay-per-use */}
        <div className="mx-auto mt-12 max-w-3xl">
          <h3 className="mb-2 text-center text-xl font-semibold text-white">
            <span className="inline-flex items-center gap-2"><TrendingDown className="h-5 w-5 text-success-300" /> Pay-per-use vs. doing it manually</span>
          </h3>
          <p className="mb-6 text-center text-sm text-slate-400">
            The AI Studio &amp; Communication Hub replace freelancers, agencies and per-tool subscriptions — you pay only when you actually create or send, from your wallet.
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-800/60 backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-2 border-b border-white/5 px-5 py-3 text-xs font-semibold text-slate-300">
              <span>Task</span>
              <span className="text-slate-400">Manual / typical market rate</span>
              <span className="flex items-center gap-1 text-success-300"><Sparkles className="h-3 w-3" /> Get4Domain</span>
            </div>
            {USAGE_VS_MARKET.map((row) => (
              <div key={row.task} className="grid grid-cols-3 gap-2 border-b border-white/5 px-5 py-2.5 text-xs transition-colors last:border-0 hover:bg-white/[0.02]">
                <span className="text-slate-300">{row.task}</span>
                <span className="text-slate-400">{row.market}</span>
                <span className="font-semibold text-success-300">{row.ours}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-500">Market rates are typical Indian SMB pricing, for comparison. Get4Domain rates are wallet pay-per-use, admin-adjustable.</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[{ icon: Clock, label: 'Live in 24 hours', desc: 'instant deploy + 24h setup' }, { icon: Wallet, label: '₹999/mo', desc: 'billed quarterly, +18% GST' }, { icon: Building2, label: '20+ industries', desc: 'vs custom build each' }].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/5 bg-slate-800/60 p-4 text-center backdrop-blur-xl">
              <s.icon className="mx-auto mb-2 h-5 w-5 text-primary-300" />
              <div className="text-sm font-semibold text-slate-100">{s.label}</div>
              <div className="text-xs text-slate-400">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
