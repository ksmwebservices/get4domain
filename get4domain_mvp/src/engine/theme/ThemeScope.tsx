import type { CSSProperties, ReactNode } from 'react';
import type { ThemeTokens } from '../types';

/**
 * Applies an industry's ThemeTokens as CSS custom properties on a scoped wrapper.
 * Section components reference these via Tailwind arbitrary values
 * (e.g. `bg-[var(--eng-bg)]`, `text-[var(--eng-accent)]`,
 * `font-[family-name:var(--eng-fontDisplay)]`) so the SAME components could be
 * re-themed, and DIFFERENT industries get genuinely different identities from
 * tokens alone — without leaking styles into the marketing/dashboard trees.
 *
 * This is the reusable capability; the visual language lives in each industry's
 * own section components, not here.
 */
export default function ThemeScope({
  tokens,
  className = '',
  children,
}: {
  tokens: ThemeTokens;
  className?: string;
  children: ReactNode;
}) {
  const vars = {
    '--eng-bg': tokens.bg,
    '--eng-fg': tokens.fg,
    '--eng-surface': tokens.surface,
    '--eng-border': tokens.border,
    '--eng-muted': tokens.muted,
    '--eng-accent': tokens.accent,
    '--eng-accent-fg': tokens.accentFg,
    '--eng-accent-2': tokens.accent2,
    '--eng-fontDisplay': tokens.fontDisplay,
    '--eng-fontBody': tokens.fontBody,
    '--eng-radius': tokens.radius,
  } as CSSProperties;

  return (
    <div
      data-engine-mode={tokens.mode}
      style={{ ...vars, background: 'var(--eng-bg)', color: 'var(--eng-fg)', fontFamily: 'var(--eng-fontBody)' }}
      className={className}
    >
      {children}
    </div>
  );
}
