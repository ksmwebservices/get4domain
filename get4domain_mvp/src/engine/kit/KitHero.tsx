import { ArrowRight } from 'lucide-react';
import type { HeroCta, KitStat } from './model';

const Img = ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} className={className} />;

function Ctas({ primary, secondary }: { primary?: HeroCta; secondary?: HeroCta }) {
  const p = primary ?? { label: 'Get started', href: '#enquiry' };
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4">
      <a href={p.href} className="group inline-flex items-center gap-2 bg-[var(--eng-accent)] px-7 py-4 text-sm font-semibold text-[var(--eng-accent-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>
        {p.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </a>
      {secondary && (
        <a href={secondary.href} target={secondary.href.startsWith('http') ? '_blank' : undefined} rel={secondary.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center gap-2 border border-[var(--eng-border)] px-7 py-4 text-sm font-medium text-[var(--eng-fg)] hover:border-[var(--eng-accent)]" style={{ borderRadius: 'var(--eng-radius)' }}>
          {secondary.label}
        </a>
      )}
    </div>
  );
}

function Stats({ items }: { items: KitStat[] }) {
  return (
    <div className="mt-12 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 border-t border-[var(--eng-border)] pt-8 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label}>
          <div className="font-[family-name:var(--eng-fontDisplay)] text-3xl text-[var(--eng-fg)] md:text-4xl">{s.value}</div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * KitHero — three genuinely different structures so industries don't share one hero:
 *  - overlay: full-bleed image, content over a legibility scrim (dark, dramatic).
 *  - split:   content on a solid ground beside a tall image (editorial, clean).
 *  - panel:   a colour panel with the headline over a shorter image banner (bold).
 */
export default function KitHero({ variant, eyebrow, headline, subline, highlight, image, stats, ctaPrimary, ctaSecondary }: {
  variant: 'overlay' | 'split' | 'panel'; eyebrow?: string; headline: string; subline: string; highlight?: string; image: string; stats?: KitStat[]; ctaPrimary?: HeroCta; ctaSecondary?: HeroCta;
}) {
  const ctas = <Ctas primary={ctaPrimary} secondary={ctaSecondary} />;
  if (variant === 'split') {
    return (
      <section id="top" className="grid min-h-[86vh] items-stretch md:grid-cols-2">
        <div className="flex flex-col justify-center px-5 pb-16 pt-32 md:px-12">
          {eyebrow && <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--eng-accent)]">{eyebrow}</p>}
          <h1 className="font-[family-name:var(--eng-fontDisplay)] text-4xl font-medium leading-[1.06] md:text-6xl">{headline}</h1>
          <p className="mt-6 max-w-md text-[var(--eng-muted)] md:text-lg">{subline}</p>
          {ctas}
          {highlight && <p className="mt-6 text-xs uppercase tracking-widest text-[var(--eng-muted)]">{highlight}</p>}
          {stats && <Stats items={stats} />}
        </div>
        <div className="relative min-h-[40vh] md:min-h-full">
          <Img src={image} alt={headline} className="absolute inset-0 h-full w-full object-cover" />
        </div>
      </section>
    );
  }

  if (variant === 'panel') {
    return (
      <section id="top" className="px-5 pb-0 pt-28">
        <div className="mx-auto max-w-6xl">
          <div className="bg-[var(--eng-accent)] px-6 py-14 text-[var(--eng-accent-fg)] md:px-14 md:py-20" style={{ borderRadius: 'var(--eng-radius)' }}>
            {eyebrow && <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] opacity-80">{eyebrow}</p>}
            <h1 className="max-w-3xl font-[family-name:var(--eng-fontDisplay)] text-4xl font-medium leading-[1.05] md:text-6xl">{headline}</h1>
            <p className="mt-5 max-w-xl opacity-90 md:text-lg">{subline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={(ctaPrimary ?? { href: '#enquiry' }).href} className="inline-flex items-center gap-2 bg-[var(--eng-bg)] px-6 py-3.5 text-sm font-semibold text-[var(--eng-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>{(ctaPrimary ?? { label: 'Get started' }).label} <ArrowRight className="h-4 w-4" /></a>
              {ctaSecondary && <a href={ctaSecondary.href} target={ctaSecondary.href.startsWith('http') ? '_blank' : undefined} rel={ctaSecondary.href.startsWith('http') ? 'noopener noreferrer' : undefined} className="inline-flex items-center gap-2 border border-current px-6 py-3.5 text-sm font-medium" style={{ borderRadius: 'var(--eng-radius)' }}>{ctaSecondary.label}</a>}
            </div>
          </div>
          <div className="relative -mt-6 aspect-[16/7] overflow-hidden" style={{ borderRadius: 'var(--eng-radius)' }}>
            <Img src={image} alt={headline} className="h-full w-full object-cover" />
          </div>
          {stats && <div className="mt-10">{<Stats items={stats} />}</div>}
        </div>
      </section>
    );
  }

  // overlay (default)
  return (
    <section id="top" className="relative min-h-[88vh] overflow-hidden">
      <Img src={image} alt={headline} className="absolute inset-0 h-full w-full object-cover" />
      {/* Legibility scrim. Uses color-mix inline styles (NOT Tailwind's [var()]/opacity,
          which can't apply opacity to an arbitrary hex var): a LEFT-weighted horizontal
          gradient so the left-aligned copy always sits on a dark ground while the photo
          still reads on the right, plus a bottom fade into the section background. */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--eng-bg) 93%, transparent), color-mix(in srgb, var(--eng-bg) 72%, transparent) 42%, color-mix(in srgb, var(--eng-bg) 28%, transparent))' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--eng-bg), transparent 55%)' }} />
      <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-center px-5 pb-16 pt-36">
        {eyebrow && <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--eng-accent)]">{eyebrow}</p>}
        <h1 className="max-w-3xl font-[family-name:var(--eng-fontDisplay)] text-4xl font-medium leading-[1.06] drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)] sm:text-5xl md:text-6xl">{headline}</h1>
        <p className="mt-6 max-w-xl leading-relaxed text-[var(--eng-muted)] md:text-lg">{subline}</p>
        {ctas}
        {highlight && <p className="mt-6 text-xs uppercase tracking-widest text-[var(--eng-muted)]">{highlight}</p>}
        {stats && <Stats items={stats} />}
      </div>
    </section>
  );
}
