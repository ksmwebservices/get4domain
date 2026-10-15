import { ArrowUpRight, Check, Clock, MessageCircle, Phone } from 'lucide-react';
import type { KitBeforeAfter, KitBrand, KitItem, KitRow } from './model';
import { Heading } from './sections';
import { AddToCartButton } from '../components/EngineCart';

/**
 * Sections added for the industry designs (15 Oct 2026). Each one has three layouts that differ in structure, not only in colour. They are server components
 * (no script) except where a visitor must interact: the product filter, the menu tabs and the before/after slider (design-client.tsx).
 */
const Img = ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />;

const priceNum = (s?: string): number => { const n = parseFloat((s ?? '').replace(/,/g, '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };

export function VegMark({ v }: { v?: 'veg' | 'nonveg' | 'egg' }) {
  if (!v) return null;
  const c = v === 'veg' ? '#15803d' : v === 'nonveg' ? '#b91c1c' : '#b45309';
  return <span role="img" aria-label={v === 'veg' ? 'Vegetarian' : v === 'nonveg' ? 'Non-vegetarian' : 'Contains egg'} className="inline-flex h-4 w-4 shrink-0 items-center justify-center border-2 bg-white" style={{ borderColor: c }}><span className="h-2 w-2 rounded-full" style={{ background: c }} /></span>;
}

const Pic = ({ item, className }: { item: KitItem; className: string }) => (
  item.image
    ? <Img src={item.image} alt={item.title} className={className} />
    : <div aria-hidden className={`${className} bg-[var(--eng-surface)]`} />
);

/* ── Announcement bar: one line above the page ── */
export function AnnounceBar({ variant, text, href }: { variant: 'strip' | 'accent' | 'ticker'; text: string; href?: string }) {
  const body = href ? <a href={href} className="underline-offset-2 hover:underline">{text}</a> : <span>{text}</span>;
  const base = 'fixed inset-x-0 top-0 z-50 flex h-9 items-center justify-center overflow-hidden px-4 text-xs';
  return (
    <>
      <div aria-hidden className="h-9" />
      {variant === 'strip' && <div role="note" className={`${base} border-b border-[var(--eng-border)] bg-[var(--eng-surface)] text-[var(--eng-fg)]`}>{body}</div>}
      {variant === 'accent' && <div role="note" className={`${base} bg-[var(--eng-accent)] font-semibold text-[var(--eng-accent-fg)]`}>{body}</div>}
      {variant === 'ticker' && (
        <div role="note" className={`${base} justify-start bg-[var(--eng-accent)] font-semibold text-[var(--eng-accent-fg)]`}>
          <div className="eng-ticker-track">{[0, 1, 2, 3].map((i) => <span key={i} aria-hidden={i > 0} className="px-8">{body}</span>)}</div>
        </div>
      )}
    </>
  );
}

/* ── Trust strip: a few short promises ── */
export function TrustStrip({ variant, items }: { variant: 'icons' | 'pills' | 'divided'; items: string[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Why choose us" className="px-5 py-8">
      {variant === 'icons' && (
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-5 md:grid-cols-4">
          {items.slice(0, 4).map((t) => (
            <li key={t} className="flex items-center gap-3 text-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--eng-border)] text-[var(--eng-accent)]" style={{ borderRadius: 'var(--eng-radius)' }}><Check className="h-4 w-4" /></span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
      {variant === 'pills' && (
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2.5">
          {items.map((t) => <li key={t} className="rounded-full border border-[var(--eng-border)] bg-[var(--eng-surface)] px-4 py-2 text-xs font-medium">{t}</li>)}
        </ul>
      )}
      {variant === 'divided' && (
        <ul className="mx-auto flex max-w-6xl flex-col divide-y divide-[var(--eng-border)] border-y border-[var(--eng-border)] text-center text-xs uppercase tracking-[0.18em] text-[var(--eng-muted)] md:flex-row md:divide-x md:divide-y-0">
          {items.slice(0, 5).map((t) => <li key={t} className="flex-1 px-4 py-4">{t}</li>)}
        </ul>
      )}
    </section>
  );
}

/* ── Package cards (tours, rooms, event and photo packages) ── */
const metaOf = (p: KitItem, label: string): string | undefined => p.meta?.find((m) => m.label.toLowerCase() === label)?.value;

export function Packages({ id, variant, eyebrow, title, sub, items }: { id: string; variant: 'cards' | 'featured' | 'horizontal'; eyebrow: string; title: string; sub?: string; items: KitItem[] }) {
  const Card = ({ p, big }: { p: KitItem; big?: boolean }) => (
    <article className={`group flex h-full flex-col overflow-hidden border border-[var(--eng-border)] bg-[var(--eng-surface)] ${big ? 'md:flex-row' : ''}`} style={{ borderRadius: 'var(--eng-radius)' }}>
      <figure className={`overflow-hidden ${big ? 'aspect-[4/3] md:aspect-auto md:w-1/2' : 'aspect-[4/3]'}`}><Pic item={p} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></figure>
      <div className={`flex flex-1 flex-col p-5 ${big ? 'md:p-8' : ''}`}>
        {metaOf(p, 'duration') && <span className="mb-2 inline-flex w-fit items-center gap-1.5 border border-[var(--eng-border)] px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-[var(--eng-muted)]"><Clock className="h-3 w-3" />{metaOf(p, 'duration')}</span>}
        <h3 className={`font-[family-name:var(--eng-fontDisplay)] ${big ? 'text-2xl md:text-3xl' : 'text-xl'}`}>{p.title}</h3>
        {p.desc && <p className="mt-2 text-sm text-[var(--eng-muted)]">{p.desc}</p>}
        {metaOf(p, 'includes') && <p className="mt-3 text-xs text-[var(--eng-muted)]"><span className="font-semibold text-[var(--eng-fg)]">Includes: </span>{metaOf(p, 'includes')}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span className="text-lg font-semibold text-[var(--eng-accent)]">{p.price ?? ''}</span>
          <a href="#enquiry" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--eng-accent)]">Enquire <ArrowUpRight className="h-4 w-4" /></a>
        </div>
      </div>
    </article>
  );
  return (
    <section id={id} className="scroll-mt-24 px-5 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        {variant === 'cards' && <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.map((p) => <Card key={p.title} p={p} />)}</div>}
        {variant === 'featured' && items.length > 0 && (
          <div className="mt-10 space-y-6">
            <Card p={items[0]} big />
            {items.length > 1 && <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.slice(1).map((p) => <Card key={p.title} p={p} />)}</div>}
          </div>
        )}
        {variant === 'horizontal' && (
          <ul className="mt-10 divide-y divide-[var(--eng-border)] border-y border-[var(--eng-border)]">
            {items.map((p) => (
              <li key={p.title} className="grid items-center gap-4 py-5 sm:grid-cols-[7rem_1fr_auto] sm:gap-6">
                <figure className="hidden aspect-square overflow-hidden sm:block" style={{ borderRadius: 'var(--eng-radius)' }}><Pic item={p} className="h-full w-full object-cover" /></figure>
                <div>
                  <h3 className="font-[family-name:var(--eng-fontDisplay)] text-lg">{p.title}</h3>
                  {p.desc && <p className="mt-1 text-sm text-[var(--eng-muted)]">{p.desc}</p>}
                  <p className="mt-1 text-xs text-[var(--eng-muted)]">{[metaOf(p, 'duration'), metaOf(p, 'includes')].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
                  <span className="font-semibold text-[var(--eng-accent)]">{p.price ?? ''}</span>
                  <a href="#enquiry" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--eng-accent)]">Enquire <ArrowUpRight className="h-4 w-4" /></a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── Menu (two columns by category; photo cards). The tabbed menu is a client component. ── */
export function groupByCategory(items: KitItem[], categories: string[]): [string, KitItem[]][] {
  const order = categories.length ? categories : [...new Set(items.map((i) => i.subtitle ?? ''))];
  const out: [string, KitItem[]][] = order.map((c) => [c, items.filter((i) => (i.subtitle ?? '') === c)] as [string, KitItem[]]).filter(([, l]) => l.length);
  const rest = items.filter((i) => !order.includes(i.subtitle ?? ''));
  if (rest.length) out.push(['More', rest]);
  return out;
}

export function MenuLine({ p }: { p: KitItem }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-dashed border-[var(--eng-border)] pb-3">
      <div className="min-w-0">
        <h4 className="flex items-center gap-2 font-[family-name:var(--eng-fontDisplay)] text-lg"><VegMark v={p.veg} />{p.title}</h4>
        {p.desc && <p className="mt-0.5 text-sm text-[var(--eng-muted)]">{p.desc}</p>}
      </div>
      <span className="ml-auto whitespace-nowrap font-[family-name:var(--eng-fontDisplay)] text-lg text-[var(--eng-accent)]">{p.price ?? ''}</span>
    </div>
  );
}

export function MenuSection({ id, variant, eyebrow, title, sub, items, categories }: { id: string; variant: 'twocol' | 'photo'; eyebrow: string; title: string; sub?: string; items: KitItem[]; categories: string[] }) {
  return (
    <section id={id} className="scroll-mt-24 px-5 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        {variant === 'twocol' && (
          <div className="mt-10 space-y-10">
            {groupByCategory(items, categories).map(([cat, list]) => (
              <div key={cat}>
                {cat && <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--eng-accent)]">{cat}</h3>}
                <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">{list.map((p) => <MenuLine key={p.title} p={p} />)}</div>
              </div>
            ))}
          </div>
        )}
        {variant === 'photo' && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <article key={p.title} className="overflow-hidden border border-[var(--eng-border)] bg-[var(--eng-surface)]" style={{ borderRadius: 'var(--eng-radius)' }}>
                <figure className="aspect-[16/10] overflow-hidden"><Pic item={p} className="h-full w-full object-cover" /></figure>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="flex items-center gap-2 font-[family-name:var(--eng-fontDisplay)] text-lg"><VegMark v={p.veg} />{p.title}</h3>
                    <span className="whitespace-nowrap font-semibold text-[var(--eng-accent)]">{p.price ?? ''}</span>
                  </div>
                  {p.desc && <p className="mt-1.5 text-sm text-[var(--eng-muted)]">{p.desc}</p>}
                  <AddToCartButton name={p.title} price={priceNum(p.price)} productId={p.id} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Pricing: fees or rates drawn from the items ── */
export function Pricing({ id, variant, eyebrow, title, sub, items }: { id: string; variant: 'table' | 'cards' | 'compare'; eyebrow: string; title: string; sub?: string; items: KitItem[] }) {
  return (
    <section id={id} className="scroll-mt-24 border-y border-[var(--eng-border)] bg-[var(--eng-surface)] px-5 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} sub={sub} />
        {variant === 'table' && (
          <div className="mt-10 overflow-hidden border border-[var(--eng-border)] bg-[var(--eng-bg)]" style={{ borderRadius: 'var(--eng-radius)' }}>
            {items.map((p, i) => (
              <div key={p.title} className={`grid items-center gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] ${i ? 'border-t border-[var(--eng-border)]' : ''}`}>
                <div><h3 className="font-medium">{p.title}</h3>{p.desc && <p className="text-sm text-[var(--eng-muted)]">{p.desc}</p>}</div>
                <span className="font-semibold text-[var(--eng-accent)]">{p.price ?? 'On request'}</span>
                <a href="#enquiry" className="text-sm font-semibold text-[var(--eng-accent)]">Ask</a>
              </div>
            ))}
          </div>
        )}
        {variant === 'cards' && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <div key={p.title} className="flex flex-col border border-[var(--eng-border)] bg-[var(--eng-bg)] p-6" style={{ borderRadius: 'var(--eng-radius)' }}>
                <h3 className="font-medium">{p.title}</h3>
                <p className="mt-3 font-[family-name:var(--eng-fontDisplay)] text-3xl text-[var(--eng-accent)]">{p.price ?? 'On request'}</p>
                {p.desc && <p className="mt-3 text-sm text-[var(--eng-muted)]">{p.desc}</p>}
                <a href="#enquiry" className="mt-auto pt-5 text-sm font-semibold text-[var(--eng-accent)]">Ask about this</a>
              </div>
            ))}
          </div>
        )}
        {variant === 'compare' && (
          <div className="mt-10 grid gap-0 md:grid-cols-3">
            {items.slice(0, 3).map((p, i) => (
              <div key={p.title} className={`flex flex-col p-7 ${i === 1 ? 'z-10 scale-[1.02] bg-[var(--eng-accent)] text-[var(--eng-accent-fg)] shadow-xl' : 'border border-[var(--eng-border)] bg-[var(--eng-bg)]'}`} style={{ borderRadius: 'var(--eng-radius)' }}>
                <h3 className="font-[family-name:var(--eng-fontDisplay)] text-xl">{p.title}</h3>
                <p className="mt-4 font-[family-name:var(--eng-fontDisplay)] text-4xl">{p.price ?? 'On request'}</p>
                {p.desc && <p className={`mt-4 text-sm ${i === 1 ? 'opacity-90' : 'text-[var(--eng-muted)]'}`}>{p.desc}</p>}
                <a href="#enquiry" className={`mt-auto pt-6 text-sm font-semibold ${i === 1 ? '' : 'text-[var(--eng-accent)]'}`}>Ask about this</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Before and after: shown only once the vendor adds pairs ── */
export function BeforeAfterStatic({ id, variant, eyebrow, title, items }: { id: string; variant: 'pair' | 'stack'; eyebrow: string; title: string; items: KitBeforeAfter[] }) {
  return (
    <section id={id} className="scroll-mt-24 px-5 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Heading eyebrow={eyebrow} title={title} />
        <div className={`mt-10 ${variant === 'pair' ? 'grid gap-8 md:grid-cols-2' : 'space-y-10'}`}>
          {items.map((it, i) => (
            <figure key={`${it.before}${i}`} className={variant === 'stack' ? 'grid gap-3 sm:grid-cols-2' : ''}>
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <div className="relative aspect-[4/3] overflow-hidden" style={{ borderRadius: 'var(--eng-radius)' }}><Img src={it.before} alt={`${it.caption || title}: before`} className="h-full w-full object-cover" /><span className="absolute left-2 top-2 eng-surface-85 px-2 py-0.5 text-[11px] uppercase tracking-wider">Before</span></div>
                <div className="relative aspect-[4/3] overflow-hidden" style={{ borderRadius: 'var(--eng-radius)' }}><Img src={it.after} alt={`${it.caption || title}: after`} className="h-full w-full object-cover" /><span className="absolute left-2 top-2 bg-[var(--eng-accent)] px-2 py-0.5 text-[11px] uppercase tracking-wider text-[var(--eng-accent-fg)]">After</span></div>
              </div>
              {it.caption && <figcaption className="mt-2 text-sm text-[var(--eng-muted)] sm:col-span-2">{it.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Working hours ── */
export function Hours({ id, variant, eyebrow, title, rows }: { id: string; variant: 'table' | 'card' | 'strip'; eyebrow: string; title: string; rows: KitRow[] }) {
  if (!rows.length) return null;
  return (
    <section id={id} className="scroll-mt-24 px-5 py-14 md:py-16">
      {variant === 'table' && (
        <div className="mx-auto max-w-xl">
          <Heading eyebrow={eyebrow} title={title} />
          <dl className="mt-6 divide-y divide-[var(--eng-border)] border-y border-[var(--eng-border)]">{rows.map((r) => <div key={r.label} className="flex justify-between py-3 text-sm"><dt className="text-[var(--eng-muted)]">{r.label}</dt><dd className="font-medium">{r.value}</dd></div>)}</dl>
        </div>
      )}
      {variant === 'card' && (
        <div className="mx-auto max-w-md bg-[var(--eng-accent)] p-8 text-[var(--eng-accent-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] opacity-80"><Clock className="h-4 w-4" />{eyebrow}</p>
          <h2 className="mt-2 font-[family-name:var(--eng-fontDisplay)] text-2xl">{title}</h2>
          <dl className="mt-5 space-y-2 text-sm">{rows.map((r) => <div key={r.label} className="flex justify-between gap-4"><dt className="opacity-80">{r.label}</dt><dd className="font-semibold">{r.value}</dd></div>)}</dl>
        </div>
      )}
      {variant === 'strip' && (
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 border-y border-[var(--eng-border)] py-5 text-sm">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--eng-accent)]"><Clock className="h-4 w-4" />{title}</span>
          {rows.map((r) => <span key={r.label}><span className="text-[var(--eng-muted)]">{r.label}</span> <span className="font-medium">{r.value}</span></span>)}
        </div>
      )}
    </section>
  );
}

/* ── Mobile action bar (the "tabs" style is the original bottom navigation) ── */
export function MobileActionBar({ variant, label, phone, whatsapp }: { variant: 'cta' | 'split'; label: string; phone?: string; whatsapp?: string }) {
  const wa = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : '';
  const btn = 'flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-semibold';
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-[var(--eng-border)] eng-surface-95 p-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      {variant === 'split' && phone && <a href={`tel:${phone}`} className={`${btn} border border-[var(--eng-border)] text-[var(--eng-fg)]`} style={{ borderRadius: 'var(--eng-radius)' }}><Phone className="h-4 w-4" />Call</a>}
      {variant === 'split' && wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn} border border-[var(--eng-border)] text-[var(--eng-fg)]`} style={{ borderRadius: 'var(--eng-radius)' }}><MessageCircle className="h-4 w-4" />WhatsApp</a>}
      <a href="#enquiry" className={`${btn} bg-[var(--eng-accent)] text-[var(--eng-accent-fg)] ${variant === 'cta' ? 'flex-[3]' : 'flex-[2]'}`} style={{ borderRadius: 'var(--eng-radius)' }}>{label}</a>
      {variant === 'cta' && phone && <a href={`tel:${phone}`} aria-label="Call us" className="flex w-12 items-center justify-center border border-[var(--eng-border)] text-[var(--eng-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}><Phone className="h-4 w-4" /></a>}
    </div>
  );
}

/* ── Footer: three layouts ── */
export function DesignFooter({ variant, brand, cta }: { variant: 'columns' | 'centered' | 'minimal'; brand: KitBrand; cta: string }) {
  const socials = ([['Facebook', brand.facebook], ['Instagram', brand.instagram], ['LinkedIn', brand.linkedin], ['YouTube', brand.youtube]] as [string, string | undefined][]).filter(([, u]) => !!u);
  const year = new Date().getFullYear();
  const links = (
    <>
      {brand.phone && <a href={`tel:${brand.phone}`} className="hover:text-[var(--eng-accent)]">{brand.phone}</a>}
      {brand.email && <a href={`mailto:${brand.email}`} className="hover:text-[var(--eng-accent)]">{brand.email}</a>}
      {socials.map(([n, u]) => <a key={n} href={u} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--eng-accent)]">{n}</a>)}
    </>
  );
  if (variant === 'minimal') {
    return (
      <footer className="border-t border-[var(--eng-border)] px-5 py-8 text-xs text-[var(--eng-muted)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <p>© {year} {brand.name}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">{links}</div>
          <p>Powered by Get4Domain</p>
        </div>
      </footer>
    );
  }
  if (variant === 'centered') {
    return (
      <footer className="border-t border-[var(--eng-border)] px-5 py-14 text-center">
        <p className="font-[family-name:var(--eng-fontDisplay)] text-2xl">{brand.name}</p>
        {brand.tagline && <p className="mx-auto mt-2 max-w-md text-sm text-[var(--eng-muted)]">{brand.tagline}</p>}
        <a href="#enquiry" className="mt-6 inline-block bg-[var(--eng-accent)] px-6 py-3 text-sm font-semibold text-[var(--eng-accent-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>{cta}</a>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--eng-muted)]">{links}</div>
        {brand.address && <p className="mt-4 text-xs text-[var(--eng-muted)]">{brand.address}</p>}
        <p className="mt-8 text-xs text-[var(--eng-muted)]">© {year} {brand.name}. All rights reserved. · Powered by Get4Domain</p>
      </footer>
    );
  }
  return null;
}
