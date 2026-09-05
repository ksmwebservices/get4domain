'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Subtle section reveal-on-scroll (reference §33: fade/slide on entry). Progressive
 * enhancement: it only ARMS (hides + prepares to animate) after mount, so without JS
 * content is fully visible; and it does nothing when the visitor prefers reduced motion.
 * Sections already in view on load reveal immediately. Wraps a section without changing
 * its layout (the section keeps its own id/anchor for the bottom-nav + scroll-spy).
 */
export default function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add('eng-armed');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { el.classList.add('eng-in'); io.unobserve(el); }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <div ref={ref} className="eng-reveal">{children}</div>;
}
