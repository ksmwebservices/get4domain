// Starter pictures for the industry designs (15 Oct 2026): a hero picture and four gallery pictures for every category.
// They are ORIGINAL artwork drawn here (gradients, rings, stripes, dots and one large outline icon from the Lucide icon set, ISC licence): no photograph and no third-party image.
// Each picture goes through the shared upload service's cleaning step (cleanForWeb: web format, shrunk, no camera data) and is written to the website's own storage,
// get4domain_mvp/public/starter/<category>/, which is served by the same site as the vendor page.
//
//   cd backend-api && npx nest build          (the category list lives in the built API)
//   node scripts/industry-designs/seed-images.js            writes only pictures that are missing
//   node scripts/industry-designs/seed-images.js --force    redraws every picture
//   node scripts/industry-designs/seed-images.js --check    writes nothing; fails if a picture is missing
// Safe to run again: the drawing is deterministic, an existing picture is kept unless --force.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BE = path.join(ROOT, 'backend-api');
const OUT = path.join(ROOT, 'get4domain_mvp', 'public', 'starter');
const LUCIDE = path.join(ROOT, 'get4domain_mvp', 'node_modules', 'lucide-react', 'dist', 'esm', 'icons');
const sharp = require(path.join(BE, 'node_modules', 'sharp'));

const FORCE = process.argv.includes('--force');
const CHECK = process.argv.includes('--check');

function loadSeeds() {
  const f = path.join(BE, 'dist', 'src', 'site-doc', 'industry-seeds.js');
  if (!fs.existsSync(f)) { console.error('The API is not built. Run: cd backend-api && npx nest build'); process.exit(2); }
  return require(f).CATEGORY_SEEDS;
}
function loadClean() {
  const f = path.join(BE, 'dist', 'src', 'uploads', 'media.service.js');
  return require(f).cleanForWeb;
}

const kebab = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([a-zA-Z])([0-9])/g, '$1-$2').toLowerCase();

/** The drawing instructions of a Lucide icon, as SVG elements (24 x 24 units, outline). */
function iconNodes(name) {
  const file = path.join(LUCIDE, `${kebab(name)}.js`);
  if (!fs.existsSync(file)) return '';
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/createLucideIcon\("[^"]+",\s*(\[[\s\S]*?\])\);/);
  if (!m) return '';
  // eslint-disable-next-line no-new-func
  const nodes = new Function(`return ${m[1]};`)();
  return nodes.map(([tag, attrs]) => {
    const a = Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${a}/>`;
  }).join('');
}

const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;

/** One drawing. `style` 0 to 4 picks a composition; the icon is large, soft and cropped by the frame, never a logo. */
function svgFor(icon, hue, style, w, h) {
  const nodes = iconNodes(icon);
  const c1 = hsl(hue + [0, 12, -12, 22, 8][style], 55, [24, 30, 34, 28, 22][style]);
  const c2 = hsl(hue + [30, 42, 14, 52, 38][style], 50, [40, 46, 42, 38, 36][style]);
  const light = hsl(hue, 70, 92);
  const id = `g${style}`;
  const big = `<g transform="translate(${[w * 0.62, w * 0.22, w * 0.5, w * 0.68, w * 0.05][style]} ${[h * 0.1, h * 0.12, h * 0.18, h * 0.05, h * 0.2][style]}) scale(${(h / 24) * [0.82, 0.7, 0.62, 0.75, 0.6][style]})" fill="none" stroke="${light}" stroke-opacity="0.22" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round">${nodes}</g>`;
  let deco = '';
  if (style === 0) deco = `<circle cx="${w * 0.15}" cy="${h * 0.8}" r="${h * 0.42}" fill="${light}" fill-opacity="0.07"/><circle cx="${w * 0.9}" cy="${h * 0.9}" r="${h * 0.3}" fill="${light}" fill-opacity="0.08"/>`;
  if (style === 1) deco = Array.from({ length: 14 }, (_, i) => `<rect x="${-w * 0.2 + i * (w / 9)}" y="${-h * 0.2}" width="${w * 0.045}" height="${h * 1.6}" fill="${light}" fill-opacity="0.06" transform="rotate(24 ${w / 2} ${h / 2})"/>`).join('');
  if (style === 2) deco = [0.2, 0.34, 0.5, 0.68].map((r) => `<circle cx="${w * 0.15}" cy="${h * 1.05}" r="${h * r * 1.5}" fill="none" stroke="${light}" stroke-opacity="0.12" stroke-width="${h * 0.012}"/>`).join('');
  if (style === 3) deco = Array.from({ length: 70 }, (_, i) => `<circle cx="${(i % 10) * (w / 9)}" cy="${Math.floor(i / 10) * (h / 6.2)}" r="${h * 0.01}" fill="${light}" fill-opacity="0.18"/>`).join('') + `<path d="M0 ${h * 0.78} Q ${w * 0.25} ${h * 0.62} ${w * 0.5} ${h * 0.78} T ${w} ${h * 0.74} V ${h} H0 Z" fill="${light}" fill-opacity="0.08"/>`;
  if (style === 4) deco = `<rect x="${w * 0.08}" y="${h * 0.12}" width="${w * 0.46}" height="${h * 0.76}" rx="${h * 0.04}" fill="${light}" fill-opacity="0.07"/><rect x="${w * 0.58}" y="${h * 0.12}" width="${w * 0.34}" height="${h * 0.34}" rx="${h * 0.04}" fill="${light}" fill-opacity="0.1"/><rect x="${w * 0.58}" y="${h * 0.54}" width="${w * 0.34}" height="${h * 0.34}" rx="${h * 0.04}" fill="${light}" fill-opacity="0.05"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>${deco}${big}</svg>`;
}

(async () => {
  const seeds = loadSeeds();
  const clean = loadClean();
  let wrote = 0; let kept = 0; const missing = [];
  for (const s of seeds) {
    const dir = path.join(OUT, s.key);
    const plan = [['hero.webp', 0, 1600, 900], ['g1.webp', 1, 800, 600], ['g2.webp', 2, 800, 600], ['g3.webp', 3, 800, 600], ['g4.webp', 4, 800, 600]];
    for (const [file, style, w, h] of plan) {
      const target = path.join(dir, file);
      if (fs.existsSync(target) && !FORCE) { kept += 1; continue; }
      if (CHECK) { missing.push(`${s.key}/${file}`); continue; }
      fs.mkdirSync(dir, { recursive: true });
      const png = await sharp(Buffer.from(svgFor(s.motif, s.hue, style, w, h))).png().toBuffer();
      const out = await clean(png, '.webp', 'BANNER');
      fs.writeFileSync(target, out.data);
      wrote += 1;
    }
  }
  if (!CHECK) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'LICENCE.md'), `# Starter pictures\n\nEvery picture in this folder is original artwork drawn by \`scripts/industry-designs/seed-images.js\` from plain shapes (gradients, rings, stripes, dots) and one large outline icon from the Lucide icon set (https://lucide.dev, ISC licence). No photograph and no third-party image is used, so there is nothing to attribute or license from anyone else.\n\nEach picture is processed by the shared upload service's cleaning step (\`cleanForWeb\`: web format, resized, no camera data) and is stored in the website's own public folder. Vendors replace them with their own photographs in Website Manager; a replaced picture is no longer starter content.\n`);
  }
  console.log(CHECK ? `${missing.length} missing, ${kept} present` : `wrote ${wrote}, kept ${kept} (${seeds.length} categories)`);
  if (CHECK && missing.length) { console.log(missing.slice(0, 10).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
