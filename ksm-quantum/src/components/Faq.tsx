import Reveal from './Reveal';

export interface FaqItem { q: string; a: string }

/** Visible FAQ + FAQPage JSON-LD (AEO — answer engines / rich results). */
export default function Faq({ items, title = 'Frequently asked questions', eyebrow = 'FAQ' }: { items: FaqItem[]; title?: string; eyebrow?: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
  return (
    <section className="container-x py-20 md:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Reveal>
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      </Reveal>
      <div className="mt-10 grid gap-3 md:mt-12">
        {items.map((item, i) => (
          <Reveal key={item.q} delay={i * 40}>
            <details className="group card p-5 md:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-semibold md:text-lg">
                {item.q}
                <span className="text-xl text-[var(--muted)] transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] md:text-[15px]">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
