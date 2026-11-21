import { Lock } from 'lucide-react';

/**
 * The heading and the one-sentence explanation of /visit-demo. No hooks and no 'use client', so the SERVER page can render it into the
 * raw HTML (what a crawler sees) and the client form can render the same markup once it takes over.
 */
export default function VisitDemoIntro() {
  return (
    <>
      <h1 className="flex items-center gap-2 text-lg font-bold"><Lock className="h-4 w-4 text-primary-300" /> Verify to view the demo</h1>
      <p className="mt-1 text-sm text-slate-400">Demos are shown after a quick mobile verification. Enter your name and number and we&apos;ll text a one-time code.</p>
    </>
  );
}
