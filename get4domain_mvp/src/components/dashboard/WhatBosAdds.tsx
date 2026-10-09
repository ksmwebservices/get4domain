'use client';

import Link from 'next/link';
import { Layers } from 'lucide-react';
import { planDisplayName } from '@/lib/nav.generated';
import { planGains } from '@/lib/plan-features';

/** One quiet card for Essentials shops: what the next plan adds. Generated from the feature registry, so it only names what is built (and says so for what is not yet). */
export default function WhatBosAdds() {
  const next = planDisplayName('BOS');
  const built = planGains('WORKSPACE', 'BOS').filter((l) => l.state === 'INCLUDED').map((l) => l.label);
  return (
    <section aria-label={`What ${next} adds`} className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400"><Layers className="h-4 w-4" /></span>
        <div className="min-w-0 text-sm">
          <h3 className="font-bold text-ink-50">What {next} adds</h3>
          <p className="mt-1 text-ink-400">
            {built.length > 0 ? `${next} adds: ${built.slice(0, 6).join(', ')}${built.length > 6 ? ` and ${built.length - 6} more` : ''}. ` : ''}
            Everything you have already entered carries over; nothing is entered again.
          </p>
          <Link href="/dashboard/support" className="mt-2 inline-block font-semibold text-brand-400 hover:underline">Ask about {next} →</Link>
        </div>
      </div>
    </section>
  );
}
