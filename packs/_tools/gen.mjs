// Writes one pack folder from its design spec (pack.mjs): theme.json, templates, css, assets and content.json.
// Usage: node packs/_tools/gen.mjs <family>/<type>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { variantFor, categoryById } from '../../themes/lib/categories.mjs';
import { homePage, servicesPage, listPage, itemPage, aboutPage, galleryPage, contactPage, genericPage } from './markup.mjs';
import { tokensCss, baseCss, motionCss, printCss } from './css.mjs';

export const PACKS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PREVIEW_FILES = [
  { path: 'assets/previews/home-1280.png', alt: '', page: 'home' },
  { path: 'assets/previews/home-360.png', alt: '', page: 'home' },
  { path: 'assets/previews/item-1280.png', alt: '', page: 'item' },
];

/** Every file of the theme (not content.json) as { relativePath: string }. */
export function buildThemeFiles(spec) {
  const cats = spec.categories;
  const families = [...new Set(cats.map((c) => categoryById(c).family))];
  const layoutVariantRules = Object.fromEntries(families.map((f) => [f, variantFor(cats.find((c) => categoryById(c).family === f))]));
  const manifest = {
    id: spec.id, version: spec.version ?? 1, name: spec.name, tier: 'Standard', author: 'Claude (Get4Domain design)',
    description: spec.description, tracks: [...new Set(cats.map((c) => categoryById(c).track))], families, categories: cats,
    layoutVariantRules: Object.fromEntries(Object.entries(layoutVariantRules).map(([f, v]) => [f, v.id])),
    motion: { default: 'Low', variantDefaults: {} },
    settingsSchema: { accent: true, fonts: true, logo: true, sectionOrder: true, sectionVisibility: true, motionIntensity: true },
    fonts: [...new Set([spec.fontHeading, spec.fontBody, 'Noto Sans Tamil', ...(spec.fontHeading && ['Playfair Display', 'Lora', 'Merriweather'].includes(spec.fontHeading) ? ['Noto Serif Tamil'] : [])])],
    marketplace: {
      packs: spec.marketplace.packs, catalogueCategories: spec.marketplace.catalogueCategories,
      ...(spec.marketplace.tags ? { tags: spec.marketplace.tags } : {}),
      licence: 'Theme code: for use by Get4Domain vendors on their vendor websites. Illustrations are original vector art made for this theme. Fonts: SIL OFL 1.1, self-hosted by the platform.',
      previews: PREVIEW_FILES.map((p, i) => ({ ...p, alt: spec.previewAlt[i] })),
    },
  };
  const f = {};
  f['theme.json'] = JSON.stringify(manifest, null, 2) + '\n';
  f['templates/home.html'] = homePage(spec);
  f['templates/services.html'] = servicesPage(spec);
  f[`templates/${spec.listPage.slug}.html`] = listPage(spec, spec.listPage.slug, spec.listPage.title);
  f['templates/item.html'] = itemPage(spec);
  f['templates/about.html'] = aboutPage(spec);
  f['templates/gallery.html'] = galleryPage(spec);
  f['templates/contact.html'] = contactPage(spec);
  f['templates/page.html'] = genericPage(spec);
  f['css/tokens.css'] = tokensCss(spec);
  f['css/base.css'] = baseCss(spec);
  f['css/motion.css'] = motionCss(spec);
  f['css/print.css'] = printCss(spec);
  for (const [name, svg] of Object.entries(spec.assets)) f[`assets/${name}`] = svg.endsWith('\n') ? svg : svg + '\n';
  return f;
}

export function writePack(dir, spec) {
  const files = buildThemeFiles(spec);
  for (const [rel, text] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
  fs.writeFileSync(path.join(dir, 'content.json'), JSON.stringify(spec.content, null, 2) + '\n');
  return Object.keys(files);
}

export async function loadSpec(rel) {
  const file = path.join(PACKS_ROOT, rel, 'pack.mjs');
  return (await import(pathToFileURL(file).href)).default;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rel = process.argv[2];
  if (!rel) { console.error('Usage: node packs/_tools/gen.mjs <family>/<type>'); process.exit(2); }
  const spec = await loadSpec(rel);
  const written = writePack(path.join(PACKS_ROOT, rel), spec);
  console.log(`wrote ${written.length} theme files and content.json to packs/${rel}`);
}
