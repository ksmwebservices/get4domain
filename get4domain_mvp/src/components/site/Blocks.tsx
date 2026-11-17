import Link from 'next/link';

const PRIMARY = 'rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white';
const SECONDARY = 'rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-900';

/** A list of questions and answers (the same text goes into the page's FAQPage JSON-LD). */
export function FaqList({ id, heading, items }: { id: string; heading: string; items: ReadonlyArray<{ q: string; a: string }> }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="mb-3 text-xl font-semibold text-slate-900">{heading}</h2>
      <dl className="space-y-4">{items.map((f) => (<div key={f.q}><dt className="font-medium text-slate-900">{f.q}</dt><dd className="mt-1 text-slate-700">{f.a}</dd></div>))}</dl>
    </section>
  );
}

/** Calls to action: the first is the main one. `href` values are site paths. */
export function CtaRow({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <p className="mt-4 flex flex-wrap gap-3">
      {links.map((l, i) => <Link key={l.href + l.label} href={l.href} className={i === 0 ? PRIMARY : SECONDARY}>{l.label}</Link>)}
    </p>
  );
}

/** A box with a heading and a call to action at the foot of a page. */
export function CtaBox({ id, heading, body, links }: { id: string; heading: string; body?: string; links: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <section aria-labelledby={id} className="mt-10 rounded-xl border border-slate-200 p-5">
      <h2 id={id} className="text-xl font-semibold text-slate-900">{heading}</h2>
      {body ? <p className="mt-2 text-slate-700">{body}</p> : null}
      <CtaRow links={links} />
    </section>
  );
}

/** A numbered list of steps, each with a title and a sentence. */
export function Steps({ id, heading, steps }: { id: string; heading: string; steps: ReadonlyArray<{ title: string; body: string }> }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-semibold text-slate-900">{heading}</h2>
      <ol className="mt-3 space-y-3">{steps.map((s, i) => (<li key={s.title}><h3 className="font-medium text-slate-900">{i + 1}. {s.title}</h3><p className="text-slate-700">{s.body}</p></li>))}</ol>
    </section>
  );
}
