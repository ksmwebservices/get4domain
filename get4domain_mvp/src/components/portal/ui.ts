/**
 * The class strings of the portal design system (dispatch J1, P1). Tailwind scans this file because it is under src/components.
 * Tokens: brand blue (brand-600 on white is 6.3:1), gold accent, ink for dark surfaces, slate for text. Radius: xl for controls, 2xl for cards, 3xl for hero surfaces.
 * Focus ring: a 2px brand ring with an offset on every control. Motion is off under prefers-reduced-motion (motion-safe: variants only).
 */
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2';

export const BTN = {
  base: `inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${FOCUS}`,
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  gold: 'bg-gold-400 text-ink-950 hover:bg-gold-300',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
  ghostDark: 'border border-white/30 text-white hover:bg-white/10',
  small: 'px-3.5 py-2',
} as const;

export const btn = (kind: 'primary' | 'gold' | 'secondary' | 'ghostDark', small = false): string => `${BTN.base} ${BTN[kind]} ${small ? BTN.small : ''}`.trim();

export const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-card';
export const CARD_HOVER = `${CARD} transition-shadow hover:shadow-card-hover`;
export const CHIP = `inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 ${FOCUS}`;
export const INPUT = `w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-500 ${FOCUS}`;
export const LABEL = 'mb-1 block text-sm font-medium text-slate-700';
export const CONTAINER = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
export const EYEBROW = 'text-sm font-semibold uppercase tracking-wide text-brand-700';
export const H2 = 'text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl';
export const LEAD = 'mt-3 max-w-2xl text-base text-slate-600 sm:text-lg';
export const SECTION = 'py-12 sm:py-16';
export const PROSE_LINK = 'font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800';
