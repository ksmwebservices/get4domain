import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import FullBleed from '@/components/portal/FullBleed';
import { btn, CONTAINER, EYEBROW, FOCUS, H2, LEAD } from '@/components/portal/ui';

export function SectionHead({ id, eyebrow, title, lead }: { id: string; eyebrow?: string; title: string; lead?: string }) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
      <h2 id={id} className={`${H2} ${eyebrow ? 'mt-2' : ''}`}>{title}</h2>
      {lead ? <p className={LEAD}>{lead}</p> : null}
    </div>
  );
}

/** A full-width band with its own background; the content sits in the page column. */
export function Band({ id, tone = 'white', children }: { id: string; tone?: 'white' | 'soft' | 'ink'; children: ReactNode }) {
  const bg = tone === 'soft' ? 'bg-slate-50' : tone === 'ink' ? 'bg-ink-900 text-ink-100' : 'bg-white';
  return (
    <FullBleed aria-labelledby={id} className={`${bg} py-12 sm:py-16`}>
      <div className={CONTAINER}>{children}</div>
    </FullBleed>
  );
}

/** Questions and answers as native disclosure elements: keyboard and screen reader friendly, no script. The same text goes into the page's FAQPage JSON-LD. */
export function FaqAccordion({ items }: { items: ReadonlyArray<{ q: string; a: string }> }) {
  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {items.map((f) => (
        <details key={f.q} className="group px-5 py-4">
          <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-left text-base font-semibold text-ink-900 ${FOCUS}`}>
            {f.q}<ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500 motion-safe:transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-3 max-w-3xl text-slate-700">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** The closing call to action: a dark panel with a heading, a sentence and two buttons. `href` values may be paths or absolute addresses. */
export function CtaPanel({ id, title, body, primary, secondary }: { id: string; title: string; body: string; primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  return (
    <section aria-labelledby={id} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 px-6 py-10 text-center sm:px-12 sm:py-14">
      <h2 id={id} className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-ink-200">{body}</p>
      <p className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={primary.href} className={btn('gold')}>{primary.label}</Link>
        {secondary ? <Link href={secondary.href} className={btn('ghostDark')}>{secondary.label}</Link> : null}
      </p>
    </section>
  );
}
