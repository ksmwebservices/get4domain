import {
  ArrowUpRight, MapPin, Building2, Waves, Dumbbell, Trees, ShieldCheck, Zap,
  Baby, PlugZap, Drama, Laptop, CloudRain, Footprints, Check, Circle, Loader2,
} from 'lucide-react';
import type { ReSiteModel, ReProject } from '../model';

const AMENITY_ICONS: Record<string, typeof Building2> = {
  Building2, Waves, Dumbbell, Trees, ShieldCheck, Zap, Baby, PlugZap, Drama, Laptop, CloudRain, Footprints,
};

/** Section eyebrow + serif heading used across the RE site for a consistent editorial rhythm. */
function Heading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--eng-accent)]">{eyebrow}</p>
      <h2 className="mt-3 font-[family-name:var(--eng-fontDisplay)] text-3xl leading-tight md:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-[var(--eng-muted)]">{sub}</p>}
    </div>
  );
}

/* ── Featured projects: alternating, image-led editorial rows (not a 3-card grid) ── */
export function ReFeaturedProjects({ projects }: { projects: ReProject[] }) {
  return (
    <section id="featured" className="scroll-mt-20 px-5 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow="The portfolio" title="Projects worth a visit" sub="Each address is chosen for connectivity, then built to a standard we would live in ourselves." />
        <div className="mt-14 space-y-16 md:space-y-24">
          {projects.map((p, i) => (
            <article key={p.id} className={`grid items-center gap-8 md:grid-cols-2 md:gap-14 ${i % 2 ? 'md:[&>figure]:order-2' : ''}`}>
              <figure className="relative aspect-[4/3] overflow-hidden" style={{ borderRadius: 'var(--eng-radius)' }}>
                {p.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                  : <div className="flex h-full w-full items-center justify-center bg-[var(--eng-surface)] text-[var(--eng-muted)]"><Building2 className="h-10 w-10" /></div>}
                {p.status && <span className="absolute left-4 top-4 bg-[var(--eng-bg)]/85 px-3 py-1 text-[11px] uppercase tracking-wider text-[var(--eng-accent)]">{p.status}</span>}
              </figure>
              <div>
                {p.location && <p className="flex items-center gap-1.5 text-sm text-[var(--eng-muted)]"><MapPin className="h-3.5 w-3.5" /> {p.location}</p>}
                <h3 className="mt-2 font-[family-name:var(--eng-fontDisplay)] text-2xl md:text-4xl">{p.name}</h3>
                {p.description && <p className="mt-4 max-w-md text-[var(--eng-muted)]">{p.description}</p>}
                <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
                  {p.config && <div><dt className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Configuration</dt><dd className="mt-0.5">{p.config}</dd></div>}
                  {p.area && <div><dt className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Area</dt><dd className="mt-0.5">{p.area}</dd></div>}
                  {p.priceLabel && <div><dt className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Price</dt><dd className="mt-0.5 text-[var(--eng-accent)]">{p.priceLabel}</dd></div>}
                </dl>
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {p.tags.map((t) => <span key={t} className="border border-[var(--eng-border)] px-2.5 py-1 text-[11px] uppercase tracking-wide text-[var(--eng-muted)]">{t}</span>)}
                  </div>
                )}
                <a href="#enquiry" className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--eng-accent)]">
                  Enquire about {p.name.split(' ').slice(0, 2).join(' ')} <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Property types: an understated 4-up index, not marketing cards ── */
export function RePropertyTypes({ model }: { model: ReSiteModel }) {
  return (
    <section id="types" className="scroll-mt-20 border-y border-[var(--eng-border)] bg-[var(--eng-surface)] px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow="What we build" title="One developer, four ways to live" />
        <div className="mt-12 grid gap-px overflow-hidden border border-[var(--eng-border)] sm:grid-cols-2 lg:grid-cols-4" style={{ background: 'var(--eng-border)' }}>
          {model.propertyTypes.map((t, i) => (
            <div key={t.label} className="bg-[var(--eng-bg)] p-7">
              <span className="font-[family-name:var(--eng-fontDisplay)] text-sm text-[var(--eng-accent)]">0{i + 1}</span>
              <h3 className="mt-3 font-[family-name:var(--eng-fontDisplay)] text-xl">{t.label}</h3>
              <p className="mt-2 text-sm text-[var(--eng-muted)]">{t.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Location advantages: connectivity list with distances + a note ── */
export function ReLocation({ model }: { model: ReSiteModel }) {
  return (
    <section id="location" className="scroll-mt-20 px-5 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:gap-20">
        <div>
          <Heading eyebrow="Location" title={model.location.area} sub={model.location.note} />
        </div>
        <ul className="divide-y divide-[var(--eng-border)] self-center">
          {model.location.points.map((pt) => (
            <li key={pt.label} className="flex items-center justify-between py-4">
              <span className="flex items-center gap-3 text-[var(--eng-fg)]"><MapPin className="h-4 w-4 text-[var(--eng-accent)]" /> {pt.label}</span>
              <span className="font-[family-name:var(--eng-fontDisplay)] text-lg text-[var(--eng-accent)]">{pt.distance}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Amenities: a dense refined icon index (12 items), never 3 marketing cards ── */
export function ReAmenities({ model }: { model: ReSiteModel }) {
  return (
    <section id="amenities" className="scroll-mt-20 border-y border-[var(--eng-border)] bg-[var(--eng-surface)] px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow="Amenities" title="A community, not just a building" />
        <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {model.amenities.map((a) => {
            const Icon = AMENITY_ICONS[a.icon] ?? Building2;
            return (
              <div key={a.label} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--eng-border)] text-[var(--eng-accent)]" style={{ borderRadius: 'var(--eng-radius)' }}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm text-[var(--eng-fg)]">{a.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Floor plans: configuration index ── */
export function ReFloorPlans({ model }: { model: ReSiteModel }) {
  return (
    <section id="floor-plans" className="scroll-mt-20 px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow="Configurations" title="Floor plans & pricing" sub="Indicative configurations. Full floor plates and the price breakup are shared on your site visit." />
        <div className="mt-12 overflow-hidden border border-[var(--eng-border)]" style={{ borderRadius: 'var(--eng-radius)' }}>
          {model.floorPlans.map((fp, i) => (
            <div key={fp.config} className={`grid grid-cols-3 items-center gap-4 px-6 py-5 ${i ? 'border-t border-[var(--eng-border)]' : ''}`}>
              <span className="font-[family-name:var(--eng-fontDisplay)] text-xl">{fp.config}</span>
              <span className="text-sm text-[var(--eng-muted)]">{fp.area}</span>
              <span className="text-right text-sm text-[var(--eng-accent)]">{fp.priceLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Gallery: an asymmetric mosaic, not a uniform grid ── */
export function ReGallery({ images, brand }: { images: string[]; brand: string }) {
  if (images.length === 0) return null;
  return (
    <section id="gallery" className="scroll-mt-20 border-t border-[var(--eng-border)] bg-[var(--eng-surface)] px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow="Gallery" title="A closer look" />
        <div className="mt-12 grid auto-rows-[180px] grid-cols-2 gap-3 md:auto-rows-[220px] md:grid-cols-4">
          {images.slice(0, 6).map((src, i) => (
            <figure key={src} className={`overflow-hidden ${i === 0 ? 'col-span-2 row-span-2' : ''} ${i === 3 ? 'md:col-span-2' : ''}`} style={{ borderRadius: 'var(--eng-radius)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${brand} — ${i + 1}`} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" loading="lazy" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Construction status: a horizontal progress timeline ── */
export function ReConstruction({ model }: { model: ReSiteModel }) {
  return (
    <section id="construction" className="scroll-mt-20 px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow="Progress" title="Where the build stands" sub="Transparency on delivery — updated as each stage completes." />
        <ol className="mt-12 grid gap-6 md:grid-cols-4">
          {model.construction.map((c, i) => (
            <li key={c.phase} className="relative border border-[var(--eng-border)] p-6" style={{ borderRadius: 'var(--eng-radius)' }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--eng-border)]">
                {c.state === 'done' ? <Check className="h-4 w-4 text-[var(--eng-accent)]" />
                  : c.state === 'active' ? <Loader2 className="h-4 w-4 animate-spin text-[var(--eng-accent)]" />
                  : <Circle className="h-3 w-3 text-[var(--eng-muted)]" />}
              </span>
              <div className="mt-4 text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Stage {i + 1}</div>
              <div className="mt-1 font-[family-name:var(--eng-fontDisplay)] text-lg">{c.phase}</div>
              <div className="mt-1 text-xs capitalize text-[var(--eng-accent)]">{c.state === 'upcoming' ? 'Upcoming' : c.state === 'active' ? 'In progress' : 'Complete'}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Footer ── */
export function ReFooter({ model }: { model: ReSiteModel }) {
  const { brand } = model;
  return (
    <footer className="border-t border-[var(--eng-border)] bg-[var(--eng-bg)] px-5 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="font-[family-name:var(--eng-fontDisplay)] text-xl">{brand.name}</div>
            <p className="mt-3 max-w-sm text-sm text-[var(--eng-muted)]">{brand.tagline}</p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Contact</div>
            <ul className="mt-3 space-y-2 text-sm">
              {brand.phone && <li><a href={`tel:${brand.phone}`} className="hover:text-[var(--eng-accent)]">{brand.phone}</a></li>}
              {brand.email && <li><a href={`mailto:${brand.email}`} className="hover:text-[var(--eng-accent)]">{brand.email}</a></li>}
              {brand.address && <li className="text-[var(--eng-muted)]">{brand.address}</li>}
            </ul>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Visit</div>
            <a href="#enquiry" className="mt-3 inline-block bg-[var(--eng-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--eng-accent-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>Book a site visit</a>
            {brand.businessHours && <p className="mt-3 text-xs text-[var(--eng-muted)]">{brand.businessHours}</p>}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-[var(--eng-border)] pt-6 text-xs text-[var(--eng-muted)] sm:flex-row">
          <p>© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
          <p>Powered by Get4Domain</p>
        </div>
      </div>
    </footer>
  );
}
