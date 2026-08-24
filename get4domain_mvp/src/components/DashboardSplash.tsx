'use client';

import { useRef, useState, useLayoutEffect } from 'react';
import gsap from 'gsap';

const SEEN_KEY = 'g4d_splash_seen';

/**
 * Animated brand splash for the vendor dashboard — plays once on the first
 * arrival of a browser-tab session (login / initial load), NOT on every
 * in-app navigation. Two gates enforce that:
 *   1. It lives in the dashboard layout, which the App Router does not remount
 *      between child routes.
 *   2. A sessionStorage flag suppresses replays on an incidental reload.
 *
 * The GSAP timeline reveals the new logo (scale 0.9 → 1 + fade), draws a
 * supporting underline just behind it, holds, then fades the overlay out and
 * unmounts. Honors prefers-reduced-motion.
 */
export default function DashboardSplash() {
  const [show, setShow] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Returning within the same session → hide before paint, no flash, no replay.
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SEEN_KEY)) {
      setShow(false);
      return;
    }
    sessionStorage.setItem(SEEN_KEY, '1');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const done = () => setShow(false);

    const ctx = gsap.context(() => {
      if (reduce) {
        // Static, brief hold then dismiss — no motion for reduced-motion users.
        gsap.set([logoRef.current, barRef.current], { opacity: 1 });
        gsap.to(overlayRef.current, { opacity: 0, duration: 0.3, delay: 0.9, onComplete: done });
        return;
      }
      const tl = gsap.timeline({ onComplete: done });
      tl.from(logoRef.current, { opacity: 0, scale: 0.9, duration: 0.6, ease: 'power3.out' })       // primary
        .from(barRef.current, { scaleX: 0, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.25') // secondary, arrives late
        .to({}, { duration: 0.5 })                                                                     // hold
        .to(overlayRef.current, { opacity: 0, duration: 0.5, ease: 'power1.inOut' });                  // dismiss
    }, overlayRef);

    return () => ctx.revert();
  }, []);

  if (!show) return null;

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-white via-white to-primary-50"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={logoRef}
        src="/logo.png"
        alt="Get4Domain"
        className="h-16 w-auto object-contain md:h-20"
      />
      <div ref={barRef} className="h-1 w-28 origin-left rounded-full bg-gradient-to-r from-primary-600 to-primary-400" />
    </div>
  );
}
