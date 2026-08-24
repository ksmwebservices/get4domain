'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import gsap from 'gsap';

interface GsapRevealProps {
  children: ReactNode;
  /** Delay before the reveal starts (seconds). */
  delay?: number;
  /** Travel distance for the upward slide (px). */
  y?: number;
  /** Animation duration (seconds). */
  duration?: number;
  className?: string;
}

/**
 * Client-only GSAP entrance wrapper: fades + slides its children up on mount.
 * Uses gsap.context scoped to the ref so every tween is reverted on unmount —
 * the pattern GSAP recommends for React/Next so nothing leaks between renders.
 */
export default function GsapReveal({
  children,
  delay = 0,
  y = 24,
  duration = 0.6,
  className,
}: GsapRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        opacity: 0,
        y,
        duration,
        delay,
        ease: 'power2.out',
      });
    }, ref);
    return () => ctx.revert(); // cleanup on unmount / re-render
  }, [delay, y, duration]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
