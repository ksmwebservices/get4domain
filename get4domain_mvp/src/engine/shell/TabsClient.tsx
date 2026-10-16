'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

/**
 * Tabs for menu categories, treatment groups, plans, package types, property types, course streams and portfolio collections: desktop tabs, and on a phone a row of chips
 * that scrolls sideways. The panels are drawn on the server (so every tab's content is in the page for search engines); only the switching is script. Arrow keys move between tabs.
 */
export default function TabsClient({ labels, panels, tabClass = '', panelClass = '' }: { labels: string[]; panels: ReactNode[]; tabClass?: string; panelClass?: string }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number): void => {
    const n = labels.length;
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault(); setActive(j); refs.current[j]?.focus();
  };
  return (
    <div data-g4d-tabs>
      <div role="tablist" aria-label="Sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 md:flex-wrap md:overflow-visible">
        {labels.map((l, i) => (
          <button key={l} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${id}-t${i}`} aria-selected={active === i} aria-controls={`${id}-p${i}`} tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)} onKeyDown={(e) => move(e, i)} data-active={active === i ? 'true' : 'false'}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors md:rounded-none ${tabClass} ${active === i ? 'border-[var(--sh-accent)] bg-[var(--sh-accent)] text-[var(--sh-accent-fg)]' : 'border-[var(--sh-border)] text-[var(--sh-muted)]'}`}>{l}</button>
        ))}
      </div>
      {panels.map((p, i) => <div key={labels[i]} role="tabpanel" id={`${id}-p${i}`} aria-labelledby={`${id}-t${i}`} hidden={active !== i} className={panelClass}>{p}</div>)}
    </div>
  );
}
