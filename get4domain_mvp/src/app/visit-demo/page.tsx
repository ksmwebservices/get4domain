import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import VisitDemoForm from './VisitDemoForm';
import VisitDemoIntro from './VisitDemoIntro';

// A gate, not content: it must never be indexed. Not disallowed in robots.txt on purpose, so a crawler can fetch it and read the noindex.
// The X-Robots-Tag header (next.config.ts) says the same for every query variant. Its own title and description keep it from inheriting the home page's.
export const metadata: Metadata = {
  title: { absolute: 'Verify to view a demo | Get4Domain' },
  description: 'Demos are shown after a quick mobile verification. Verify your number to view a Get4Domain industry demo.',
  robots: { index: false, follow: false },
};

const inputSkeleton = 'h-[42px] w-full rounded-xl border border-white/10 bg-slate-800/60';

/**
 * Server page. The shell, the heading and the explanation are plain HTML that is in the page source with no JavaScript; only the form, which
 * reads `?to=` and talks to the OTP API, is a client island. Its Suspense fallback is the same heading plus a disabled form skeleton, so the
 * raw HTML is never just "Loading…".
 */
export default function VisitDemoPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-16 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-24 h-[30rem] w-[30rem] rounded-full bg-primary-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-warning-500/10 blur-[110px]" />
      </div>
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl">
        <Suspense
          fallback={(
            <>
              <VisitDemoIntro />
              <div aria-hidden className="mt-5 space-y-3">
                <div className={inputSkeleton} />
                <div className={inputSkeleton} />
                <div className="h-[42px] w-full rounded-xl bg-warning-400/40" />
              </div>
            </>
          )}
        >
          <VisitDemoForm />
        </Suspense>
        <p className="mt-4 text-center text-[11px] text-slate-500">No spam · Your number is only used to verify you.</p>
        <p className="mt-2 text-center text-[11px] text-slate-500"><Link href="/" className="hover:text-slate-300">← Back to Get4Domain</Link></p>
      </div>
    </div>
  );
}
