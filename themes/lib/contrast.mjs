// WCAG 2.x contrast helpers and the "auto-adjust" suggestion for a vendor's accent colour. Pure functions.
export function parseHex(hex) {
  const m = String(hex).trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export function luminance(rgb) { return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); }
export function ratio(a, b) {
  const A = parseHex(a); const B = parseHex(b);
  if (!A || !B) return null;
  const [hi, lo] = [luminance(A), luminance(B)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const AA_TEXT = 4.5;

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min; const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToHex([h, s, l]) {
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  let r; let g; let b;
  if (s === 0) r = g = b = l;
  else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
  return `#${[r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The closest colour to `accent` (same hue) that meets `min` contrast on every background in `bgs`.
 * Moves lightness away from the backgrounds in 1% steps. Returns the accent unchanged when it already passes.
 */
export function suggestAccent(accent, bgs, min = AA_TEXT) {
  const list = Array.isArray(bgs) ? bgs : [bgs];
  const ok = (hex) => list.every((bg) => (ratio(hex, bg) ?? 0) >= min);
  if (ok(accent)) return accent;
  const rgb = parseHex(accent);
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(rgb);
  const avgBgLum = list.reduce((t, bg) => t + luminance(parseHex(bg)), 0) / list.length;
  const dir = avgBgLum > 0.4 ? -1 : 1;
  for (let step = 1; step <= 100; step++) {
    const nl = Math.min(1, Math.max(0, l + dir * step * 0.01));
    const hex = hslToHex([h, s, nl]);
    if (ok(hex)) return hex;
  }
  return null;
}
