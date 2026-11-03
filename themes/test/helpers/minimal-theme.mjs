// A tiny, valid theme package used only by tests of the package format. It is not the reference theme (that is library/_starter).
import { CATEGORY_IDS } from '../../lib/categories.mjs';

export const buf = (s) => Buffer.from(s, 'utf8');

export function minimalManifest(over = {}) {
  return {
    id: 'mini-theme',
    version: 1,
    name: 'Mini theme',
    tier: 'Standard',
    tracks: ['handyman'],
    families: ['home-services'],
    categories: ['plumber', 'electrician'],
    layoutVariantRules: { 'home-services': 'bold-split' },
    motion: { default: 'Low', variantDefaults: { 'bold-split': 'Medium' } },
    settingsSchema: { accent: true, fonts: true, logo: true, sectionOrder: true, sectionVisibility: true, motionIntensity: true },
    fonts: ['Inter'],
    ...over,
  };
}

export const TEMPLATE_HOME = '<a class="skip-link" href="#main">Skip to content</a>\n<header><g4d-header-nav label="Main"></g4d-header-nav></header>\n<main id="main"><section data-g4d-section="hero" data-g4d-optional="false"><h1>{{hero.title}}</h1></section></main>\n<g4d-footer></g4d-footer>\n';

export function minimalFiles(manifestOver = {}) {
  const manifest = minimalManifest(manifestOver);
  return {
    'theme.json': buf(JSON.stringify(manifest, null, 2)),
    'templates/home.html': buf(TEMPLATE_HOME),
    'css/base.css': buf('.g4d-theme{font-family:Inter,system-ui,sans-serif}\n'),
    'css/tokens.css': buf('.g4d-theme{--g4d-primary:#0f5c4d}\n'),
    'css/motion.css': buf('@media (prefers-reduced-motion: reduce){.g4d-theme *{animation:none}}\n'),
    'css/print.css': buf('@media print{.g4d-theme nav{display:none}}\n'),
  };
}

export const allCategories = () => [...CATEGORY_IDS];
