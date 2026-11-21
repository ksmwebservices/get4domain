// Draws the app icons of the public site as local SVG files and renders the PNG sizes from them (no external image, no font: the "G" is a path).
// Usage (from get4domain_mvp): node scripts/pwa/make-icons.mjs        Writes public/icons/*. sharp comes with Next.js.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const BG = '#1f47f5'; // brand-600
const FG = '#ffffff';
const GOLD = '#ffb420'; // gold-400

/** A rounded square (any) or a full-bleed square (maskable: the platform crops it, so the mark stays inside the safe zone). The G is an arc with a bar, drawn on a 512 grid. */
function svg(maskable) {
  const radius = maskable ? 0 : 112;
  const k = maskable ? 0.78 : 1; // the mark is smaller on the maskable icon: only the middle 80 percent is guaranteed to be visible
  const t = `translate(${256 - 256 * k} ${256 - 256 * k}) scale(${k})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Get4Domain">
  <rect width="512" height="512" rx="${radius}" fill="${BG}"/>
  <g transform="${t}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M356 190 A112 112 0 1 0 368 268 H268" stroke="${FG}" stroke-width="44"/>
    <circle cx="372" cy="150" r="22" fill="${GOLD}" stroke="none"/>
  </g>
</svg>
`;
}

mkdirSync('public/icons', { recursive: true });
const any = svg(false);
const maskable = svg(true);
writeFileSync('public/icons/app-icon.svg', any);
writeFileSync('public/icons/app-icon-maskable.svg', maskable);
const jobs = [
  ['app-192.png', any, 192], ['app-512.png', any, 512], ['app-maskable-512.png', maskable, 512], ['apple-touch-180.png', maskable, 180],
];
for (const [name, source, size] of jobs) {
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log('wrote public/icons/' + name);
}
