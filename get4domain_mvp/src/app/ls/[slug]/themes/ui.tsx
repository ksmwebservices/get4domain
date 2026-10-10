'use client';

import { useState } from 'react';

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** A picture that never leaves an empty gap: a trade-coloured tile with the first letter while loading fails or when there is no picture. */
export function SmartImage({ src, alt, className = '', fallbackLetter, accentColor = '#d97706', eager = false }: { src: string | null; alt: string; className?: string; fallbackLetter?: string; accentColor?: string; eager?: boolean }): React.ReactElement {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const letter = (fallbackLetter || alt.charAt(0) || '?').toUpperCase();

  if (!src || errored) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)` }}>
        <span className="text-3xl font-bold" style={{ color: accentColor }}>{letter}</span>
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="lsa-shimmer absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setLoaded(true)} onError={() => setErrored(true)} className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}
