/**
 * The shell (industry designs round 2): the parts every site gets, built-in design or imported theme, because they are driven by the category pack and the vendor's data:
 * the primary-action popup, the mobile bottom navigation, header actions, footer, tabs, quick view and floating contact buttons. A theme cannot draw these; it only marks where
 * they go with engine tags.
 */
export type PopupStepKind = 'choose' | 'when' | 'dates' | 'count' | 'mode' | 'cart' | 'details' | 'confirm';
export interface PopupStep { key: string; kind: PopupStepKind; label: string; source?: 'items' | 'team' | 'options'; options?: string[]; required?: boolean; showWhen?: { step: string; in: string[] } }
export interface PackShell {
  terms: { team: string; teamOne: string; items: string; itemOne: string; groups: string };
  bottomNav: { key: string; label: string; icon: string; target: string }[];
  popup: { title: string; steps: PopupStep[]; confirm: string };
}

export interface ShellItem { id: string; title: string; category?: string; description?: string; price?: string; image?: string }
export interface ShellNavSlot { key: string; label: string; icon: string; kind: 'link' | 'action' | 'cart' | 'more'; href?: string }
export interface ShellLink { label: string; href: string; external?: boolean }
export interface ShellSocial { instagram?: string; facebook?: string; youtube?: string; linkedin?: string; x?: string; whatsapp?: string; maps?: string; custom?: string; customLabel?: string }

/** Everything the interactive parts need, as plain data (it is handed to client components). */
export interface ShellRuntime {
  subdomain: string;
  /** live: really sends. preview and sample: the popup shows its success step but writes nothing. */
  mode: 'live' | 'preview' | 'sample';
  /** the address the site's pages live under, for example /site/ravi-clinic */
  base: string;
  family: string;
  goal: 'booking' | 'enquiry';
  business: { name: string; phone?: string; whatsapp?: string; email?: string; address?: string };
  popup: { title: string; steps: PopupStep[]; confirm: string; email: 'hidden' | 'optional' | 'required'; message: 'hidden' | 'optional' | 'required' };
  items: ShellItem[];
  team: { id: string; name: string }[];
  bottomNav: ShellNavSlot[];
  more: ShellLink[];
  social: ShellSocial;
  hours: { label: string; value: string }[];
  legal: ShellLink[];
  cart: { enabled: boolean };
  primaryLabel: string;
  /** the real fallback page of the popup flow (works without script) */
  flowPath: string;
}

export const SOCIAL_LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X', whatsapp: 'WhatsApp', maps: 'Google Maps' };
