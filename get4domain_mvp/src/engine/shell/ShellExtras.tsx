import { MessageCircle, Phone } from 'lucide-react';
import type { ShellRuntime } from './types';

/** Floating call and WhatsApp buttons for desktop (the bottom navigation does this job on a phone). Plain links, no script. */
export function FloatingContact({ runtime }: { runtime: ShellRuntime }) {
  const { phone } = runtime.business; const wa = runtime.social.whatsapp;
  if (!phone && !wa) return null;
  const cls = 'flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sh-accent)] text-[var(--sh-accent-fg)] shadow-lg';
  return (
    <div className="fixed bottom-6 right-6 z-30 hidden flex-col gap-3 md:flex" data-g4d-floating>
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className={cls}><MessageCircle className="h-5 w-5" /></a>}
      {phone && <a href={`tel:${phone}`} aria-label="Call us" className={cls}><Phone className="h-5 w-5" /></a>}
    </div>
  );
}

/** Opening hours, drawn by the engine from the vendor's hours: a table, a card, or one line. */
export function HoursBlock({ runtime, variant = 'table', title = 'Opening hours', className = '' }: { runtime: ShellRuntime; variant?: string; title?: string; className?: string }) {
  if (!runtime.hours.length) return null;
  if (variant === 'strip') return <p className={`flex flex-wrap items-center gap-x-6 gap-y-1 text-sm ${className}`}><strong>{title}</strong>{runtime.hours.map((h) => <span key={`${h.label}${h.value}`}><span className="opacity-70">{h.label}</span> {h.value}</span>)}</p>;
  return (
    <div className={`${variant === 'card' ? 'border border-[var(--sh-border)] p-5' : ''} ${className}`} style={variant === 'card' ? { borderRadius: 'var(--sh-radius)' } : undefined}>
      <p className="mb-3 font-semibold">{title}</p>
      <dl className="divide-y divide-[var(--sh-border)] text-sm">{runtime.hours.map((h) => <div key={`${h.label}${h.value}`} className="flex justify-between gap-4 py-2"><dt className="opacity-70">{h.label}</dt><dd className="font-medium">{h.value}</dd></div>)}</dl>
    </div>
  );
}

/** The engine's map: an embedded Google map of the vendor's address (the only frame a theme may have, and it is the engine's, not the theme's). */
export function MapEmbed({ runtime, title = 'Map', height = 320, className = '' }: { runtime: ShellRuntime; title?: string; height?: number; className?: string }) {
  const a = runtime.business.address;
  if (!a) return null;
  return (
    <div className={className}>
      <iframe title={`${title}: ${runtime.business.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ width: '100%', height, border: 0 }} src={`https://maps.google.com/maps?q=${encodeURIComponent(`${runtime.business.name} ${a}`)}&output=embed`} />
      {runtime.social.maps && <p className="mt-2 text-sm"><a href={runtime.social.maps} target="_blank" rel="noopener noreferrer" className="underline">Open in Google Maps</a></p>}
    </div>
  );
}
