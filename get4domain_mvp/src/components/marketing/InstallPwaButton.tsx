'use client';

import { useEffect, useState } from 'react';
import { Download, Share, Check, X, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA install button with platform-correct behavior:
 * - Chromium (Android/desktop): captures `beforeinstallprompt` and fires the real
 *   native install prompt on click.
 * - iOS Safari: no programmatic install exists (Apple restriction) — clicking shows
 *   a short "Share → Add to Home Screen" instruction sheet.
 * - Other browsers with no prompt captured: same instruction sheet (generic wording).
 * - Already installed (standalone): shows an "installed" state instead of prompting.
 */
export default function InstallPwaButton({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (standalone) { setInstalled(true); return; }

    setIsIOS(/iphone|ipad|ipod/i.test(nav.userAgent));

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleClick = async () => {
    // iOS (and any browser we couldn't capture a prompt from) → manual instructions.
    if (isIOS || !deferred) { setShowHelp(true); return; }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferred(null);
  };

  if (installed) {
    return (
      <span className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-success-500/30 bg-success-500/10 px-3 py-2.5 text-sm font-semibold text-success-300 ${className}`}>
        <Check className="h-4 w-4" /> App installed
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 ${className}`}
      >
        <Download className="h-4 w-4" /> Download App
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setShowHelp(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Install Get4Domain</h3>
              <button type="button" onClick={() => setShowHelp(false)} aria-label="Close"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {isIOS ? 'Add the app to your home screen in two taps:' : 'Install it from your browser:'}
            </p>
            <ol className="mt-3 space-y-2.5">
              <li className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><Share className="h-4 w-4" /></span>
                Tap the <strong>Share</strong> icon
              </li>
              <li className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><Plus className="h-4 w-4" /></span>
                Choose <strong>Add to Home Screen</strong>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
