// BOLT_BRIEF.md: the brief for a designer who has never seen the repository. It is GENERATED from the code (vocabulary, categories, limits, lint rules and the
// motion kit), so it cannot drift: test/bolt-brief.test.mjs compares the committed themes/BOLT_BRIEF.md with this output and checks that every binding, list,
// slot, token, font, variant, motion class and lint rule appears. The hand-written parts are the explanations in the tables below (SLOT_NOTES, MOTION_CLASSES, RULE_HELP).
import {
  BINDINGS, REPEATERS, NESTED_LISTS, DATA_ATTRIBUTES, SLOTS, REQUIRED_SLOTS_ALL, GATED_SLOTS, ENTITLEMENT_KEYS, TOKENS, MOTION_TOKENS, APPROVED_FONTS, APPROVED_TAMIL_FONTS,
  MOTION_INTENSITIES, LIMITS, IMAGE_BUDGET, FREE_LIMITS, PAGE_TEMPLATES, PRESET_PATTERNS, MAP_EMBED_HOSTS, VIDEO_HOSTS, BREAKPOINTS,
} from './vocabulary.mjs';
import { FAMILIES, CATEGORIES } from './categories.mjs';
import { RULE_IDS } from './lint.mjs';

const kb = (n) => `${n / 1024} KB`;

/** What each platform slot draws and which attributes the tag accepts. Every slot also accepts class="...". */
export const SLOT_NOTES = {
  action: { tag: '<g4d-action label="Book now">', attrs: 'label="Book now"', note: 'the main call-to-action button (text and link come from the vendor\'s content)' },
  'header-nav': { tag: '<g4d-header-nav label="Main">', attrs: 'label="Main"', note: 'the page links, plus the phone menu: a "Menu" link and a panel opened with :target (#g4d-menu)' },
  'bottom-nav': { attrs: '-', note: 'the sticky phone bar: Call, WhatsApp, Directions' },
  footer: { tag: '<g4d-footer variant="columns">', attrs: 'variant="columns" (or centered, minimal)', note: 'name, address, phone, email and social links' },
  hours: { attrs: '-', note: 'the opening-hours table' },
  tabs: { attrs: '-', note: 'tab bar for pages that show grouped content' },
  map: { attrs: '-', note: 'the map: one click-to-load embed; reserve its space in CSS' },
  'social-links': { attrs: '-', note: 'the social icons and links the vendor filled in' },
  cart: { attrs: '-', note: 'the basket button; drawn only when the vendor\'s plan allows a cart' },
  'enquiry-form': { attrs: '-', note: 'the enquiry form (a theme never draws its own form)' },
  'whatsapp-float': { attrs: '-', note: 'the floating WhatsApp button' },
  reviews: { attrs: '-', note: 'the reviews block' },
  video: { tag: '<g4d-video limit="3">', attrs: 'limit="3" (1 to 6)', note: 'videos as pictures with a play link; drawn only when the plan allows video' },
  booking: { attrs: '-', note: 'the booking panel; drawn only when the plan allows booking' },
  'product-grid': { tag: '<g4d-product-grid limit="12" images="3">', attrs: 'limit="12" images="3" (images = how many cards carry a picture; the rest are text cards)', note: 'the shop catalogue; also required for the Ecommerce categories' },
  search: { attrs: '-', note: 'the catalogue search box' },
  'claim-banner': { attrs: '-', note: 'the banner shown on a listing the owner has not claimed yet' },
  'listed-on-badge': { attrs: '-', note: 'the "Listed on Get4Domain" badge' },
  'open-now': { attrs: '-', note: 'an "Open now / Closed" label' },
  'share-qr': { attrs: '-', note: 'share links and a QR code' },
};

/** The motion kit classes. `covers` lists every kit class the entry explains (a test checks the list equals the classes in shared/motion-kit.css). */
export const MOTION_CLASSES = [
  { cls: 'g4d-reveal', covers: ['g4d-reveal'], example: '<ul class="g4d-reveal"><li>…</li><li>…</li></ul>', note: 'the box and its first six children fade and rise as they enter the screen, one after another. Never on the hero.' },
  { cls: 'g4d-hero-zoom', covers: ['g4d-hero-zoom'], example: '<div class="g4d-hero-zoom"><img src="{{hero.image}}" …></div>', note: 'the hero picture zooms very slowly (Medium and Rich).' },
  { cls: 'g4d-shimmer', covers: ['g4d-shimmer'], example: '<em class="g4d-shimmer">friendly</em>', note: 'a soft brightness pulse on the accent word of the headline (Rich).' },
  { cls: 'g4d-float', covers: ['g4d-float'], example: '<span class="g4d-float">24x7</span>', note: 'a badge that floats gently up and down.' },
  { cls: 'g4d-underline', covers: ['g4d-underline'], example: '<a class="g4d-underline" href="{{cta.href}}">{{cta.label}}</a>', note: 'a line draws under the link on hover and focus.' },
  { cls: 'g4d-sweep', covers: ['g4d-sweep'], example: '<li class="card g4d-sweep">…</li>', note: 'the same line, in the accent colour, sweeps along the bottom edge of a card.' },
  { cls: 'g4d-count', covers: ['g4d-count'], example: '<strong class="g4d-count" style="--g4d-to:25"></strong>', note: 'an EMPTY element that counts from 0 to the number in --g4d-to. Only for a fixed number you write yourself: a binding inside style="" is removed, so do not use it for the vendor\'s numbers.' },
  { cls: 'g4d-marquee', covers: ['g4d-marquee', 'g4d-marquee__track'], example: '<div class="g4d-marquee"><div class="g4d-marquee__track"><ul>…</ul><ul aria-hidden="true">…the same list again…</ul></div></div>', note: 'a strip that scrolls slowly and pauses on hover and focus (Medium and Rich).' },
  { cls: 'g4d-lift', covers: ['g4d-lift'], example: '<li class="card g4d-lift">…</li>', note: 'a card rises 4 px on hover and focus.' },
  { cls: 'g4d-parallax', covers: ['g4d-parallax'], example: '<div class="g4d-parallax"><img …></div>', note: 'the picture drifts as the page scrolls (Rich).' },
  { cls: 'g4d-ba', covers: ['g4d-ba', 'g4d-ba__after'], example: '<div class="g4d-ba" id="ba1"><img …><img class="g4d-ba__after" …></div><a href="#ba1">Show after</a>', note: 'a before and after switch with no script: half of the second picture shows, and following the link #ba1 shows all of it.' },
  { cls: 'g4d-divider', covers: ['g4d-divider'], example: '<div class="g4d-divider"></div>', note: 'a section divider whose shape follows the wrapper\'s data-divider (wave, curve, diagonal, notch, speed-line).' },
  { cls: 'g4d-burger', covers: ['g4d-burger', 'g4d-menu'], example: '<a class="g4d-burger" href="#g4d-menu"><i></i><i></i><i></i></a>', note: 'the phone menu button: three bars (give each <i> display:block, a height of 2px and a 5px gap) that turn into a cross while the menu is open.' },
  { cls: 'g4d-bottom-nav', covers: ['g4d-slot--bottom-nav'], example: '<g4d-bottom-nav></g4d-bottom-nav>', note: 'automatic: the sticky phone bar slides up.' },
  { cls: 'g4d-whatsapp-float', covers: ['g4d-slot--whatsapp-float'], example: '<g4d-whatsapp-float></g4d-whatsapp-float>', note: 'automatic: the floating button pulses three times and stops.' },
];

/** One plain explanation per lint rule: what it means and how to fix it. Keys must equal the lint's rule list (a test checks). */
export const RULE_HELP = {
  'manifest-valid': { what: 'theme.json is wrong or incomplete', fix: 'compare it with library/_starter/theme.json: id, version, name, tier, tracks, families, categories, layoutVariantRules, motion, settingsSchema, fonts.' },
  'no-script-tag': { what: 'a <script> is in a template', fix: 'remove it. Themes are HTML and CSS only; use :target, :has() and CSS animations for behaviour.' },
  'no-inline-handler': { what: 'an onclick, onload or other on… attribute', fix: 'remove it; use a link to #anchor and CSS :target instead.' },
  'no-forbidden-element': { what: 'an element the platform draws for you (form, input, iframe, style…)', fix: 'delete it and place the matching slot, e.g. <g4d-enquiry-form>, <g4d-map>. Put CSS in css/*.css, not in <style>.' },
  'no-seo-output': { what: '<title>, <meta>, canonical links or JSON-LD in a template', fix: 'remove them. The platform writes all SEO tags.' },
  'no-external-request': { what: 'an address on another website (image, font, stylesheet, script)', fix: 'use only pictures from the content bindings or inline SVG. Fonts are named, never loaded.' },
  'iframe-hosts': { what: 'an embed from a host that is not allowed', fix: 'do not write embeds; the map and video slots do it safely.' },
  'css-hygiene': { what: '!important, @import or nested rules in CSS', fix: 'write plain, flat rules with enough specificity instead of !important; no @import.' },
  'css-scoped': { what: 'a CSS selector that does not start with .g4d-theme', fix: 'start every selector with .g4d-theme (for example .g4d-theme .card { … }); keyframes are the only exception.' },
  'approved-fonts': { what: 'a font that is not one of the twelve', fix: 'use only the approved fonts listed above.' },
  'tamil-fonts': { what: 'the body font stack has no Tamil font', fix: 'add "Noto Sans Tamil" (or "Noto Serif Tamil") to --g4d-font-body.' },
  'tokens-defined': { what: 'a --g4d-* token is missing, or not redefined for dark mode', fix: 'define all eleven tokens in css/tokens.css and again inside @media (prefers-color-scheme: dark).' },
  'contrast-tokens': { what: 'text and background colours that are too close', fix: 'make text/background, muted/background and the button text pass 4.5:1 (WCAG AA) in light and dark.' },
  'contrast-accent': { what: 'the vendor\'s accent colour cannot be made readable on your background', fix: 'use a background that leaves room for a readable accent in both modes.' },
  'one-h1': { what: 'zero or more than one <h1>', fix: 'exactly one <h1> per page.' },
  landmarks: { what: 'a missing <header>, <nav>, <main id="main"> or <footer>', fix: 'add the landmark; there is exactly one <main id="main">.' },
  'skip-link': { what: 'the first link is not the "skip to content" link', fix: 'start the page with <a class="skip-link" href="#main">{{ui.skip}}</a>.' },
  'language-attr': { what: 'a lang attribute in a template', fix: 'remove it; the platform sets lang (en-IN or ta-IN) on the wrapper.' },
  'alt-text': { what: 'an <img> without alt, or alt="" on a real picture', fix: 'give every picture alt text from its binding, and width and height.' },
  'form-labels': { what: 'a form control without a label', fix: 'you should have no forms; use the enquiry-form slot.' },
  'touch-targets': { what: 'links or buttons smaller than 44 px', fix: 'add .g4d-theme :is(a, button, summary) { min-height: 44px; } (and enough width).' },
  'responsive-static': { what: 'fixed widths or pictures that can overflow a phone', fix: 'use max-width: 100% on pictures and flexible grids; no fixed pixel widths wider than 360.' },
  'responsive-browser': { what: 'a page scrolls sideways at 360, 414, 768, 1024, 1280 or 1536 px (real browser check)', fix: 'find the wide element, give it min-width: 0 or max-width: 100%.' },
  'text-stretch': { what: 'long names or Tamil words can overflow', fix: 'set overflow-wrap: anywhere on the wrapper and min-width: 0 on grid and flex children.' },
  'css-budget-layout': { what: 'tokens.css + base.css + print.css are 40 KB or more', fix: 'remove unused rules; reuse selectors.' },
  'css-budget-motion': { what: 'css/motion.css is 6 KB or more', fix: 'keep the motion kit unchanged and add at most about 2 KB of your own.' },
  'reduced-motion': { what: 'no @media (prefers-reduced-motion: reduce) block that stops animation', fix: 'keep the motion kit at the top of css/motion.css; it has the block.' },
  'hero-visible': { what: 'the hero is hidden at the start, optional, or missing', fix: 'mark the hero data-g4d-section="hero" (not optional) and never give it g4d-reveal.' },
  'motion-properties': { what: 'an animation or transition on width, height, top, left, colour…', fix: 'animate only transform, opacity, clip-path and filter.' },
  'motion-count': { what: 'more than 12 animated elements in one section', fix: 'use fewer motion classes in that section.' },
  'slots-required': { what: 'a required platform slot is not in any template', fix: 'place every required slot from the table above in the home template (or the shared header and footer).' },
  'slots-reserve-space': { what: 'a slot has no reserved space, so the page jumps when it loads', fix: 'give .g4d-slot--<name> a min-height or aspect-ratio in base.css.' },
  'bindings-known': { what: 'a {{name}}, list, attribute or slot tag that does not exist', fix: 'use only the names in the vocabulary above; check spelling.' },
  'print-stylesheet': { what: 'print.css does not hide navigation', fix: 'add @media print { .g4d-theme nav, .g4d-theme .g4d-slot { display: none; } }.' },
  'html-budget': { what: 'a rendered page is over 100 KB', fix: 'remove repeated markup and big inline SVG.' },
  'category-renders': { what: 'a category block or list is not shown', fix: 'keep the generic loop over blocks (<template data-g4d-each="blocks">) so every category\'s extra blocks render.' },
  'category-fit-order': { what: 'the blocks of a category come out in the wrong order', fix: 'loop over blocks in order; do not reorder them in CSS.' },
  'entitlements-render': { what: 'a section that only hosts a video, cart or booking slot leaves an empty gap when the plan does not allow it', fix: 'put data-g4d-if="entitlements.video" (or cart, booking) on that section.' },
  'preset-valid': { what: 'a preset file is wrong', fix: 'ship no presets; Claude Code generates them after import.' },
  'image-budget': { what: 'too many pictures, no eager hero, a decorative <img>, or a picture without size', fix: 'see the picture rules above: one eager hero, everything else loading="lazy" with width and height, decoration as SVG or CSS.' },
  'variant-coverage': { what: 'a Premium theme has no CSS for a layout variant that one of its categories uses', fix: 'add rules such as .g4d-theme[data-variant="bold-split"] .hero { … } for each variant in the table above.' },
};

const familyRows = () => Object.entries(FAMILIES).map(([fam, f]) => {
  const v = f.variant;
  return `| \`${fam}\` | \`${v.id}\` | ${v.hero} | ${v.header} | ${v.services} | ${v.secondaryServices ?? '-'} | ${v.card} | ${v.divider} | ${v.decor ?? '-'} | ${v.motion ?? '-'} |`;
}).join('\n');

const bindingGroups = () => {
  const groups = new Map();
  for (const b of BINDINGS) { const g = b.includes('.') ? b.split('.')[0] : 'other'; groups.set(g, [...(groups.get(g) ?? []), b]); }
  return [...groups].map(([g, list]) => `- **${g}**: ${list.map((b) => `\`{{${b}}}\``).join(' ')}`).join('\n');
};

const listRows = () => Object.entries(REPEATERS).map(([name, r]) => `- \`<template data-g4d-each="${name}">\` ... each entry is \`${r.as}\`: ${r.fields.map((f) => `\`{{${r.as}.${f}}}\``).join(' ')}`).join('\n');

const slotRows = () => Object.entries(SLOTS).map(([name, s]) => {
  const n = SLOT_NOTES[name];
  const required = REQUIRED_SLOTS_ALL.includes(name) ? 'yes' : name === 'product-grid' ? 'Ecommerce categories' : GATED_SLOTS[name] ? 'no (any theme may place it)' : 'no';
  const gate = GATED_SLOTS[name] ? ` Drawn only when the plan has \`entitlements.${GATED_SLOTS[name]}\`.` : '';
  const tag = `\`${n.tag ?? `<${s.tag}>`}\``;
  return `| \`${name}\` | ${tag} | ${required} | ${n.attrs.startsWith('-') ? 'class' : `${n.attrs}; class`} | ${n.note}.${gate} |`;
}).join('\n');

const motionRows = () => MOTION_CLASSES.map((m) => `| \`${m.cls}\` | \`${m.example}\` | ${m.note} |`).join('\n');
const ruleRows = () => RULE_IDS.map((id) => `| \`${id}\` | ${RULE_HELP[id].what} | ${RULE_HELP[id].fix} |`).join('\n');

export function boltBrief() {
  return `# Get4Domain theme kit: brief for Bolt

*This file is generated from the kit's code. Do not edit it by hand.*

You are designing a **website theme** for Get4Domain. A theme is a set of HTML templates and CSS files that the platform fills with a business's own content (name, services, photos, hours). You do not write any content, any script or any form: you design the look. The kit in this folder checks your work with the same rules the platform uses, so what passes here imports without rework.

## 1. What you deliver

A folder \`library/<id>/\` in this exact layout (copy \`library/_starter\` or one of the \`library/free-*\` themes and change it):

\`\`\`
library/<id>/
  theme.json            name, id, tier (Premium), the categories and families it serves, motion default, fonts
  templates/            ${PAGE_TEMPLATES.map((p) => `${p}.html`).join(', ')} (home is required; the others as needed)
  css/base.css          layout and components (with tokens.css, under ${kb(LIMITS.layoutCssBytes)})
  css/tokens.css        the colour, radius and font tokens (light and dark)
  css/motion.css        the shared motion kit, copied unchanged, then your own motion (whole file under ${kb(LIMITS.motionCssBytes)})
  css/print.css         print rules that hide navigation
  assets/               optional: SVG decoration only
\`\`\`

There are **no presets**: do not add a \`presets/\` folder. Claude Code generates the presets for each category after your theme is imported.

## 2. Run it

- \`npm run lint -- <id>\`  checks one theme for every category it lists (add \`--category <category-id>\` to check just one).
- \`npm run lint:all\`  checks every theme in \`library/\`. Your theme must say PASS.
- \`npm run preview\`  starts a review server on 127.0.0.1 (open the address it prints): Coverage, Variant picker, Motion lab, Performance, Contrast and a rendered page for every category, in English and Tamil.
- \`npm run pack -- <id>\`  builds the zip of your theme.

A lint line looks like \`x rule-name (1)\` followed by \`templates/home.html: the message\`. Section 11 explains every rule and how to fix it.

## 3. The page markup

Templates are plain HTML with these additions. The renderer fills them; it never runs script.

- **Values**: \`{{name}}\` is replaced with escaped text. Only the names below exist; anything else is an error.
- **Lists**: \`<template data-g4d-each="items"><li>{{item.name}}</li></template>\` repeats its content for each entry. Inside, the entry has the name given below.
- **Conditions**: \`data-g4d-if="hero.image"\` keeps the element only when that value (or list) is not empty; \`data-g4d-if-not="..."\` keeps it only when it is empty. Plan features are conditions too: \`data-g4d-if="entitlements.video"\`.
- **Sections**: wrap each page section as \`<section data-g4d-section="services" data-g4d-label="Services">\`. Add \`data-g4d-optional="true"\` when the owner may hide it. The hero is never optional.
- **Platform slots**: custom tags such as \`<g4d-enquiry-form></g4d-enquiry-form>\`. The platform draws them; you style the box around them.

### Values
${bindingGroups()}

Plan features (true or false): ${ENTITLEMENT_KEYS.map((k) => `\`{{entitlements.${k}}}\``).join(' ')}. Use them as conditions, for example \`<section data-g4d-section="booking" data-g4d-if="entitlements.booking"><g4d-booking></g4d-booking></section>\`.

### Lists and their fields
${listRows()}

Nested lists: ${Object.entries(NESTED_LISTS).map(([k]) => `\`${k}\``).join(', ')}. Every list entry also has \`n\` (its position from 1), \`featured\` (true for the first three entries that have a picture), \`shown\` (true for the first eight) and \`initial\` (the first letter of the name, for a letter badge instead of a photo): for example \`<img data-g4d-if="item.featured" …>\` gives only the first three services a picture.

### Template attributes
${DATA_ATTRIBUTES.map((a) => `\`${a}\``).join(', ')}.

### Platform slots
A theme places a slot with its tag; **required** slots must appear somewhere in the templates (usually in the header, footer or home page). Every slot also accepts a \`class\`.

| Slot | Tag | Required | Attributes | What it draws |
|---|---|---|---|---|
${slotRows()}

Give each slot's box a \`min-height\` or \`aspect-ratio\` (class \`.g4d-slot--<name>\`) so the page does not jump when it loads.

## 4. Plan features (entitlements)

Any theme may place \`<g4d-video>\`, \`<g4d-cart>\` and \`<g4d-booking>\`. The platform draws them **only when the owner's plan allows it**; otherwise they draw nothing. So a section that exists only to host one of them must carry \`data-g4d-if="entitlements.video"\` (or \`.cart\`, \`.booking\`), or it leaves an empty gap. Never build your own cart, booking or video player.

## 5. CSS tokens

Define these in \`css/tokens.css\` on \`.g4d-theme\` for light mode and again inside \`@media (prefers-color-scheme: dark)\`. Use them everywhere; never write a hard-coded colour in \`base.css\`.

${TOKENS.map((t) => `\`${t}\``).join(', ')}

Motion tokens (set by the kit, change only if you must): ${MOTION_TOKENS.map((t) => `\`${t}\``).join(', ')}.

Also defined for presets (use them with a fallback): the palette variables \`--g4d-pal-*\`. Hero decoration patterns a category may choose: ${PRESET_PATTERNS.join(', ')}.

### Fonts
Name only these twelve (the platform hosts them; never load a font yourself): ${APPROVED_FONTS.map((f) => `**${f}**`).join(', ')}. The body font stack must include a Tamil font (${APPROVED_TAMIL_FONTS.join(' or ')}).

## 6. What the renderer puts on the wrapper

Every page is wrapped as \`<div class="g4d-theme g4d-theme-<id>" lang="en-IN" data-variant="…" data-hero="…" data-header="…" data-services="…" data-card="…" data-divider="…" data-decor="…" data-motion="…">\`.

- \`lang\` is \`en-IN\` or \`ta-IN\`; never write \`lang\` yourself. Tamil text is longer and wraps differently: test it in the preview.
- \`data-variant\` and its parts (\`data-hero\`, \`data-header\`, \`data-services\`, \`data-card\`, \`data-divider\`, \`data-decor\`) say which layout the category uses. Style the SAME markup per variant with attribute selectors, for example \`.g4d-theme[data-variant="bold-split"] .hero { … }\`. An element only some variants need stays in the markup and is hidden by CSS elsewhere (never a second \`<img>\`).
- \`data-motion\` is \`off\`, \`low\`, \`medium\` or \`rich\` (${MOTION_INTENSITIES.join(', ')}); the motion kit reads it.

## 7. The nine layout variants

A Premium theme must have CSS for **every variant that one of its categories uses** (\`[data-variant="…"]\` selectors).

| Family | Variant (\`data-variant\`) | Hero | Header | Services | Secondary | Card | Divider | Decor | Default motion |
|---|---|---|---|---|---|---|---|---|---|
${familyRows()}

${CATEGORIES.length} categories belong to these ${Object.keys(FAMILIES).length} families; the variant follows from the category and the owner cannot change it.

## 8. The motion kit

\`css/motion.css\` starts with the shared motion kit between the markers \`/* shared:motion-kit:begin */\` and \`/* shared:motion-kit:end */\`. Copy it unchanged from \`shared/motion-kit.css\` and use the classes below; do not write your own animation CSS for these effects. Everything is switched by \`data-motion\` (Off is fully static) and stops under the visitor's reduced-motion setting. Only transform, opacity, clip-path and filter are animated.

| Class | Example | What it does |
|---|---|---|
${motionRows()}

Dividers use the wrapper's \`data-divider\`: wave, curve, diagonal, notch, speed-line.

## 9. Budgets

- Layout CSS (tokens + base + print): under ${kb(LIMITS.layoutCssBytes)}. Motion CSS: under ${kb(LIMITS.motionCssBytes)} (the kit is under 4 KB, so about 2 KB is yours).
- One rendered page: under ${kb(LIMITS.htmlPageBytes)}. A whole theme package: under ${LIMITS.packageBytes / 1024 / 1024} MB.
- Pictures on the home page: at most ${IMAGE_BUDGET.free} pictures with the Free limits (${FREE_LIMITS.services} services, ${FREE_LIMITS.gallery} gallery images, ${FREE_LIMITS.faqs} FAQs) and fewer than ${IMAGE_BUDGET.pro + 1} pictures with the largest Pro content.
- Only the hero picture is eager (\`fetchpriority="high"\`); every other picture is \`loading="lazy"\`. Every picture has \`alt\` text and **width and height**. Decoration is inline SVG or CSS, never an \`<img>\` (no \`alt=""\`). A gallery has **one picture per photo**; its lightbox is the same figure opened with \`:target\`.
- Pages must not scroll sideways at ${BREAKPOINTS.join(', ')} px. Links and buttons are at least 44 px high.

## 10. Not allowed

\`<script>\`, \`<form>\`, \`<input>\`, \`<select>\`, \`<textarea>\`, \`<iframe>\`, \`<object>\`, \`<embed>\`, \`<canvas>\`, \`<audio>\`, \`<dialog>\`, \`<base>\`, \`<noscript>\` and \`<style>\` elements; any outside address (images, fonts, stylesheets, scripts); inline handlers such as onclick; \`<title>\`, \`<meta>\` and JSON-LD (the platform writes SEO); a \`lang\` attribute; a binding inside \`style=""\`; \`!important\` and \`@import\`; hard-coded colours in \`base.css\` (use the tokens); animating anything but transform, opacity, clip-path and filter. Maps may only come from ${MAP_EMBED_HOSTS.join(', ')} and videos from ${VIDEO_HOSTS.join(', ')}, and only through the platform slots.

## 11. Reading lint messages and fixing the common failures

\`npm run lint -- <id>\` prints one block per failing rule: the rule name, then each place and message. Find the rule in this table.

| Rule | What it means | How to fix it |
|---|---|---|
${ruleRows()}
`;
}
