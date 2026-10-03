import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { CAPABILITIES } from '@/data/platform-features';

/**
 * Compact "everything your plan includes" strip for industry pages. Rendered from the same
 * CAPABILITIES list as Home / Features / Pricing so every page tells one story.
 */
export default function CapabilityStrip({ industry }: { industry?: string }) {
  return (
    <section className="border-t border-slate-200 bg-white py-12 lg:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {industry ? `Everything a ${industry} business needs, in one platform` : 'Every industry gets the whole platform'}
          </h2>
          <p className="mt-3 text-slate-600">Your website, CRM, accounting, HRM, inventory, communication, AI, SEO and social — all included, all adapted to your industry.</p>
        </div>
        <ul className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 text-sm text-slate-700">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />{c.title}
            </li>
          ))}
        </ul>
        <div className="mt-8 text-center">
          <Link href="/pricing" className="group inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-100">
            Compare plans &amp; pricing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
