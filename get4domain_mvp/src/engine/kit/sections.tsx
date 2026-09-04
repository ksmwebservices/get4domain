import {
  ArrowUpRight, Check, Circle, Loader2, Star, Quote,
  // broad icon set industries draw from (referenced by string name in content)
  Building2, Waves, Dumbbell, Trees, ShieldCheck, Zap, Baby, PlugZap, Drama, Laptop,
  CloudRain, Footprints, Stethoscope, HeartPulse, Syringe, Pill, Microscope, Activity,
  Scissors, Sparkles, Flower2, Bath, Utensils, ChefHat, Coffee, Wine, Bed, ConciergeBell,
  Car, Wrench, Fuel, GraduationCap, BookOpen, Trophy, Briefcase, Scale, Calculator,
  Truck, Package, Leaf, Sprout, Camera, Video, Landmark, Home, Hammer, HardHat, Ruler,
  Wifi, Clock, MapPin, Phone, Users, Award, Percent, Gift, Timer, Salad, Music,
} from 'lucide-react';
import type {
  KitFeature, KitItem, KitPerson, KitQuote, KitRow, KitStat, KitStep, KitFaqItem,
} from './model';

const ICONS: Record<string, typeof Building2> = {
  Building2, Waves, Dumbbell, Trees, ShieldCheck, Zap, Baby, PlugZap, Drama, Laptop,
  CloudRain, Footprints, Stethoscope, HeartPulse, Syringe, Pill, Microscope, Activity,
  Scissors, Sparkles, Flower2, Bath, Utensils, ChefHat, Coffee, Wine, Bed, ConciergeBell,
  Car, Wrench, Fuel, GraduationCap, BookOpen, Trophy, Briefcase, Scale, Calculator,
  Truck, Package, Leaf, Sprout, Camera, Video, Landmark, Home, Hammer, HardHat, Ruler,
  Wifi, Clock, MapPin, Phone, Users, Award, Percent, Gift, Timer, Salad, Music,
};
export const iconFor = (name: string): typeof Building2 => ICONS[name] ?? Sparkles;

export function Heading({ eyebrow, title, sub, center }: { eyebrow: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--eng-accent)]">{eyebrow}</p>
      <h2 className="mt-3 font-[family-name:var(--eng-fontDisplay)] text-3xl leading-tight md:text-[2.6rem]">{title}</h2>
      {sub && <p className="mt-4 text-[var(--eng-muted)]">{sub}</p>}
    </div>
  );
}

const Img = ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} loading="lazy" className={className} />;

/* ── Stats band ── */
export function StatsBand({ items }: { items: KitStat[] }) {
  return (
    <section className="border-y border-[var(--eng-border)] px-5 py-12">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-4">
        {items.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-[family-name:var(--eng-fontDisplay)] text-3xl text-[var(--eng-fg)] md:text-4xl">{s.value}</div>
            <div className="mt-1 text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Showcase (services / products / rooms / dishes / projects) with structural variants ── */
export function Showcase({ id, variant, eyebrow, title, sub, items }: {
  id: string; variant: 'rows' | 'cards' | 'menu' | 'tiles'; eyebrow: string; title: string; sub?: string; items: KitItem[];
}) {
  return (
    <section id={id} className="scroll-mt-20 px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        <div className="mt-12">
          {variant === 'rows' && (
            <div className="space-y-16 md:space-y-24">
              {items.map((p, i) => (
                <article key={p.title} className={`grid items-center gap-8 md:grid-cols-2 md:gap-14 ${i % 2 ? 'md:[&>figure]:order-2' : ''}`}>
                  <figure className="relative aspect-[4/3] overflow-hidden" style={{ borderRadius: 'var(--eng-radius)' }}>
                    {p.image ? <Img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                      : <div className="flex h-full w-full items-center justify-center bg-[var(--eng-surface)]"><Star className="h-8 w-8 text-[var(--eng-muted)]" /></div>}
                    {p.subtitle && <span className="absolute left-4 top-4 bg-[var(--eng-bg)]/85 px-3 py-1 text-[11px] uppercase tracking-wider text-[var(--eng-accent)]">{p.subtitle}</span>}
                  </figure>
                  <div>
                    <h3 className="font-[family-name:var(--eng-fontDisplay)] text-2xl md:text-4xl">{p.title}</h3>
                    {p.desc && <p className="mt-4 max-w-md text-[var(--eng-muted)]">{p.desc}</p>}
                    {p.meta && p.meta.length > 0 && (
                      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
                        {p.meta.map((m) => <div key={m.label}><dt className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">{m.label}</dt><dd className="mt-0.5">{m.value}</dd></div>)}
                      </dl>
                    )}
                    {p.price && <p className="mt-4 text-[var(--eng-accent)]">{p.price}</p>}
                    <a href="#enquiry" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--eng-accent)]">Enquire <ArrowUpRight className="h-4 w-4" /></a>
                  </div>
                </article>
              ))}
            </div>
          )}
          {variant === 'cards' && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <article key={p.title} className="group overflow-hidden border border-[var(--eng-border)] bg-[var(--eng-surface)]" style={{ borderRadius: 'var(--eng-radius)' }}>
                  {p.image && <figure className="aspect-[4/3] overflow-hidden"><Img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></figure>}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-[family-name:var(--eng-fontDisplay)] text-lg">{p.title}</h3>
                      {p.price && <span className="whitespace-nowrap text-sm font-semibold text-[var(--eng-accent)]">{p.price}</span>}
                    </div>
                    {p.subtitle && <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--eng-accent)]">{p.subtitle}</p>}
                    {p.desc && <p className="mt-2 text-sm text-[var(--eng-muted)]">{p.desc}</p>}
                    {p.tags && <div className="mt-3 flex flex-wrap gap-1.5">{p.tags.map((t) => <span key={t} className="border border-[var(--eng-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--eng-muted)]">{t}</span>)}</div>}
                    <a href="#enquiry" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--eng-accent)]">Enquire <ArrowUpRight className="h-3.5 w-3.5" /></a>
                  </div>
                </article>
              ))}
            </div>
          )}
          {variant === 'menu' && (
            <div className="grid gap-x-14 gap-y-6 md:grid-cols-2">
              {items.map((p) => (
                <div key={p.title} className="flex items-baseline gap-3 border-b border-dashed border-[var(--eng-border)] pb-4">
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--eng-fontDisplay)] text-lg">{p.title}{p.subtitle && <span className="ml-2 text-xs uppercase tracking-wide text-[var(--eng-accent)]">{p.subtitle}</span>}</h3>
                    {p.desc && <p className="mt-0.5 text-sm text-[var(--eng-muted)]">{p.desc}</p>}
                  </div>
                  <span className="ml-auto whitespace-nowrap font-[family-name:var(--eng-fontDisplay)] text-lg text-[var(--eng-accent)]">{p.price}</span>
                </div>
              ))}
            </div>
          )}
          {variant === 'tiles' && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {items.map((p) => (
                <a key={p.title} href="#enquiry" className="group relative aspect-square overflow-hidden" style={{ borderRadius: 'var(--eng-radius)' }}>
                  {p.image ? <Img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    : <div className="h-full w-full bg-[var(--eng-surface)]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <div className="text-sm font-semibold text-white">{p.title}</div>
                    {p.price && <div className="text-xs text-white/80">{p.price}</div>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Numbered feature index (what we build / offer) ── */
export function FeatureIndex({ id, eyebrow, title, sub, items }: {
  id: string; eyebrow: string; title: string; sub?: string; items: { label: string; blurb: string }[];
}) {
  return (
    <section id={id} className="scroll-mt-20 border-y border-[var(--eng-border)] bg-[var(--eng-surface)] px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        <div className="mt-12 grid gap-px overflow-hidden border border-[var(--eng-border)] sm:grid-cols-2 lg:grid-cols-4" style={{ background: 'var(--eng-border)' }}>
          {items.map((t, i) => (
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

/* ── Icon grid (amenities / features / facilities) ── */
export function IconGrid({ id, eyebrow, title, sub, items }: {
  id: string; eyebrow: string; title: string; sub?: string; items: KitFeature[];
}) {
  return (
    <section id={id} className="scroll-mt-20 px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((a) => {
            const Icon = iconFor(a.icon);
            return (
              <div key={a.label} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--eng-border)] text-[var(--eng-accent)]" style={{ borderRadius: 'var(--eng-radius)' }}><Icon className="h-5 w-5" /></span>
                <div>
                  <div className="text-sm text-[var(--eng-fg)]">{a.label}</div>
                  {a.desc && <div className="mt-0.5 text-xs text-[var(--eng-muted)]">{a.desc}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Rows (distances / quick facts) ── */
export function Rows({ id, eyebrow, title, sub, note, items }: {
  id: string; eyebrow: string; title: string; sub?: string; note?: string; items: KitRow[];
}) {
  return (
    <section id={id} className="scroll-mt-20 px-5 py-20 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:gap-20">
        <div><Heading eyebrow={eyebrow} title={title} sub={sub || note} /></div>
        <ul className="divide-y divide-[var(--eng-border)] self-center">
          {items.map((pt) => (
            <li key={pt.label} className="flex items-center justify-between py-4">
              <span className="flex items-center gap-3 text-[var(--eng-fg)]"><MapPin className="h-4 w-4 text-[var(--eng-accent)]" /> {pt.label}</span>
              <span className="font-[family-name:var(--eng-fontDisplay)] text-lg text-[var(--eng-accent)]">{pt.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Steps / process / timeline ── */
export function Steps({ id, eyebrow, title, sub, items }: {
  id: string; eyebrow: string; title: string; sub?: string; items: KitStep[];
}) {
  return (
    <section id={id} className="scroll-mt-20 border-y border-[var(--eng-border)] bg-[var(--eng-surface)] px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        <ol className="mt-12 grid gap-6 md:grid-cols-4">
          {items.map((c, i) => (
            <li key={c.title} className="border border-[var(--eng-border)] bg-[var(--eng-bg)] p-6" style={{ borderRadius: 'var(--eng-radius)' }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--eng-border)]">
                {c.state === 'done' ? <Check className="h-4 w-4 text-[var(--eng-accent)]" />
                  : c.state === 'active' ? <Loader2 className="h-4 w-4 animate-spin text-[var(--eng-accent)]" />
                  : <span className="font-[family-name:var(--eng-fontDisplay)] text-sm text-[var(--eng-muted)]">{i + 1}</span>}
              </span>
              <div className="mt-4 font-[family-name:var(--eng-fontDisplay)] text-lg">{c.title}</div>
              {c.desc && <div className="mt-1 text-sm text-[var(--eng-muted)]">{c.desc}</div>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Gallery mosaic ── */
export function Gallery({ id, eyebrow, title, images }: { id: string; eyebrow: string; title: string; images: string[] }) {
  if (!images.length) return null;
  return (
    <section id={id} className="scroll-mt-20 px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} />
        <div className="mt-12 grid auto-rows-[180px] grid-cols-2 gap-3 md:auto-rows-[220px] md:grid-cols-4">
          {images.slice(0, 6).map((src, i) => (
            <figure key={src} className={`overflow-hidden ${i === 0 ? 'col-span-2 row-span-2' : ''} ${i === 3 ? 'md:col-span-2' : ''}`} style={{ borderRadius: 'var(--eng-radius)' }}>
              <Img src={src} alt={`${title} ${i + 1}`} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── People (doctors / stylists / faculty / team) ── */
export function People({ id, eyebrow, title, sub, items }: {
  id: string; eyebrow: string; title: string; sub?: string; items: KitPerson[];
}) {
  return (
    <section id={id} className="scroll-mt-20 border-y border-[var(--eng-border)] bg-[var(--eng-surface)] px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((m) => (
            <div key={m.name} className="border border-[var(--eng-border)] bg-[var(--eng-bg)] p-5 text-center" style={{ borderRadius: 'var(--eng-radius)' }}>
              <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border border-[var(--eng-border)]">
                {m.image ? <Img src={m.image} alt={m.name} className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center bg-[var(--eng-surface)] text-[var(--eng-accent)]"><Users className="h-8 w-8" /></div>}
              </div>
              <h3 className="mt-3 font-[family-name:var(--eng-fontDisplay)] text-lg">{m.name}</h3>
              {m.role && <p className="text-sm text-[var(--eng-accent)]">{m.role}</p>}
              {m.note && <p className="mt-1 text-xs text-[var(--eng-muted)]">{m.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ── */
export function Testimonials({ id, eyebrow, title, items }: { id: string; eyebrow: string; title: string; items: KitQuote[] }) {
  return (
    <section id={id} className="scroll-mt-20 px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((q) => (
            <blockquote key={q.author} className="border border-[var(--eng-border)] bg-[var(--eng-surface)] p-6" style={{ borderRadius: 'var(--eng-radius)' }}>
              <Quote className="h-6 w-6 text-[var(--eng-accent)]" />
              <p className="mt-3 text-sm leading-relaxed text-[var(--eng-fg)]">{q.quote}</p>
              <footer className="mt-4 text-sm"><span className="font-semibold">{q.author}</span>{q.note && <span className="text-[var(--eng-muted)]"> · {q.note}</span>}</footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ (native details/summary — no JS) ── */
export function Faq({ id, eyebrow, title, items }: { id: string; eyebrow: string; title: string; items: KitFaqItem[] }) {
  return (
    <section id={id} className="scroll-mt-20 border-y border-[var(--eng-border)] bg-[var(--eng-surface)] px-5 py-20 md:py-24">
      <div className="mx-auto max-w-3xl">
        <Heading eyebrow={eyebrow} title={title} center />
        <div className="mt-10 divide-y divide-[var(--eng-border)]">
          {items.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[var(--eng-fg)]">
                <span className="font-medium">{f.q}</span>
                <Circle className="h-2 w-2 shrink-0 fill-[var(--eng-accent)] text-[var(--eng-accent)] transition-transform group-open:scale-150" />
              </summary>
              <p className="mt-3 text-sm text-[var(--eng-muted)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Mid-page CTA band ── */
export function CtaBand({ id, title, sub, image }: { id: string; title: string; sub?: string; image?: string }) {
  return (
    <section id={id} className="relative overflow-hidden px-5 py-24">
      {image && <><Img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-[var(--eng-bg)]/80" /></>}
      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="font-[family-name:var(--eng-fontDisplay)] text-3xl md:text-5xl">{title}</h2>
        {sub && <p className="mx-auto mt-4 max-w-xl text-[var(--eng-muted)]">{sub}</p>}
        <a href="#enquiry" className="mt-8 inline-flex bg-[var(--eng-accent)] px-7 py-3.5 text-sm font-semibold text-[var(--eng-accent-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>Get in touch</a>
      </div>
    </section>
  );
}
