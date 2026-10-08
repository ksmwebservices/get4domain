import Link from 'next/link';
import { Layers } from 'lucide-react';

/** One quiet card for Essentials shops: what the next plan (Pro) adds. Plain facts, no hype; only what exists today. */
export default function WhatBosAdds() {
  return (
    <section aria-label="What Pro adds" className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400"><Layers className="h-4 w-4" /></span>
        <div className="min-w-0 text-sm">
          <h3 className="font-bold text-ink-50">What Pro adds</h3>
          <p className="mt-1 text-ink-400">
            Your Essentials plan covers one shop: products, stock, orders, customers, website and invoices. Pro adds expense and GST tracking.
            More Pro tools are being built and will appear here as they are ready.
          </p>
          <Link href="/dashboard/support" className="mt-2 inline-block font-semibold text-brand-400 hover:underline">Ask about Pro →</Link>
        </div>
      </div>
    </section>
  );
}
