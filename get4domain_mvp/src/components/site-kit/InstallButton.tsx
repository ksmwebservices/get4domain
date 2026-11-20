'use client';

import { useEffect, useRef, useState } from 'react';
import { detectPlatform, installAvailable, installSteps, type InstallPlatform } from '@/lib/v3-public/site-kit/pwa';

/**
 * "Install app": a PWA install in the style of the Android and iOS download buttons. Shows on phones and tablets only (never on a computer, never when the site already runs
 * as an installed app). Android Chrome: the browser's own install prompt. iOS Safari, or an Android browser that has offered no prompt: a short Add to Home Screen guide.
 * It is a plain button that opens nothing on the page's own address, so it is allowed on a Free (information only) site too.
 */
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export default function InstallButton({ appName }: { appName: string }) {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [open, setOpen] = useState(false);
  const deferred = useRef<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const p = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
    setPlatform(installAvailable(p, standalone) ? p : null);
    const onPrompt = (e: Event): void => { e.preventDefault(); deferred.current = e as InstallPromptEvent; };
    const onInstalled = (): void => { deferred.current = null; setPlatform(null); setOpen(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (!platform) return null;
  const click = async (): Promise<void> => {
    const ev = deferred.current;
    if (platform === 'android' && ev) { deferred.current = null; await ev.prompt(); await ev.userChoice.catch(() => null); return; }
    setOpen(true);
  };
  return (
    <>
      <button type="button" className="sk-install sk-mobile-only" onClick={click} data-testid="install-app" aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></svg>
        <span><small>{platform === 'ios' ? 'ADD TO HOME SCREEN' : 'GET IT ON YOUR PHONE'}</small><b>Install app</b></span>
      </button>
      {open ? (
        <div className="sk-sheet-bg" role="presentation" onClick={() => setOpen(false)} data-testid="install-sheet">
          <div className="sk-sheet" role="dialog" aria-modal="true" aria-label={`Install ${appName}`} onClick={(e) => e.stopPropagation()}>
            <h3>Install {appName}</h3>
            <ol>{installSteps(platform).map((s) => <li key={s}>{s}</li>)}</ol>
            <button type="button" onClick={() => setOpen(false)}>Got it</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
