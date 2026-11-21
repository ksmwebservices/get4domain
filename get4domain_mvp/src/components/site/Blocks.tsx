import Link from 'next/link';
import { FaqAccordion } from '@/components/portal/Section';
import { btn } from '@/components/portal/ui';

/** A list of questions and answers (the same text goes into the page's FAQPage JSON-LD), as disclosure elements. */
export function FaqList({ id, heading, items }: { id: string; heading: string; items: ReadonlyArray<{ q: string; a: string }> }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="mb-4 text-2xl font-bold tracking-tight text-ink-900">{heading}</h2>
      <div className="max-w-3xl"><FaqAccordion items={items} /></div>
    </section>
  );
}

/** Calls to action: the first is the main one. `href` values are site paths. */
export function CtaRow({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <p className="mt-5 flex flex-wrap gap-3">
      {links.map((l, i) => <Link key={l.href + l.label} href={l.href} className={btn(i === 0 ? 'primary' : 'secondary')}>{l.label}</Link>)}
    </p>
  );
}

/** A panel with a heading and a call to action at the foot of a page. */
export function CtaBox({ id, heading, body, links }: { id: string; heading: string; body?: string; links: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <section aria-labelledby={id} className="mt-12 rounded-3xl bg-gradient-to-br from-brand-50 via-white to-gold-50 p-6 sm:p-8">
      <h2 id={id} className="text-2xl font-bold tracking-tight text-ink-900">{heading}</h2>
      {body ? <p className="mt-2 max-w-2xl text-slate-700">{body}</p> : null}
      <CtaRow links={links} />
    </section>
  );
}

/** A numbered list of steps, each a card with a title and a sentence. */
export function Steps({ id, heading, steps }: { id: string; heading: string; steps: ReadonlyArray<{ title: string; body: string }> }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="text-2xl font-bold tracking-tight text-ink-900">{heading}</h2>
      <ol className={`mt-5 grid gap-4 ${steps.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
            <h3 className="mt-4 text-lg font-bold text-ink-900">{s.title}</h3>
            <p className="mt-2 text-sm text-slate-700">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
