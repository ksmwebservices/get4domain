import { ArrowRight, MapPin } from 'lucide-react';
import type { ReSiteModel } from '../model';

/**
 * Hero — the engine's component library exposes multiple variants
 * (HeroVariantA/B/C/D per the spec). Real Estate registers the ARCHITECTURAL
 * variant: a full-bleed building image, a serif headline set large with generous
 * air, and a single gold CTA — the opposite of the marketing site's gradient hero.
 * A future industry (e.g. Restaurant) would register a different variant here.
 */
export default function ReHero({ model }: { model: ReSiteModel }) {
  const { hero, brand, stats } = model;
  return (
    <section id="top" className="relative min-h-[88vh] overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={hero.image} alt={brand.name} className="absolute inset-0 h-full w-full object-cover" />
      {/* Legibility scrim: a strong flat darken + a bottom-weighted gradient so the
          ivory serif headline stays readable over ANY photo — including bright daylight
          exteriors a vendor or the demo content may use. */}
      <div className="absolute inset-0 bg-[var(--eng-bg)]/65" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--eng-bg)] via-[var(--eng-bg)]/80 to-[var(--eng-bg)]/55" />

      <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-center px-5 pb-16 pt-36">
        <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--eng-accent)]">
          <MapPin className="h-3.5 w-3.5" /> {model.location.area}
        </p>
        <h1 className="max-w-3xl font-[family-name:var(--eng-fontDisplay)] text-4xl font-medium leading-[1.06] text-[var(--eng-fg)] drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)] sm:text-5xl md:text-6xl">
          {hero.headline}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--eng-muted)] md:text-lg">
          {hero.subline}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a href="#featured" className="group inline-flex items-center gap-2 bg-[var(--eng-accent)] px-7 py-4 text-sm font-semibold text-[var(--eng-accent-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>
            View Properties
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a href="#enquiry" className="inline-flex items-center gap-2 border border-[var(--eng-border)] px-7 py-4 text-sm font-medium text-[var(--eng-fg)] hover:border-[var(--eng-accent)]" style={{ borderRadius: 'var(--eng-radius)' }}>
            Book Site Visit
          </a>
        </div>

        <p className="mt-6 text-xs uppercase tracking-widest text-[var(--eng-muted)]">{hero.highlight}</p>

        {/* Stat band — big numbers, editorial, not cards */}
        <div className="mt-14 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 border-t border-[var(--eng-border)] pt-8 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-[family-name:var(--eng-fontDisplay)] text-3xl text-[var(--eng-fg)] md:text-4xl">{s.value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
