/** Colour helpers for the design kit: contrast (WCAG), and an accent that always reads on white and a surface that always reads under dark text. Pure. */
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360; const ss = clamp(s, 0, 100) / 100; const ll = clamp(l, 0, 100) / 100;
  const k = (n: number): number => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number): number => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (v: number): string => Math.round(f(v) * 255).toString(16).padStart(2, '0');
  return `#${hex(0)}${hex(8)}${hex(4)}`;
}

function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio of two hex colours, or null when either is not a plain hex colour. */
export function contrastRatio(a: string, b: string): number | null {
  const x = luminance(a); const y = luminance(b);
  if (x === null || y === null) return null;
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

/** An accent of this hue that has at least `min`:1 contrast on `on` (darkened in small steps until it does). */
export function accentFor(hue: number, on = '#ffffff', min = 4.5, sat = 62): string {
  for (let l = 44; l >= 12; l -= 2) {
    const c = hslToHex(hue, sat, l);
    if ((contrastRatio(c, on) ?? 0) >= min) return c;
  }
  return '#111827';
}

/** The tints a theme needs from one hue: page, soft surface, border, ink and muted ink (all pass 4.5:1 for text on the page). */
export function paletteFor(hue: number, dark = false): { bg: string; surface: string; border: string; fg: string; muted: string; accent: string; accentFg: string; soft: string } {
  if (dark) {
    const bg = hslToHex(hue, 28, 9);
    let accent = hslToHex(hue, 70, 62);
    for (let l = 62; l <= 90 && (contrastRatio(accent, bg) ?? 0) < 4.5; l += 2) accent = hslToHex(hue, 70, l);
    return { bg, surface: hslToHex(hue, 24, 14), border: hslToHex(hue, 20, 24), fg: '#f5f6f8', muted: '#b6bcc8', accent, accentFg: '#0b0d12', soft: hslToHex(hue, 30, 18) };
  }
  const accent = accentFor(hue);
  return { bg: '#ffffff', surface: hslToHex(hue, 45, 96), border: hslToHex(hue, 30, 88), fg: hslToHex(hue, 35, 12), muted: hslToHex(hue, 14, 36), accent, accentFg: '#ffffff', soft: hslToHex(hue, 55, 93) };
}
