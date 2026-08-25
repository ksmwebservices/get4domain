'use client';

import { useEffect, useState } from 'react';

/**
 * Interactive category selector for the homepage hero. Shows REAL screenshots of
 * the actual live demo sites (captured from /demo/<category>) inside a laptop +
 * mobile device frame. Clicking a category swaps in that industry's real desktop
 * and mobile screenshots — the vendor controls what they see, no fake UI.
 *
 * Images live in /public/hero-shots/<cat>-home.webp (desktop) and
 * <cat>-mobile.webp (mobile). A gentle auto-advance runs until the first click,
 * then hands full control to the visitor (and is disabled under reduced-motion).
 */

const CATEGORIES = [
  { key: 'clinic', label: 'Clinic', icon: '🏥' },
  { key: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { key: 'salon', label: 'Salon', icon: '💇' },
  { key: 'retail', label: 'Retail', icon: '🛒' },
  { key: 'travel', label: 'Travel', icon: '🚗' },
  { key: 'professional', label: 'Pro Services', icon: '💼' },
];

export default function HeroMockup() {
  const [sel, setSel] = useState(0);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (interacted) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setSel((p) => (p + 1) % CATEGORIES.length), 3800);
    return () => clearInterval(id);
  }, [interacted]);

  const cat = CATEGORIES[sel];

  return (
    <div className="w-full">
      {/* Category selector */}
      <div className="mb-6 flex flex-wrap justify-center gap-2 lg:justify-start">
        {CATEGORIES.map((c, i) => {
          const on = i === sel;
          return (
            <button
              key={c.key}
              onClick={() => { setSel(i); setInteracted(true); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                on
                  ? 'border-primary-400/40 bg-primary-500/15 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>{c.icon}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Device mockup */}
      <div className="relative mx-auto w-full max-w-xl select-none">
        {/* Laptop */}
        <div className="relative rounded-t-2xl border-[6px] border-slate-800 bg-slate-800 shadow-2xl ring-1 ring-white/10">
          <div className="overflow-hidden rounded-t-lg bg-slate-950">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/5 bg-slate-900 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-error-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-success-500/80" />
              <div className="ml-2 flex-1 truncate rounded-md bg-slate-800 px-3 py-1 text-[10px] text-slate-400">
                {cat.key}.get4domain.com
              </div>
            </div>
            {/* Real desktop screenshot */}
            <div className="aspect-[16/10] w-full bg-white">
              <img
                key={cat.key}
                src={`/hero-shots/${cat.key}-home.webp`}
                alt={`${cat.label} website built with Get4Domain`}
                width={1280}
                height={800}
                loading="eager"
                className="h-full w-full animate-[hmFade_0.45s_ease] object-cover object-top"
              />
            </div>
          </div>
        </div>
        {/* Laptop base */}
        <div className="relative mx-auto h-3 w-[112%] -translate-x-[5.4%] rounded-b-xl bg-slate-800 shadow-xl ring-1 ring-white/10">
          <div className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-md bg-slate-700" />
        </div>

        {/* Mobile (overlapping) — real mobile screenshot */}
        <div className="absolute -bottom-8 -right-1 w-28 overflow-hidden rounded-[1.4rem] border-[5px] border-slate-800 bg-slate-800 shadow-2xl ring-1 ring-white/10 sm:-right-6 sm:w-36">
          <div className="overflow-hidden rounded-[1rem] bg-white">
            <img
              key={cat.key}
              src={`/hero-shots/${cat.key}-mobile.webp`}
              alt={`${cat.label} site on mobile`}
              width={480}
              height={1040}
              loading="eager"
              className="h-full w-full animate-[hmFade_0.45s_ease] object-cover object-top"
            />
          </div>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-slate-500 lg:text-left">
        Real sites built on Get4Domain — pick an industry to see it.
      </p>

      <style>{`@keyframes hmFade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
