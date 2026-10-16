import { Clock, MapPin, Phone } from 'lucide-react';
import type { ShellRuntime } from './types';
import { SocialLinks } from './SocialLinks';

/**
 * The footer every design and theme gets: the business line, quick links, contact, opening hours, social icons (an empty link hides its icon) and legal links generated for
 * the vendor. Three layouts. Real links, no script.
 */
export default function ShellFooter({ runtime, variant = 'columns', tagline, links }: { runtime: ShellRuntime; variant?: 'columns' | 'centered' | 'minimal'; tagline?: string; links?: { label: string; href: string }[] }) {
  const b = runtime.business;
  const year = new Date().getFullYear();
  const quick = (links ?? runtime.more.filter((l) => !l.external)).slice(0, 8);
  const contact = (
    <ul className="space-y-2 text-sm">
      {b.phone && <li><a href={`tel:${b.phone}`} className="inline-flex items-center gap-2 hover:text-[var(--sh-accent)]"><Phone className="h-4 w-4" />{b.phone}</a></li>}
      {b.email && <li><a href={`mailto:${b.email}`} className="hover:text-[var(--sh-accent)]">{b.email}</a></li>}
      {b.address && <li className="flex items-start gap-2 text-[var(--sh-muted)]"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{b.address}{runtime.social.maps && <> · <a href={runtime.social.maps} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--sh-accent)]">Map</a></>}</li>}
    </ul>
  );
  const hours = runtime.hours.length > 0 && (
    <dl className="space-y-1 text-sm">{runtime.hours.map((h) => <div key={`${h.label}${h.value}`} className="flex justify-between gap-4"><dt className="text-[var(--sh-muted)]">{h.label}</dt><dd>{h.value}</dd></div>)}</dl>
  );
  const legal = <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--sh-muted)]">{runtime.legal.map((l) => <li key={l.href}><a href={l.href} className="hover:text-[var(--sh-accent)]">{l.label}</a></li>)}</ul>;
  const base = 'border-t border-[var(--sh-border)] bg-[var(--sh-bg)] text-[var(--sh-fg)] pb-24 md:pb-0';
  if (variant === 'minimal') {
    return (
      <footer className={`${base} px-5 py-8`} data-g4d-footer="minimal">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm md:flex-row">
          <p className="font-medium">{b.name}</p>
          <SocialLinks social={runtime.social} />
          <div className="text-center text-xs text-[var(--sh-muted)] md:text-right"><p>© {year} {b.name}</p>{legal}</div>
        </div>
      </footer>
    );
  }
  if (variant === 'centered') {
    return (
      <footer className={`${base} px-5 py-12 text-center`} data-g4d-footer="centered">
        <p className="text-2xl font-semibold">{b.name}</p>
        {tagline && <p className="mx-auto mt-2 max-w-md text-sm text-[var(--sh-muted)]">{tagline}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">{quick.map((l) => <a key={l.href} href={l.href} className="hover:text-[var(--sh-accent)]">{l.label}</a>)}</div>
        <div className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-4">{contact}{hours}<SocialLinks social={runtime.social} className="justify-center" /></div>
        <div className="mt-8 flex flex-col items-center gap-2 text-xs text-[var(--sh-muted)]"><p>© {year} {b.name}. All rights reserved.</p>{legal}<p>Powered by Get4Domain</p></div>
      </footer>
    );
  }
  return (
    <footer className={`${base} px-5 py-12`} data-g4d-footer="columns">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div><p className="text-xl font-semibold">{b.name}</p>{tagline && <p className="mt-3 max-w-xs text-sm text-[var(--sh-muted)]">{tagline}</p>}<SocialLinks social={runtime.social} className="mt-5" /></div>
          <div><p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--sh-muted)]">Quick links</p><ul className="space-y-2 text-sm">{quick.map((l) => <li key={l.href}><a href={l.href} className="hover:text-[var(--sh-accent)]">{l.label}</a></li>)}</ul></div>
          <div><p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--sh-muted)]">Contact</p>{contact}</div>
          <div>{hours && <><p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--sh-muted)]"><Clock className="h-3.5 w-3.5" />Opening hours</p>{hours}</>}</div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--sh-border)] pt-6 text-xs text-[var(--sh-muted)] md:flex-row md:items-center"><p>© {year} {b.name}. All rights reserved. · Powered by Get4Domain</p>{legal}</div>
      </div>
    </footer>
  );
}
