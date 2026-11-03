// The theme lint. One function, lintTheme(theme, options), returns every problem found with the rule id, where it is and what to do.
// Source rules read the theme's templates and CSS; rendered rules call the ONE renderer (render.mjs) with the sample content for each
// category, in English and Tamil, plus the extreme fixtures. Nothing is executed and nothing is fetched.
import { Buffer } from 'node:buffer';
import { parse, byTag, findAll, classesOf, textOf } from './html.mjs';
import { parseRules, eachRule, eachAt, toPx, classesIn, resolveVarFallback } from './css.mjs';
import { parseHex, ratio, suggestAccent, AA_TEXT } from './contrast.mjs';
import { renderPage } from './render.mjs';
import { validateManifest, validateAgainst } from './schema.mjs';
import { validatePreset, paletteFindings, PRESET_SCHEMA } from './preset.mjs';
import { pageDocument } from './document.mjs';
import { measureOverflow } from './browser.mjs';
import { motionSets, countAnimated, MAX_ANIMATED_PER_SECTION } from './motion.mjs';
import { sampleContent, extremeContent, stretchContent, EXTREME_KINDS, ENTITLEMENTS_ON, ENTITLEMENTS_OFF, freeLimitContent, proMaxContent } from '../fixtures/index.mjs';
import { categoryById, hasCategory, variantFor } from './categories.mjs';
import { BINDINGS, ITEM_BINDINGS, REPEATERS, NESTED_LISTS, DATA_ATTRIBUTES, SLOT_TAGS, SLOT_BY_TAG, REQUIRED_SLOTS_ALL, GATED_SLOTS, IMAGE_BUDGET, MAP_EMBED_HOSTS, VIDEO_HOSTS, APPROVED_FONTS, APPROVED_TAMIL_FONTS, SYSTEM_FONTS, TOKENS, LIMITS, BREAKPOINTS } from './vocabulary.mjs';

export const RULE_IDS = [
  'manifest-valid', 'no-script-tag', 'no-inline-handler', 'no-forbidden-element', 'no-seo-output', 'no-external-request', 'iframe-hosts', 'css-hygiene', 'css-scoped',
  'approved-fonts', 'tamil-fonts', 'tokens-defined', 'contrast-tokens', 'contrast-accent', 'one-h1', 'landmarks', 'skip-link', 'language-attr', 'alt-text', 'form-labels',
  'touch-targets', 'responsive-static', 'responsive-browser', 'text-stretch', 'css-budget-layout', 'css-budget-motion', 'reduced-motion', 'hero-visible', 'motion-properties',
  'motion-count', 'slots-required', 'slots-reserve-space', 'bindings-known', 'print-stylesheet', 'html-budget', 'category-renders', 'category-fit-order', 'entitlements-render', 'preset-valid', 'image-budget', 'variant-coverage',
];

const FORBIDDEN = new Set(['iframe', 'object', 'embed', 'form', 'input', 'select', 'textarea', 'style', 'canvas', 'audio', 'dialog', 'base', 'frame', 'frameset', 'applet', 'noscript']);
const COLOR_TOKENS = ['--g4d-primary', '--g4d-primary-contrast', '--g4d-accent', '--g4d-bg', '--g4d-surface', '--g4d-text', '--g4d-muted', '--g4d-border'];
const ALLOWED_ANIMATED = new Set(['transform', 'opacity', 'clip-path', 'filter', 'translate', 'scale', 'rotate', 'animation-timing-function']);
const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'inherit', 'initial', 'unset']);
const RESERVE_EXEMPT = new Set(['action', 'header-nav', 'footer']);
const HIDING = [['opacity', /^0(\.0+)?$/], ['visibility', /^hidden$/], ['display', /^none$/]];
const BLOCKING_WARNINGS = /^(unknown-binding|unknown-list|unknown-slot|not-text|not-a-list|missing-template|element-removed|inline-handler-removed|binding-in-style|empty-image-dropped|setting-ignored|missing:(site\.name|hero\.title))/;

class Findings {
  constructor() { this.list = []; this.seen = new Map(); }
  add(rule, where, message, extra = {}) {
    const key = `${rule}|${where}|${message}`;
    const hit = this.seen.get(key);
    if (hit) { if (extra.category && !hit.categories.includes(extra.category)) hit.categories.push(extra.category); return; }
    const f = { rule, level: 'error', where, message, categories: extra.category ? [extra.category] : [], ...(extra.suggestion ? { suggestion: extra.suggestion } : {}) };
    this.seen.set(key, f); this.list.push(f);
  }
}

// ------------------------------------------------------------ helpers
const flattenIs = (sel) => sel.replace(/:(?:is|where)\(([^)]*)\)/g, ' $1 ');
/** Tags a rule applies to EVERYWHERE inside the theme: `.g4d-theme a`, `.g4d-theme :is(a, button)`. Class- or context-specific selectors cover nothing globally. */
function globalTags(selector) {
  const rest = selector.replace(/^\.g4d-theme\s*/, '').trim();
  const m = rest.match(/^:is\(([^)]*)\)$/);
  const parts = m ? m[1].split(',').map((x) => x.trim()) : [rest];
  return parts.filter((p) => /^[a-z][a-z0-9]*$/.test(p));
}
const insideMedia = (chain, re) => chain.some((a) => a.name === 'media' && re.test(a.prelude));
const hasKeyframes = (chain) => chain.some((a) => a.name.endsWith('keyframes'));

function cssModel(theme) {
  const files = {};
  for (const [name, text] of Object.entries(theme.css ?? {})) files[name] = { text: text ?? '', rules: parseRules(text ?? ''), bytes: Buffer.byteLength(text ?? '', 'utf8') };
  const all = Object.entries(files).flatMap(([name, f]) => f.rules.map((r) => ({ r, name })));
  const rules = []; const ats = [];
  for (const [name, f] of Object.entries(files)) {
    eachRule(f.rules, (r, chain) => rules.push({ r, chain, file: name }));
    eachAt(f.rules, (a, chain) => ats.push({ a, chain, file: name }));
  }
  return { files, all, rules, ats };
}

function tokenMaps(model) {
  const tokenRules = model.files.tokens?.rules ?? [];
  const light = {}; const dark = {}; let hasDark = false;
  for (const r of tokenRules) {
    if (r.type === 'rule' && r.selectors.includes('.g4d-theme')) for (const d of r.decls) light[d.prop] = d.value;
    if (r.type === 'at' && r.name === 'media' && /prefers-color-scheme\s*:\s*dark/.test(r.prelude)) {
      hasDark = true;
      for (const x of r.rules ?? []) if (x.type === 'rule' && x.selectors.includes('.g4d-theme')) for (const d of x.decls) dark[d.prop] = d.value;
    }
  }
  const resolve = (map) => Object.fromEntries(Object.entries(map).map(([k, val]) => [k, resolveVarFallback(val)]));
  return { light: resolve(light), dark: resolve(dark), hasDark };
}

// ------------------------------------------------------------ template (source) checks
function checkBindings(nodes, where, templateName, F) {
  const scopes = [];
  const fieldsOfVar = (v) => Object.values(REPEATERS).find((r) => r.as === v)?.fields;
  const known = (p) => {
    const [head, ...rest] = p.split('.');
    if (scopes.includes(head)) return rest.length === 0 || (fieldsOfVar(head)?.includes(rest[0]) ?? false);
    if (templateName === 'item' && ITEM_BINDINGS.includes(p)) return true;
    return BINDINGS.includes(p) || Boolean(REPEATERS[p]) || Boolean(NESTED_LISTS[p]);
  };
  const scan = (str, what) => { for (const m of str.matchAll(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g)) if (!known(m[1])) F.add('bindings-known', where, `unknown binding {{${m[1]}}} in ${what}`); };
  const visit = (list) => {
    for (const n of list) {
      if (n.type === 'text') { scan(n.value, 'text'); continue; }
      if (n.type !== 'el') continue;
      for (const [name, val] of Object.entries(n.attrs)) {
        if (name.startsWith('data-g4d-') && !DATA_ATTRIBUTES.includes(name)) F.add('bindings-known', where, `unknown attribute ${name}`);
        scan(val, `${name}="..."`);
        if ((name === 'data-g4d-if' || name === 'data-g4d-if-not') && !known(val)) F.add('bindings-known', where, `unknown binding "${val}" in ${name}`);
      }
      if (n.tag.startsWith('g4d-') && !SLOT_TAGS.includes(n.tag)) F.add('bindings-known', where, `unknown platform slot <${n.tag}>`);
      if (n.tag === 'template' && 'data-g4d-each' in n.attrs) {
        const list = n.attrs['data-g4d-each'];
        if (!REPEATERS[list] && !NESTED_LISTS[list]) { F.add('bindings-known', where, `unknown list "${list}"`); continue; }
        const v = n.attrs['data-g4d-as'] || REPEATERS[list]?.as || (list === 'group.items' ? 'item' : 'entry');
        scopes.push(v); visit(n.children); scopes.pop();
        continue;
      }
      visit(n.children);
    }
  };
  visit(nodes);
}

function checkTemplateSource(theme, F, state) {
  for (const [name, html] of Object.entries(theme.templates ?? {})) {
    const where = `templates/${name}.html`;
    const nodes = parse(html);
    if (Buffer.byteLength(html, 'utf8') > LIMITS.htmlPageBytes) F.add('html-budget', where, `${Buffer.byteLength(html, 'utf8')} bytes; a page must stay under ${LIMITS.htmlPageBytes}`);
    for (const n of byTag(nodes, 'script')) { F.add('no-script-tag', where, 'a <script> element is not allowed in a theme'); if (/ld\+json/i.test(n.attrs.type ?? '')) F.add('no-seo-output', where, 'JSON-LD is written by the platform, not by a theme'); }
    for (const n of findAll(nodes, (x) => Object.keys(x.attrs).some((a) => /^on/i.test(a)))) F.add('no-inline-handler', where, `<${n.tag}> has an inline event handler (${Object.keys(n.attrs).find((a) => /^on/i.test(a))})`);
    for (const n of findAll(nodes, (x) => FORBIDDEN.has(x.tag))) F.add('no-forbidden-element', where, `<${n.tag}> is not allowed in a theme (the platform draws forms, maps and embeds as slots)`);
    for (const n of findAll(nodes, (x) => x.tag === 'title' || x.tag === 'meta')) F.add('no-seo-output', where, `<${n.tag}> belongs to the platform SEO layer, not to a theme`);
    for (const n of byTag(nodes, 'link')) { if (/canonical|alternate|prev|next/i.test(n.attrs.rel ?? '')) F.add('no-seo-output', where, `<link rel="${n.attrs.rel}"> belongs to the platform SEO layer`); else F.add('no-external-request', where, '<link> would load an outside resource'); }
    for (const n of findAll(nodes, (x) => ['src', 'srcset', 'poster', 'data', 'formaction'].some((a) => /^(https?:)?\/\//i.test(x.attrs[a] ?? '')))) F.add('no-external-request', where, `<${n.tag}> loads an outside address`);
    for (const n of findAll(nodes, (x) => /url\(\s*['"]?(https?:)?\/\//i.test(x.attrs.style ?? ''))) F.add('no-external-request', where, `<${n.tag}> style loads an outside address`);
    for (const n of findAll(nodes, (x) => 'lang' in x.attrs || 'xml:lang' in x.attrs)) F.add('language-attr', where, `<${n.tag}> sets lang: the platform wrapper sets the language, a theme never does`);
    for (const n of byTag(nodes, 'img')) if (!('alt' in n.attrs)) F.add('alt-text', where, '<img> has no alt attribute');
    checkBindings(nodes, where, name, F);
    for (const n of findAll(nodes, (x) => x.tag.startsWith('g4d-') && SLOT_BY_TAG[x.tag])) state.slots.add(SLOT_BY_TAG[n.tag]);
    state.parsed[name] = nodes;
  }
}

// ------------------------------------------------------------ css checks
function fontNames(value) {
  return value.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

function checkCss(theme, model, F, state, opts) {
  const { files, rules, ats } = model;

  // budgets
  const layoutBytes = ['tokens', 'base', 'print'].reduce((t, k) => t + (files[k]?.bytes ?? 0), 0);
  if (layoutBytes > LIMITS.layoutCssBytes) F.add('css-budget-layout', 'css/base.css + tokens.css + print.css', `${layoutBytes} bytes; the layout CSS must stay under ${LIMITS.layoutCssBytes}`);
  if ((files.motion?.bytes ?? 0) > LIMITS.motionCssBytes) F.add('css-budget-motion', 'css/motion.css', `${files.motion.bytes} bytes; the motion CSS must stay under ${LIMITS.motionCssBytes}`);

  // hygiene, scoping, outside requests
  for (const { r, chain, file } of rules) {
    const where = `css/${file}.css`;
    for (const d of r.decls) {
      if (d.important) F.add('css-hygiene', where, `${r.selector} uses !important`);
      if (/url\(\s*['"]?\s*(?:https?:)?\/\//i.test(d.value)) F.add('no-external-request', where, `${d.prop} loads an outside address`);
    }
    if (r.nested) F.add('css-hygiene', where, `${r.selector} contains nested rules (not supported)`);
    if (!hasKeyframes(chain) && !r.selectors.every((s) => s.startsWith('.g4d-theme'))) F.add('css-scoped', where, `${r.selector.slice(0, 60)} is not scoped under .g4d-theme`);
  }
  for (const { a, file } of ats) {
    const where = `css/${file}.css`;
    if (a.name === 'import') F.add('css-hygiene', where, '@import is not allowed');
    for (const d of a.decls ?? []) {
      if (d.important) F.add('css-hygiene', where, `@${a.name} uses !important`);
      if (/url\(\s*['"]?\s*(?:https?:)?\/\//i.test(d.value)) F.add('no-external-request', where, `@${a.name} ${d.prop} loads an outside address`);
    }
  }

  // fonts
  const okFonts = new Set([...APPROVED_FONTS, ...SYSTEM_FONTS]);
  for (const { r, file } of rules) for (const d of r.decls) {
    if (d.prop !== 'font-family' && !d.prop.startsWith('--g4d-font-')) continue;
    for (const name of fontNames(d.value)) if (!okFonts.has(name) && !GENERIC_FAMILIES.has(name) && !/^var\(/.test(name)) F.add('approved-fonts', `css/${file}.css`, `font "${name}" is not on the approved list`);
  }
  for (const { a, file } of ats) if (a.name === 'font-face') for (const d of a.decls ?? []) if (d.prop === 'font-family' && !APPROVED_FONTS.includes(fontNames(d.value)[0])) F.add('approved-fonts', `css/${file}.css`, `@font-face "${d.value}" is not on the approved list`);

  // Tamil: the body font stack must name an approved Tamil font (Noto Sans Tamil or Noto Serif Tamil, self-hosted by the platform); system Tamil fonts may follow as a fallback
  {
    const stacks = [];
    for (const { r } of rules) for (const d of r.decls) if (d.prop === '--g4d-font-body' || d.prop === '--g4d-font-fallback' || (d.prop === 'font-family' && r.selectors.includes('.g4d-theme'))) stacks.push(d.value);
    const tamil = stacks.flatMap(fontNames).some((n) => APPROVED_TAMIL_FONTS.includes(n));
    if (!tamil) F.add('tamil-fonts', 'css/tokens.css', 'the body font stack has no approved Tamil font: add "Noto Sans Tamil" (or "Noto Serif Tamil") after the Latin font, then system fallbacks');
  }

  // tokens and contrast
  const { light, dark, hasDark } = tokenMaps(model);
  for (const t of TOKENS) if (!(t in light)) F.add('tokens-defined', 'css/tokens.css', `${t} is not defined`);
  if (!hasDark) F.add('tokens-defined', 'css/tokens.css', 'no @media (prefers-color-scheme: dark) block: dark mode uses the same token set');
  else for (const t of COLOR_TOKENS) if (!(t in dark)) F.add('tokens-defined', 'css/tokens.css', `${t} is not redefined for dark mode`);
  const modes = [['light', light], ['dark', { ...light, ...dark }]];
  for (const [mode, m] of modes) {
    if (mode === 'dark' && !hasDark) continue;
    for (const t of COLOR_TOKENS) if (t in m && !parseHex(m[t])) F.add('contrast-tokens', 'css/tokens.css', `${t} (${mode}) is not a #hex colour, so contrast cannot be checked`);
    const pairs = [['--g4d-text', '--g4d-bg'], ['--g4d-text', '--g4d-surface'], ['--g4d-muted', '--g4d-bg'], ['--g4d-muted', '--g4d-surface'], ['--g4d-primary-contrast', '--g4d-primary'], ['--g4d-accent', '--g4d-bg'], ['--g4d-accent', '--g4d-surface']];
    for (const [fg, bg] of pairs) {
      const rt = ratio(m[fg], m[bg]);
      if (rt !== null && rt < AA_TEXT) F.add('contrast-tokens', 'css/tokens.css', `${fg} on ${bg} (${mode}) is ${rt.toFixed(2)}:1; AA needs ${AA_TEXT}:1`);
    }
  }
  // vendor accent: the theme's own backgrounds must be able to carry any accent after the auto-adjust
  state.checked.add('contrast-accent');
  const lightBgs = [light['--g4d-bg'], light['--g4d-surface']].filter((x) => parseHex(x));
  if (lightBgs.length === 2) {
    for (const probe of ['#ffff00', '#00ff00', '#ff9900', '#808080', '#66ccff']) {
      const fix = suggestAccent(probe, lightBgs);
      if (!fix || lightBgs.some((bg) => ratio(fix, bg) < AA_TEXT)) F.add('contrast-accent', 'css/tokens.css', `the accent auto-adjust cannot make ${probe} readable on this theme's background`);
    }
    if (opts.vendorAccent) {
      const rts = lightBgs.map((bg) => ratio(opts.vendorAccent, bg));
      if (rts.some((x) => x === null)) F.add('contrast-accent', 'settings', `accent ${opts.vendorAccent} is not a #rrggbb colour`);
      else if (rts.some((x) => x < AA_TEXT)) { const fix = suggestAccent(opts.vendorAccent, lightBgs); F.add('contrast-accent', 'settings', `accent ${opts.vendorAccent} is ${Math.min(...rts).toFixed(2)}:1 on the theme background; AA needs ${AA_TEXT}:1. Use ${fix} instead`, { suggestion: fix }); }
    }
  }
  if (opts.vendorAccentDark && hasDark) {
    const darkBgs = [dark['--g4d-bg'], dark['--g4d-surface']].filter((x) => parseHex(x));
    const rts = darkBgs.map((bg) => ratio(opts.vendorAccentDark, bg));
    if (rts.some((x) => x !== null && x < AA_TEXT)) { const fix = suggestAccent(opts.vendorAccentDark, darkBgs); F.add('contrast-accent', 'settings', `dark-mode accent ${opts.vendorAccentDark} fails AA on the dark background. Use ${fix} instead`, { suggestion: fix }); }
  }

  // touch targets: tag-level rules that give every interactive element at least 44px
  const resolve = (name) => light[name] ?? null;
  state.touchTags = new Set();
  for (const { r } of rules) {
    const tall = r.decls.some((d) => ['min-height', 'min-block-size', 'height', 'block-size'].includes(d.prop) && (toPx(d.value, resolve) ?? 0) >= 44);
    if (tall) for (const s of r.selectors) for (const t of globalTags(s)) state.touchTags.add(t);
  }

  // responsive (static)
  for (const { r, chain, file } of rules) {
    if (hasKeyframes(chain) || insideMedia(chain, /min-width/)) continue;
    for (const d of r.decls) if (['width', 'min-width', 'flex-basis'].includes(d.prop)) {
      const px = toPx(d.value, resolve);
      if (px !== null && px > 360) F.add('responsive-static', `css/${file}.css`, `${r.selector.slice(0, 50)} { ${d.prop}: ${d.value} } is wider than a 360px phone`);
    }
  }
  const imgOk = rules.some(({ r }) => r.selectors.some((s) => /(^|[\s,])(img|picture)\b/.test(flattenIs(s)) || /\bimg\b/.test(s)) && r.decls.some((d) => d.prop === 'max-width' && /^100%$/.test(d.value)));
  if (!imgOk) F.add('responsive-static', 'css/base.css', 'no rule keeps pictures inside their box (img { max-width: 100% })');

  // text stretch (static half): long words and long names must wrap, not push the page sideways
  const wraps = rules.some(({ r }) => r.selectors.includes('.g4d-theme') && r.decls.some((d) => (d.prop === 'overflow-wrap' && /^(anywhere|break-word)$/.test(d.value)) || (d.prop === 'word-break' && /break-word/.test(d.value))));
  if (!wraps) F.add('text-stretch', 'css/base.css', 'the .g4d-theme wrapper does not set overflow-wrap: anywhere (long names and Tamil words would overflow)');
  if (!rules.some(({ r }) => r.decls.some((d) => d.prop === 'min-width' && /^0(px)?$/.test(d.value)))) F.add('text-stretch', 'css/base.css', 'no min-width: 0 on grid/flex children (a long word can force the column wider)');
  for (const { r, file } of rules) if (r.decls.some((d) => d.prop === 'white-space' && /nowrap/.test(d.value)) && !r.selectors.every((s) => /\.(btn|badge|chip|g4d-marquee)/.test(s))) F.add('text-stretch', `css/${file}.css`, `${r.selector.slice(0, 50)} stops text from wrapping`);

  // motion
  const reduce = ats.find(({ a, file }) => file === 'motion' && a.name === 'media' && /prefers-reduced-motion\s*:\s*reduce/.test(a.prelude));
  let reduceOk = false;
  if (reduce) eachRule(reduce.a.rules ?? [], (r) => { if (r.decls.some((d) => (d.prop === 'animation' || d.prop === 'animation-name') && /^none$/.test(d.value))) reduceOk = true; });
  if (!reduceOk) F.add('reduced-motion', 'css/motion.css', 'no @media (prefers-reduced-motion: reduce) block that sets animation: none');

  const hidingKeyframes = new Set();
  for (const { a, file } of ats) {
    if (!a.name.endsWith('keyframes')) continue;
    for (const fr of a.rules ?? []) {
      for (const d of fr.decls) {
        if (!ALLOWED_ANIMATED.has(d.prop) && !d.prop.startsWith('--')) F.add('motion-properties', `css/${file}.css`, `@keyframes ${a.prelude} animates "${d.prop}"; only transform, opacity, clip-path and filter may be animated`);
      }
      if (/^(from|0%)$/.test(fr.selector) && fr.decls.some((d) => d.prop === 'opacity' && /^0(\.0+)?$/.test(d.value))) hidingKeyframes.add(a.prelude);
    }
  }
  for (const { r, file } of rules) for (const d of r.decls) {
    if (d.prop === 'transition' || d.prop === 'transition-property') {
      const items = d.prop === 'transition' ? d.value.split(/,(?![^(]*\))/).map((x) => x.trim().split(/\s+/)[0]) : d.value.split(',').map((x) => x.trim());
      for (const p of items) if (p && !/^var\(/.test(p) && !ALLOWED_ANIMATED.has(p) && p !== 'none') F.add('motion-properties', `css/${file}.css`, `${r.selector.slice(0, 40)} transitions "${p}"; only transform, opacity, clip-path and filter are allowed`);
    }
  }

  // animated classes (for the count and for the hero)
  const sets = motionSets(rules.map((x) => x.r), hidingKeyframes);
  state.animated = sets.animated; state.stagger = sets.stagger; state.revealing = sets.revealing;

  // print
  const print = files.print;
  const printMedia = (print?.rules ?? []).find((x) => x.type === 'at' && x.name === 'media' && /print/.test(x.prelude));
  let hidesNav = false;
  if (printMedia) eachRule(printMedia.rules ?? [], (r) => { if (r.decls.some((d) => d.prop === 'display' && d.value === 'none') && r.selectors.some((s) => /nav|g4d-slot/.test(s))) hidesNav = true; });
  if (!print || !print.text.trim() || !printMedia || !hidesNav) F.add('print-stylesheet', 'css/print.css', 'print.css must contain an @media print block that hides navigation and platform slots');

  state.model = { light, dark, hasDark };
}

function checkHero(theme, model, F, state) {
  const home = state.parsed.home;
  if (!home) { F.add('hero-visible', 'templates/home.html', 'there is no home template'); return; }
  const hero = findAll(home, (n) => n.attrs['data-g4d-section'] === 'hero')[0];
  if (!hero) { F.add('hero-visible', 'templates/home.html', 'the home page has no section marked data-g4d-section="hero"'); return; }
  if (hero.attrs['data-g4d-optional'] === 'true') F.add('hero-visible', 'templates/home.html', 'the hero section must not be optional (a vendor could hide it)');
  const heroClasses = new Set(classesOf(hero));
  findAll(hero.children, () => true).forEach((n) => classesOf(n).forEach((c) => heroClasses.add(c)));
  for (const c of heroClasses) if (state.revealing.has(c)) F.add('hero-visible', 'templates/home.html', `the hero carries .${c}, an effect that starts hidden; reveal effects must start below the fold`);
  for (const { r, chain, file } of model.rules) {
    if (insideMedia(chain, /print/) || hasKeyframes(chain)) continue;
    const touchesHero = r.selectors.some((s) => /\[data-g4d-section=['"]?hero['"]?\]/.test(s)) || r.selectors.some((s) => classesIn(flattenIs(s)).some((c) => heroClasses.has(c) && c !== 'g4d-theme'));
    if (!touchesHero) continue;
    for (const [prop, re] of HIDING) if (r.decls.some((d) => d.prop === prop && re.test(d.value))) F.add('hero-visible', `css/${file}.css`, `${r.selector.slice(0, 50)} sets ${prop}: ${r.decls.find((d) => d.prop === prop).value} on the hero`);
  }
}

function checkSlotsSource(theme, model, F, state, categories) {
  const need = new Set(REQUIRED_SLOTS_ALL);
  if (categories.some((c) => categoryById(c).track === 'ecommerce')) need.add('product-grid');
  for (const s of need) if (!state.slots.has(s)) F.add('slots-required', 'templates/', `the platform slot "${s}" is not placed in any template`);
  const reserves = (slot) => model.rules.some(({ r }) => r.selectors.some((s) => s.includes(`.g4d-slot--${slot}`)) && r.decls.some((d) => ['min-height', 'aspect-ratio', 'height', 'min-block-size'].includes(d.prop) && d.value !== '0' && d.value !== 'auto'));
  for (const s of state.slots) if (!RESERVE_EXEMPT.has(s) && !reserves(s)) F.add('slots-reserve-space', 'css/base.css', `no rule reserves space for the "${s}" slot (.g4d-slot--${s} needs a min-height or aspect-ratio)`);
}

// ------------------------------------------------------------ rendered checks
function analyze(html, where, F, state, category) {
  const nodes = parse(html);
  const add = (rule, msg, extra = {}) => F.add(rule, where, msg, { category, ...extra });
  const wrapper = nodes[0];

  const h1 = byTag(nodes, 'h1');
  if (h1.length !== 1) add('one-h1', `expected exactly one <h1>, found ${h1.length}`);
  let prev = 0;
  for (const h of findAll(nodes, (n) => /^h[1-6]$/.test(n.tag))) {
    const lvl = Number(h.tag[1]);
    if (prev && lvl > prev + 1) add('one-h1', `heading levels skip from h${prev} to h${lvl}`);
    prev = lvl;
  }

  if (!byTag(nodes, 'header').length) add('landmarks', 'no <header>');
  if (!byTag(nodes, 'nav').length) add('landmarks', 'no <nav>');
  if (!byTag(nodes, 'footer').length) add('landmarks', 'no <footer>');
  const mains = byTag(nodes, 'main');
  if (mains.length !== 1 || mains[0].attrs.id !== 'main') add('landmarks', `expected one <main id="main">, found ${mains.length}`);

  const firstLink = findAll(nodes, (n) => n.tag === 'a')[0];
  if (!firstLink || firstLink.attrs.href !== '#main') add('skip-link', 'the first link on the page is not a skip link to #main');

  if (!wrapper || !/^(en|ta)-IN$/.test(wrapper.attrs?.lang ?? '')) add('language-attr', 'the wrapper has no lang attribute (en-IN or ta-IN)');

  for (const img of byTag(nodes, 'img')) {
    if (!('alt' in img.attrs)) add('alt-text', '<img> without alt');
    else if (img.attrs.alt === '' && img.attrs.role !== 'presentation' && img.attrs['aria-hidden'] !== 'true') add('alt-text', '<img alt=""> without role="presentation": say what the picture shows');
    if (!/^\d+$/.test(img.attrs.width ?? '') || !/^\d+$/.test(img.attrs.height ?? '')) add('alt-text', '<img> without width and height (layout shift)');
  }

  const labels = new Set(byTag(nodes, 'label').map((l) => l.attrs.for).filter(Boolean));
  const insideLabel = new Set();
  for (const l of byTag(nodes, 'label')) findAll(l.children, () => true).forEach((n) => insideLabel.add(n));
  for (const c of findAll(nodes, (n) => ['input', 'select', 'textarea'].includes(n.tag) && !['hidden', 'submit', 'button', 'image'].includes(n.attrs.type))) {
    if (!(c.attrs.id && labels.has(c.attrs.id)) && !c.attrs['aria-label'] && !c.attrs['aria-labelledby'] && !insideLabel.has(c)) add('form-labels', `<${c.tag} name="${c.attrs.name ?? ''}"> has no label`);
  }

  for (const f of byTag(nodes, 'iframe')) {
    let host = '';
    try { host = new URL(f.attrs.src ?? '').hostname; } catch { /* invalid */ }
    if (![...MAP_EMBED_HOSTS, ...VIDEO_HOSTS].includes(host)) add('iframe-hosts', `an iframe loads ${host || 'an invalid address'}, which is not an allowed map or video host`);
    if (!f.attrs.title) add('iframe-hosts', 'an iframe has no title');
  }

  // motion count per section
  for (const [sec, n] of countAnimated(nodes, state)) if (n > MAX_ANIMATED_PER_SECTION) add('motion-count', `section "${sec}" has ${n} animated elements; the limit is ${MAX_ANIMATED_PER_SECTION}`);

  for (const n of findAll(nodes, (x) => (x.tag === 'a' && 'href' in x.attrs) || ['button', 'summary', 'select', 'textarea'].includes(x.tag) || (x.tag === 'input' && x.attrs.type !== 'hidden'))) state.renderedTags.add(n.tag);
  return nodes;
}

function renderOne(render, theme, tpl, content, extra = {}) {
  const page = tpl === 'item' ? { slug: 'item', item: content.items?.[0] ?? { name: 'Item', slug: 'item' } } : { slug: tpl };
  return render({ theme, page, content, settings: {}, vendor: { id: 'lint', unclaimed: true }, host: { siteUrl: content.host?.siteUrl ?? 'https://lint.example', allowEmbeds: true }, ...extra });
}

function checkRendered(theme, F, state, categories, opts) {
  const render = opts.render ?? renderPage;
  const langs = opts.langs ?? ['en', 'ta'];
  const templates = Object.keys(theme.templates ?? {});
  const sink = (r, where, cat) => {
    for (const w of r.warnings) if (BLOCKING_WARNINGS.test(w)) F.add(/^unknown-/.test(w) ? 'bindings-known' : 'category-renders', where, `renderer warning: ${w}`, { category: cat });
  };
  const safe = (fn, rule, where, cat) => { try { return fn(); } catch (e) { F.add(rule, where, `rendering failed: ${String(e.message ?? e).split('\n')[0]}`, { category: cat }); return null; } };

  for (const cat of categories) {
    const c = categoryById(cat);
    for (const lang of langs) {
      const sample = sampleContent(cat, { lang });
      for (const tpl of templates) {
        const where = `render:${tpl}`;
        const r = safe(() => renderOne(render, theme, tpl, sample), 'category-renders', where, cat);
        if (!r) continue;
        sink(r, where, cat);
        const nodes = analyze(r.html, where, F, state, cat);
        if (tpl === 'home') {
          const blocks = findAll(nodes, (n) => 'data-block' in n.attrs).map((n) => n.attrs['data-block']);
          const missing = c.extraBlocks.filter((b) => !blocks.includes(b));
          if (missing.length) F.add('category-renders', where, `the category's extra blocks are not drawn: ${missing.join(', ')} (render the "blocks" list with data-block="{{block.key}}")`, { category: cat });
          else {
            const want = theme.presets?.[cat]?.blocks ?? c.extraBlocks; // a preset may reorder the blocks, but the category's lead block is always first
            if (blocks[0] !== c.extraBlocks[0] || blocks.join() !== want.join()) F.add('category-fit-order', where, `extra blocks are drawn as ${blocks.join(', ')}; expected ${want.join(', ')} (the category leads with ${c.extraBlocks[0]})`, { category: cat });
          }
          if (/undefined|\[object|NaN/.test(r.html)) F.add('category-renders', where, 'the page contains the text "undefined", "NaN" or "[object"', { category: cat });
        }
      }
      // text stretch: the same content 1.6x longer must still render a valid page
      const st = safe(() => renderOne(render, theme, 'home', stretchContent(sample, 1.6)), 'text-stretch', 'render:home (stretched)', cat);
      if (st) { sink(st, 'render:home (stretched)', cat); analyze(st.html, 'render:home (stretched)', F, state, cat); }
    }
    for (const kind of EXTREME_KINDS) {
      for (const tpl of ['home', 'services'].filter((x) => templates.includes(x))) {
        const where = `render:${tpl} (${kind})`;
        const r = safe(() => renderOne(render, theme, tpl, extremeContent(cat, kind)), 'category-renders', where, cat);
        if (!r) continue;
        sink(r, where, cat);
        analyze(r.html, where, F, state, cat);
        if (/undefined|\[object|NaN/.test(r.html)) F.add('category-renders', where, 'the page contains the text "undefined", "NaN" or "[object"', { category: cat });
      }
    }
  }
}

/**
 * entitlements-render: the platform decides at render time which of video, cart and booking a vendor gets, so every category is rendered
 * with all entitlements ON and all OFF. Both must render cleanly, and neither may leave a gap: no empty slot box, and no section that
 * exists only to host a gated slot (guard such a section with data-g4d-if="entitlements.<name>").
 */
function checkEntitlements(theme, F, state, categories, opts) {
  const render = opts.render ?? renderPage;
  const templates = Object.keys(theme.templates ?? {});
  for (const cat of categories) {
    const sample = sampleContent(cat, { lang: 'en' });
    for (const [mode, ent] of [['on', ENTITLEMENTS_ON], ['off', ENTITLEMENTS_OFF]]) {
      for (const tpl of templates) {
        const where = `render:${tpl} (entitlements ${mode})`;
        let r;
        try { r = renderOne(render, theme, tpl, sample, { entitlements: ent }); } catch (e) { F.add('entitlements-render', where, `rendering failed: ${String(e.message ?? e).split('\n')[0]}`, { category: cat }); continue; }
        for (const w of r.warnings) if (BLOCKING_WARNINGS.test(w)) F.add('entitlements-render', where, `renderer warning: ${w}`, { category: cat });
        const nodes = parse(r.html);
        for (const n of findAll(nodes, (x) => 'data-g4d-slot' in x.attrs)) {
          const name = n.attrs['data-g4d-slot'];
          if (!n.children.some((k) => (k.type === 'el') || (k.type === 'text' && k.value.trim() !== '') || k.type === 'raw')) F.add('entitlements-render', where, `the "${name}" slot is drawn as an empty box (entitlements ${mode})`, { category: cat });
          if (mode === 'off' && GATED_SLOTS[name]) F.add('entitlements-render', where, `the "${name}" slot is drawn although its entitlement is off`, { category: cat });
        }
        for (const sec of findAll(nodes, (x) => 'data-g4d-section' in x.attrs)) {
          const solid = textOf(sec.children).trim() !== '' || findAll(sec.children, (x) => ['img', 'iframe', 'svg', 'picture'].includes(x.tag)).length > 0;
          if (!solid) F.add('entitlements-render', where, `section "${sec.attrs['data-g4d-section']}" is empty when the entitlements are ${mode}: hide it with data-g4d-if="entitlements.<name>" (or content) so no gap is left`, { category: cat });
        }
        if (mode === 'on') for (const [slot, key] of Object.entries(GATED_SLOTS)) {
          if (state.slots.has(slot) && !r.slots.some((s) => s.name === slot && s.rendered) && ['home', 'item', 'contact'].includes(tpl) && theme.templates[tpl].includes(`<g4d-${slot}>`)) F.add('entitlements-render', where, `entitlements.${key} is on but the "${slot}" slot was not drawn`, { category: cat });
        }
      }
    }
  }
}

/**
 * preset-valid: presets/<categoryId>.json files. Each must match the schema, name only fonts the theme lists, keep the category's lead block first, pass AA in light and
 * dark against the theme's own text colours, use a hero pattern the theme's CSS defines, and only hide sections the home page has and may hide. A theme that has any preset
 * must have one for every category it lists.
 */
function checkPresets(theme, model, F, state) {
  const presets = theme.presets ?? {};
  for (const e of theme.presetErrors ?? []) F.add('preset-valid', e.file, e.message);
  const ids = Object.keys(presets);
  if (!ids.length) return;
  const sections = new Map();
  for (const n of findAll(state.parsed.home ?? [], (x) => 'data-g4d-section' in x.attrs)) sections.set(n.attrs['data-g4d-section'], n.attrs['data-g4d-section'] !== 'hero' && n.attrs['data-g4d-optional'] !== 'false');
  const { light, dark } = state.model;
  const tokens = { text: light['--g4d-text'], muted: light['--g4d-muted'], textDark: dark['--g4d-text'] ?? light['--g4d-text'], mutedDark: dark['--g4d-muted'] ?? light['--g4d-muted'] };
  for (const id of ids) {
    const where = `presets/${id}.json`;
    const p = presets[id];
    for (const e of validatePreset(p, { manifest: theme.manifest, file: where })) F.add('preset-valid', where, `${e.path}: ${e.message}`);
    if (validateAgainst(PRESET_SCHEMA, p).length) continue;
    for (const msg of paletteFindings(p.palette, tokens)) F.add('preset-valid', where, msg);
    const pat = p.hero.pattern;
    if (!model.rules.some(({ r }) => r.selectors.some((s) => new RegExp(`data-pattern=['"]?${pat}['"]?\\]`).test(s)))) F.add('preset-valid', where, `the hero pattern "${pat}" has no CSS in this theme ([data-pattern=${pat}])`);
    for (const sid of p.sections?.hidden ?? []) {
      if (!sections.has(sid)) F.add('preset-valid', where, `hidden section "${sid}" does not exist in the home template`);
      else if (!sections.get(sid)) F.add('preset-valid', where, `section "${sid}" is not optional and cannot be hidden by default`);
    }
    for (const sid of p.sections?.order ?? []) if (!sections.has(sid)) F.add('preset-valid', where, `ordered section "${sid}" does not exist in the home template`);
  }
  for (const id of theme.manifest?.categories ?? []) if (hasCategory(id) && !presets[id]) F.add('preset-valid', 'presets/', `the theme lists the category "${id}" but has no preset for it`);
}

/**
 * image-budget: the home page of every category is rendered with the Free limits (8 services, 5 gallery images, 6 FAQs, a picture on everything) and with the largest Pro
 * content (entitlements on). It may hold at most 12 pictures (<img>) for Free and 19 for Pro. Only the hero picture is eager (exactly one, fetchpriority high); every other
 * picture is loading="lazy" with a width and a height; a decorative picture (alt="" or role="presentation") is not allowed: decoration is inline SVG or CSS.
 */
/** A Premium theme styles the same markup per layout variant with [data-variant=...] on the wrapper; every variant that one of its categories uses needs CSS. */
export function checkVariantCoverage(theme, F, categories) {
  if (theme.manifest?.tier !== 'Premium') return;
  const css = ['base', 'tokens', 'motion'].map((k) => theme.css?.[k] ?? '').join('\n');
  const used = new Map();
  for (const c of categories) { const v = variantFor(c).id; used.set(v, [...(used.get(v) ?? []), c]); }
  for (const [v, cats] of used) {
    const re = new RegExp(`\\[data-variant\\s*[~|]?=\\s*["']?${v}["']?\\s*\\]`);
    if (!re.test(css)) F.add('variant-coverage', 'css/base.css', `no CSS selects [data-variant=${v}] (used by ${cats.slice(0, 3).join(', ')}${cats.length > 3 ? ` and ${cats.length - 3} more` : ''}); a Premium theme must style the variant "${v}" (e.g. .g4d-theme[data-variant="${v}"] .hero { ... })`);
  }
}

function checkImages(theme, F, state, categories, opts) {
  const render = opts.render ?? renderPage;
  const modes = [['Free limits', freeLimitContent, ENTITLEMENTS_OFF, IMAGE_BUDGET.free], ['maximum Pro content', proMaxContent, ENTITLEMENTS_ON, IMAGE_BUDGET.pro]];
  for (const cat of categories) {
    for (const [label, make, ent, max] of modes) {
      const where = `render:home (${label})`;
      let r;
      try { r = renderOne(render, theme, 'home', make(cat), { entitlements: ent }); } catch (e) { F.add('image-budget', where, `rendering failed: ${String(e.message ?? e).split('\n')[0]}`, { category: cat }); continue; }
      const nodes = parse(r.html);
      const imgs = byTag(nodes, 'img');
      if (imgs.length > max) F.add('image-budget', where, `${imgs.length} pictures on the home page; the limit is ${max}. Show fewer pictures (the first three services, at most eight gallery images, no copies for the lightbox) and draw decoration with SVG or CSS`, { category: cat });
      const hero = findAll(nodes, (n) => n.attrs['data-g4d-section'] === 'hero')[0];
      const heroImgs = hero ? byTag(hero.children, 'img') : [];
      if (heroImgs.length > 1) F.add('image-budget', where, `the hero holds ${heroImgs.length} pictures; only one is allowed and it is the eager one`, { category: cat });
      for (const img of heroImgs) {
        if (img.attrs.fetchpriority !== 'high') F.add('image-budget', where, 'the hero picture needs fetchpriority="high"', { category: cat });
        if (img.attrs.loading === 'lazy') F.add('image-budget', where, 'the hero picture must not be loading="lazy"', { category: cat });
      }
      for (const img of imgs) {
        const what = (img.attrs.alt || img.attrs.src || 'a picture').slice(0, 40);
        if (!heroImgs.includes(img) && img.attrs.loading !== 'lazy') F.add('image-budget', where, `"${what}" is below the first screen and must be loading="lazy" (only the hero picture is eager)`, { category: cat });
        if (img.attrs.alt === '' || img.attrs.role === 'presentation' || img.attrs['aria-hidden'] === 'true') F.add('image-budget', where, `a decorative picture ("${what}") is not allowed: draw decoration as inline SVG or CSS`, { category: cat });
        if (!/^\d+$/.test(img.attrs.width ?? '') || !/^\d+$/.test(img.attrs.height ?? '')) F.add('image-budget', where, `"${what}" has no width and height`, { category: cat });
      }
    }
  }
}

// ------------------------------------------------------------ the entry points
/**
 * @param {object} theme  see lib/theme.mjs
 * @param {{categories?:string[], langs?:string[], vendorAccent?:string, vendorAccentDark?:string, render?:Function}} [opts]
 */
export function lintTheme(theme, opts = {}) {
  const F = new Findings();
  const state = { slots: new Set(), parsed: {}, renderedTags: new Set(), checked: new Set(), touchTags: new Set(), animated: new Set(), stagger: new Set(), revealing: new Set() };
  const categories = (opts.categories ?? theme.manifest?.categories ?? []).filter(hasCategory);

  for (const e of validateManifest(theme.manifest ?? {})) F.add('manifest-valid', `theme.json:${e.path}`, e.message);
  checkTemplateSource(theme, F, state);
  const model = cssModel(theme);
  checkCss(theme, model, F, state, opts);
  checkHero(theme, model, F, state);
  checkSlotsSource(theme, model, F, state, categories);
  checkPresets(theme, model, F, state);
  checkRendered(theme, F, state, categories, opts);
  checkEntitlements(theme, F, state, categories, opts);
  checkImages(theme, F, state, categories, opts);
  checkVariantCoverage(theme, F, categories);

  for (const tag of state.renderedTags) if (!state.touchTags.has(tag)) F.add('touch-targets', 'css/base.css', `no rule gives <${tag}> a minimum height of 44px (e.g. .g4d-theme :is(a, button, summary) { min-height: 44px })`);

  const checked = RULE_IDS.filter((id) => id !== 'responsive-browser');
  return { themeId: theme.manifest?.id ?? '(unknown)', ok: F.list.length === 0, findings: F.list, rulesChecked: checked, categories, counts: { errors: F.list.length } };
}

/** lintTheme plus the real-browser overflow check at 360, 414, 768, 1024, 1280 and 1536 px. `opts.browser` is a Playwright Browser. */
export async function lintThemeBrowser(theme, opts = {}) {
  const result = lintTheme(theme, opts);
  const F = new Findings();
  const widths = opts.browserWidths ?? BREAKPOINTS;
  const render = opts.render ?? renderPage;
  for (const cat of result.categories) {
    const variants = [['en', null], ['ta', null], ['en', 'long-name'], ['en', 'long-list'], ['en', 'long-text'], ['ta', 'long-name']];
    for (const [lang, kind] of variants) {
      const content = kind ? extremeContent(cat, kind, { lang }) : sampleContent(cat, { lang });
      const rendered = renderOne(render, theme, 'home', content);
      const measures = await measureOverflow(opts.browser, pageDocument({ theme, rendered }), widths);
      for (const m of measures) if (m.overflow) F.add('responsive-browser', `render:home (${kind ?? lang})`, `horizontal scroll at ${m.width}px (page is ${m.scrollWidth}px wide; widest: ${m.offenders.join(', ') || 'unknown'})`, { category: cat });
    }
  }
  return { ...result, ok: result.ok && F.list.length === 0, findings: [...result.findings, ...F.list], rulesChecked: RULE_IDS, counts: { errors: result.findings.length + F.list.length } };
}

export function formatReport(result) {
  const lines = [];
  lines.push(`${result.ok ? 'PASS' : 'FAIL'}  ${result.themeId}  (${result.categories.length} categories, ${result.rulesChecked.length} rules)`);
  const byRule = new Map();
  for (const f of result.findings) { if (!byRule.has(f.rule)) byRule.set(f.rule, []); byRule.get(f.rule).push(f); }
  for (const [rule, list] of byRule) {
    lines.push(`  x ${rule} (${list.length})`);
    for (const f of list.slice(0, 8)) lines.push(`      ${f.where}: ${f.message}${f.categories.length ? `  [${f.categories.slice(0, 3).join(', ')}${f.categories.length > 3 ? `, +${f.categories.length - 3}` : ''}]` : ''}`);
    if (list.length > 8) lines.push(`      ... and ${list.length - 8} more`);
  }
  return lines.join('\n');
}
