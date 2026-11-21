// C2.3 variant hooks: a Premium theme styles the SAME markup per layout variant with attribute selectors on the wrapper.
// The renderer sets data-variant and data-motion; the lint rule `variant-coverage` fails a Premium theme with no CSS for a variant that one of its categories uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintTheme, RULE_IDS } from '../lib/lint.mjs';
import { loadTheme } from '../lib/theme.mjs';
import { renderPage } from '../lib/render.mjs';
import { CATEGORIES, FAMILIES } from '../lib/categories.mjs';
import { parse, byTag } from '../lib/html.mjs';
import { sampleContent } from '../fixtures/index.mjs';

export const VARIANT_IDS = [...new Set(Object.values(FAMILIES).map((f) => f.variant.id))];
/** one category per variant, so a theme listing exactly these uses all nine variants */
export const ONE_PER_VARIANT = VARIANT_IDS.map((v) => CATEGORIES.find((c) => FAMILIES[c.family].variant.id === v).id);

/** A minimal Premium theme: the starter with tier Premium, one extra element that only some variants show (plain text, no picture),
 *  and one CSS block per variant selecting [data-variant=...] on the wrapper. `omit` leaves a variant without CSS. */
export function premiumFixture({ omit = [] } = {}) {
  const t = loadTheme('_starter');
  const variantCss = VARIANT_IDS.filter((v) => !omit.includes(v)).map((v, i) => `.g4d-theme[data-variant="${v}"] .v-only { display: block; }\n.g4d-theme[data-variant="${v}"] { --g4d-radius: ${4 + i}px; }`).join('\n');
  return {
    ...t,
    manifest: { ...t.manifest, tier: 'Premium', categories: ONE_PER_VARIANT },
    templates: { ...t.templates, home: t.templates.home.replace('</main>', '<p class="v-only">Shown by some variants only</p></main>') },
    css: { ...t.css, base: `${t.css.base}\n.g4d-theme .v-only { display: none; }\n${variantCss}\n` },
  };
}

const render = (theme, category, settings = {}) => renderPage({ theme, page: { slug: 'home' }, content: sampleContent(category), settings, vendor: { id: 'v' }, host: { siteUrl: 'https://x.get4domain.com' } });

test('there are nine variants and the fixture reaches each of them through a category', () => {
  assert.equal(VARIANT_IDS.length, 9);
  assert.deepEqual(VARIANT_IDS.sort(), ['bold-split', 'calm-centered', 'card-stack', 'dark-bento', 'fullbleed-bento', 'fullbleed-booking', 'portfolio-first', 'product-first', 'structured-split']);
  assert.equal(new Set(ONE_PER_VARIANT.map((c) => FAMILIES[CATEGORIES.find((x) => x.id === c).family].variant.id)).size, 9);
});

test('the renderer puts data-variant and data-motion on the wrapper, so CSS can style the same markup per variant', () => {
  const t = premiumFixture();
  for (const cat of ONE_PER_VARIANT) {
    const want = FAMILIES[CATEGORIES.find((c) => c.id === cat).family].variant;
    const r = render(t, cat);
    assert.equal(r.variant.id, want.id);
    assert.match(r.html, new RegExp(`class="g4d-theme g4d-theme-[^"]*"[^>]* data-variant="${want.id}"`));
    for (const a of ['hero', 'header', 'services', 'card', 'divider', 'decor']) assert.ok(r.html.includes(`data-${a}="`), `data-${a}`);
    assert.match(r.html, /data-motion="(off|low|medium|rich)"/);
  }
  assert.match(render(t, 'plumber', { motionIntensity: 'Off' }).html, /data-motion="off"/);
  assert.match(render(t, 'plumber', { motionIntensity: 'Rich' }).html, /data-motion="rich"/);
});

test('a variant-only element is hidden by CSS: the markup and the picture count are the same in all nine variants', () => {
  const t = premiumFixture();
  const imgs = ONE_PER_VARIANT.map((c) => byTag(parse(render(t, c).html), 'img').length);
  // the same template: the number of pictures follows the content, never the variant (no extra img for a variant-only decoration)
  assert.ok(Math.max(...imgs) - Math.min(...imgs) <= 1, imgs.join(','));
  for (const c of ONE_PER_VARIANT) assert.ok(render(t, c).html.includes('class="v-only"'));
  assert.match(t.css.base, /\.g4d-theme \.v-only \{ display: none; \}/);
  assert.equal(t.templates.home.match(/<img/g)?.length ?? 0, premiumFixture().templates.home.match(/<img/g)?.length ?? 0);
});

test('variant-coverage is a rule, and the fixture with CSS for all nine variants passes the whole lint', () => {
  assert.ok(RULE_IDS.includes('variant-coverage'));
  const r = lintTheme(premiumFixture(), { categories: ONE_PER_VARIANT });
  assert.deepEqual(r.findings.map((f) => `${f.rule}: ${f.message}`), []);
  assert.ok(r.rulesChecked.includes('variant-coverage'));
});

test('a Premium theme with no CSS for one used variant fails, naming the variant and its categories', () => {
  for (const v of VARIANT_IDS) {
    const r = lintTheme(premiumFixture({ omit: [v] }), { categories: ONE_PER_VARIANT });
    const f = r.findings.filter((x) => x.rule === 'variant-coverage');
    assert.equal(f.length, 1, v);
    assert.ok(f[0].message.includes(`"${v}"`), f[0].message);
    assert.match(f[0].message, /\[data-variant=/);
  }
});

test('a variant that none of the theme\'s categories uses needs no CSS', () => {
  const t = premiumFixture({ omit: ['product-first'] });
  const without = ONE_PER_VARIANT.filter((c) => FAMILIES[CATEGORIES.find((x) => x.id === c).family].variant.id !== 'product-first');
  const r = lintTheme({ ...t, manifest: { ...t.manifest, categories: without } }, { categories: without });
  assert.deepEqual(r.findings.filter((f) => f.rule === 'variant-coverage'), []);
});

test('the rule is for Premium themes: a Standard theme is not asked for per-variant CSS', () => {
  const t = premiumFixture({ omit: ['bold-split'] });
  const r = lintTheme({ ...t, manifest: { ...t.manifest, tier: 'Standard' } }, { categories: ONE_PER_VARIANT });
  assert.deepEqual(r.findings.filter((f) => f.rule === 'variant-coverage'), []);
});

test('the selector forms [data-variant=x], [data-variant="x"] and [data-variant~=x] all count', () => {
  const t = premiumFixture({ omit: ['calm-centered'] });
  for (const sel of ['[data-variant=calm-centered]', '[data-variant="calm-centered"]', "[data-variant='calm-centered']", '[data-variant~=calm-centered]']) {
    const extra = { ...t, css: { ...t.css, base: `${t.css.base}\n.g4d-theme${sel} .v-only { display: block; }\n` } };
    assert.deepEqual(lintTheme(extra, { categories: ONE_PER_VARIANT }).findings.filter((f) => f.rule === 'variant-coverage'), [], sel);
  }
});
