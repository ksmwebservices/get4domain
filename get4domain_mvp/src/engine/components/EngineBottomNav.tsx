'use client';

import { Phone, MessageCircle } from 'lucide-react';

export interface BottomNavConfig {
  primaryLabel: string;
  /** In-page anchor (e.g. '#enquiry') the primary CTA jumps to. */
  primaryHref: string;
  phone?: string;
  whatsapp?: string;
  whatsappText?: string;
}

/**
 * Base engine feature (dispatch 28-Aug-2026): a genuinely mobile-first sticky action
 * bar EVERY industry site gets automatically via EngineSiteFrame — Call · WhatsApp ·
 * the industry's primary conversion CTA. Hidden on md+ (where the top nav carries the
 * CTA). Themed entirely from the industry's `--eng-*` tokens, so it inherits each
 * industry's identity without per-industry code.
 */
export default function EngineBottomNav({ primaryLabel, primaryHref, phone, whatsapp, whatsappText }: BottomNavConfig) {
  const wa = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}${whatsappText ? `?text=${encodeURIComponent(whatsappText)}` : ''}`
    : null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-2 border-t border-[var(--eng-border)] bg-[var(--eng-bg)]/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"
      aria-label="Quick actions"
    >
      {phone && (
        <a href={`tel:${phone}`} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] text-[var(--eng-muted)]">
          <Phone className="h-5 w-5" /> Call
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] text-[var(--eng-muted)]">
          <MessageCircle className="h-5 w-5" /> WhatsApp
        </a>
      )}
      <a
        href={primaryHref}
        className="flex flex-[2] items-center justify-center bg-[var(--eng-accent)] px-4 text-sm font-semibold text-[var(--eng-accent-fg)]"
        style={{ borderRadius: 'var(--eng-radius)' }}
      >
        {primaryLabel}
      </a>
    </nav>
  );
}
