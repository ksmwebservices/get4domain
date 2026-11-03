// The local review harness: a small read-only web server for the owner and for staff to look at themes. It binds to 127.0.0.1 ONLY,
// answers GET only, refuses any Host header that is not loopback, needs no script of its own, and loads nothing from outside.
// Pages: Coverage (theme x category lint grid), Motion lab, Variant picker, Performance readout, Contrast. Every themed page comes from
// the one renderer (render.mjs); the lint results come from the one lint (lint.mjs).
import http from 'node:http';
import { renderPage } from './render.mjs';
import { lintTheme } from './lint.mjs';
import { loadTheme, listThemeIds } from './theme.mjs';
import { pageDocument, cssFor } from './document.mjs';
import { parse, findAll, byTag } from './html.mjs';
import { parseRules, eachRule, resolveVarFallback } from './css.mjs';
import { motionSets, countAnimated, MAX_ANIMATED_PER_SECTION } from './motion.mjs';
import { ratio, parseHex, suggestAccent, AA_TEXT } from './contrast.mjs';
import { sampleContent, ENTITLEMENTS_ON, ENTITLEMENTS_OFF } from '../fixtures/index.mjs';
import { CATEGORIES, FAMILIES, categoryById, hasCategory, variantFor } from './categories.mjs';
import { MOTION_INTENSITIES, LIMITS } from './vocabulary.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const PAGES = ['home', 'services', 'about', 'gallery', 'contact', 'page', 'item'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const HARNESS_CSS = `
body{font:15px/1.5 system-ui,'Segoe UI',sans-serif;margin:0;background:#f6f7f7;color:#1b2321}
.h-head{background:#0f3d34;color:#fff;padding:.6rem 1rem;display:flex;gap:1rem;flex-wrap:wrap;align-items:center}
.h-head a{color:#fff;text-decoration:none;padding:.2rem .5rem;border-radius:4px}.h-head a:hover{background:#ffffff22}
.h-head strong{margin-right:1rem}
.h-main{padding:1rem;max-width:1500px;margin:0 auto}
h1{font-size:1.4rem;margin:.2rem 0 .8rem}h2{font-size:1.1rem}
table{border-collapse:collapse;background:#fff}th,td{border:1px solid #d8dedb;padding:.25rem .5rem;text-align:left;font-size:13px}
.cell.pass{background:#dff3e6}.cell.fail{background:#f8d9d9}.warn{background:#fff2cc}
.h-form{display:flex;flex-wrap:wrap;gap:.6rem;align-items:end;background:#fff;border:1px solid #d8dedb;padding:.6rem;margin-bottom:1rem}
.h-form label{display:grid;gap:.15rem;font-size:12px}.h-form select,.h-form input,.h-form button{font:inherit;padding:.25rem .4rem}
.frames{display:flex;gap:1rem;align-items:flex-start;overflow-x:auto;padding-bottom:1rem}
.frames figure{margin:0}.frames iframe{border:1px solid #9aa7a2;background:#fff}
.readout{display:flex;gap:1rem;flex-wrap:wrap;margin:.5rem 0 1rem}.readout div{background:#fff;border:1px solid #d8dedb;padding:.4rem .8rem}
.lab{border-top:2px solid #d8dedb;margin-top:1rem;padding-top:.5rem;min-height:30vh}
.note{color:#4a5a56;font-size:13px}.swatch{display:inline-block;width:1.2em;height:1.2em;vertical-align:middle;border:1px solid #888}
.labbox{padding:1.2rem;background:var(--g4d-primary,#0f5c4d);color:var(--g4d-primary-contrast,#fff);margin:.5rem 0}
.g4d-ba{display:grid;max-width:420px}.g4d-ba>img{grid-area:1/1;width:100%}
`;

function shell(title, body, extraHead = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} - theme preview</title><style>${HARNESS_CSS}</style>${extraHead}</head><body>
<div class="h-head"><strong>Get4Domain theme kit</strong><a href="/">Home</a><a href="/coverage">Coverage</a><a href="/motion">Motion lab</a><a href="/variants">Variant picker</a><a href="/performance">Performance</a><a href="/contrast">Contrast</a></div>
<div class="h-main">${body}</div></body></html>`;
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data: 'self'; frame-src 'self'; form-action 'self'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

// ---------------------------------------------------------------- parameters (validated, never trusted)
function params(url, themes) {
  const q = url.searchParams;
  const themeIds = themes;
  const theme = themeIds.includes(q.get('theme')) ? q.get('theme') : themeIds[0];
  const category = hasCategory(q.get('category')) ? q.get('category') : 'plumber';
  const lang = q.get('lang') === 'ta' ? 'ta' : 'en';
  const mRaw = (q.get('motion') ?? q.get('m') ?? '').toLowerCase();
  const motion = MOTION_INTENSITIES.find((x) => x.toLowerCase() === mRaw) ?? null;
  const page = PAGES.includes(q.get('page')) ? q.get('page') : 'home';
  const accent = HEX.test(q.get('accent') ?? '') ? q.get('accent') : null;
  const ent = q.get('ent') === 'all' ? 'all' : 'none';
  return { theme, category, lang, motion, page, accent, ent, reduced: q.get('reduced') === '1', raw: q };
}
const bad = (raw, key, valid) => { const v = raw.get(key); return v !== null && v !== '' && !valid(v); };

function renderFor(p, themeObj) {
  const content = sampleContent(p.category, { lang: p.lang });
  const page = p.page === 'item' ? { slug: 'item', item: content.items[0] } : { slug: p.page };
  const settings = {};
  if (p.motion) settings.motionIntensity = p.motion;
  if (p.accent) settings.accent = p.accent;
  return renderPage({ theme: themeObj, page, content, settings, vendor: { id: 'preview', unclaimed: false }, host: { siteUrl: content.host.siteUrl, allowEmbeds: false }, entitlements: p.ent === 'all' ? ENTITLEMENTS_ON : ENTITLEMENTS_OFF });
}

// ---------------------------------------------------------------- pages
const lintCache = new Map();
function lintFor(themeId, category) {
  const key = `${themeId}|${category}`;
  if (!lintCache.has(key)) lintCache.set(key, lintTheme(loadTheme(themeId), { categories: [category] }));
  return lintCache.get(key);
}

function homePage(themes) {
  return shell('Home', `<h1>Theme preview</h1><p class="note">This server runs on this computer only (127.0.0.1) and loads nothing from outside. Themes found: ${themes.map((t) => `<code>${esc(t)}</code>`).join(', ') || 'none'}.</p>
<ul><li><a href="/coverage">Coverage</a> - every theme against every one of the 41 categories (lint)</li><li><a href="/motion">Motion lab</a> - the ten motion effects, with a reduced-motion switch</li><li><a href="/variants">Variant picker</a> - theme, category, layout variant, motion intensity on phone, tablet and desktop frames</li><li><a href="/performance">Performance</a> - CSS size, images, likely LCP element, layout-shift risk</li><li><a href="/contrast">Contrast</a> - token contrast ratios and the accent colour tester</li></ul>
<p class="note">Command line: <code>node themes/cli.mjs lint &lt;theme&gt; --all-categories</code>, <code>node themes/cli.mjs shots --theme &lt;theme&gt; --category &lt;id&gt;</code>.</p>`);
}

function coveragePage(themes) {
  const head = `<tr><th>Category</th><th>Track</th>${themes.map((t) => `<th>${esc(t)}</th>`).join('')}</tr>`;
  const rows = CATEGORIES.map((c) => `<tr><td><code>${esc(c.id)}</code></td><td>${esc(c.track)}</td>${themes.map((t) => {
    const r = lintFor(t, c.id);
    return `<td class="cell ${r.ok ? 'pass' : 'fail'}"><a href="/lint?theme=${encodeURIComponent(t)}&amp;category=${encodeURIComponent(c.id)}">${r.ok ? 'PASS' : `FAIL (${r.findings.length})`}</a></td>`;
  }).join('')}</tr>`);
  const pass = themes.reduce((n, t) => n + CATEGORIES.filter((c) => lintFor(t, c.id).ok).length, 0);
  return shell('Coverage', `<h1>Coverage: theme by category</h1><p>${pass} of ${themes.length * CATEGORIES.length} combinations pass every rule (rendered in English and Tamil, stretched, and with the extreme fixtures).</p><table>${head}${rows.join('')}</table>`);
}

function lintPage(p, themes) {
  const r = lintFor(p.theme, p.category);
  const items = r.findings.map((f) => `<tr class="cell fail"><td>${esc(f.rule)}</td><td>${esc(f.where)}</td><td>${esc(f.message)}</td></tr>`).join('');
  return shell('Lint', `<h1>${esc(p.theme)} / ${esc(p.category)}: ${r.ok ? 'PASS' : 'FAIL'}</h1><p>${r.rulesChecked.length} rules checked.</p>${items ? `<table><tr><th>Rule</th><th>Where</th><th>Problem</th></tr>${items}</table>` : '<p class="cell pass">No problems found.</p>'}<p><a href="/variants?theme=${encodeURIComponent(p.theme)}&amp;category=${encodeURIComponent(p.category)}">See it on phone, tablet and desktop</a></p>`);
}

function variantsPage(p, themes) {
  const cat = categoryById(p.category);
  const v = variantFor(p.category);
  const variantIds = [...new Set(Object.values(FAMILIES).map((f) => f.variant.id))];
  const wanted = p.raw.get('variant');
  const effCategory = wanted && variantIds.includes(wanted) && v.id !== wanted ? CATEGORIES.find((c) => FAMILIES[c.family].variant.id === wanted)?.id ?? p.category : p.category;
  const eff = categoryById(effCategory);
  const ev = variantFor(effCategory);
  const qs = (extra = {}) => new URLSearchParams({ theme: p.theme, category: effCategory, lang: p.lang, page: p.page, ...(p.motion ? { motion: p.motion } : {}), ...(p.accent ? { accent: p.accent } : {}), ...(p.ent === 'all' ? { ent: 'all' } : {}), ...extra }).toString();
  const sel = (name, options, cur) => `<select name="${name}">${options.map(([val, label]) => `<option value="${esc(val)}"${val === cur ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
  const form = `<form class="h-form" method="get" action="/variants">
<label>Theme${sel('theme', themes.map((t) => [t, t]), p.theme)}</label>
<label>Category${sel('category', CATEGORIES.map((c) => [c.id, `${c.id} (${c.track})`]), effCategory)}</label>
<label>Layout variant (set by the category: read only)${sel('variant', variantIds.map((x) => [x, x]), ev.id)}</label>
<label>Motion intensity${sel('motion', [['', 'theme default'], ...MOTION_INTENSITIES.map((m) => [m, m])], p.motion ?? '')}</label>
<label>Language${sel('lang', [['en', 'English'], ['ta', 'Tamil']], p.lang)}</label>
<label>Page${sel('page', PAGES.map((x) => [x, x]), p.page)}</label>
<label>Entitlements (video, cart, booking, custom domain)${sel('ent', [['none', 'none (Free plan)'], ['all', 'all on (Pro plan)']], p.ent)}</label>
<label>Vendor accent<input name="accent" value="${esc(p.accent ?? '')}" placeholder="#0a5f7a" size="8"></label>
<button type="submit">Show</button></form>`;
  const src = `/render?${qs()}`;
  const frame = (w, h, label) => `<figure><figcaption>${label} - ${w}px</figcaption><iframe title="${label} ${w}px" width="${w}" height="${h}" src="${esc(src)}" loading="lazy"></iframe></figure>`;
  return shell('Variant picker', `<h1>Variant picker</h1>${form}
<p><strong>${esc(eff.label)}</strong> belongs to family <code>${esc(eff.family)}</code> ("${esc(FAMILIES[eff.family].label)}"), so the layout variant is <code>${esc(ev.id)}</code> and is <em>read only</em> for vendors. Hero: ${esc(ev.hero)}; header: ${esc(ev.header)}; services: ${esc(ev.services)}; card: ${esc(ev.card)}; divider: ${esc(ev.divider)}; decor: ${esc(ev.decor)}; default motion: ${esc(ev.motion)}. Vendors may change only the motion intensity and the accent colour.</p>
<div class="frames">${frame(360, 700, 'Phone')}${frame(768, 800, 'Tablet')}${frame(1280, 800, 'Desktop')}</div>
<p class="note"><a href="${esc(src)}">Open the page on its own</a> | <a href="/lint?${esc(new URLSearchParams({ theme: p.theme, category: effCategory }).toString())}">Lint result</a></p>`);
}

function perfFor(themeObj, themeId, category) {
  const css = { layout: ['tokens', 'base', 'print'].reduce((t, k) => t + Buffer.byteLength(themeObj.css[k] ?? ''), 0), motion: Buffer.byteLength(themeObj.css.motion ?? '') };
  const r = renderFor({ category, lang: 'en', page: 'home', motion: null, accent: null }, themeObj);
  const nodes = parse(r.html);
  const imgs = byTag(nodes, 'img');
  const hero = findAll(nodes, (n) => n.attrs['data-g4d-section'] === 'hero')[0];
  const heroImg = hero ? findAll(hero.children, (n) => n.tag === 'img')[0] : null;
  const h1 = byTag(nodes, 'h1')[0];
  const lcp = heroImg ? `hero image (${heroImg.attrs.width}x${heroImg.attrs.height}${heroImg.attrs.fetchpriority === 'high' ? ', fetchpriority high' : ''})` : h1 ? 'heading text (h1)' : 'unknown';
  const noDims = imgs.filter((i) => !/^\d+$/.test(i.attrs.width ?? '') || !/^\d+$/.test(i.attrs.height ?? '')).length;
  const slotsPlaced = findAll(nodes, (n) => 'data-g4d-slot' in n.attrs).map((n) => n.attrs['data-g4d-slot']);
  const reserve = parseRules(cssFor(themeObj));
  const reserved = new Set();
  eachRule(reserve, (rule) => { if (rule.decls.some((d) => ['min-height', 'aspect-ratio', 'height', 'min-block-size'].includes(d.prop))) for (const s of rule.selectors) for (const m of s.matchAll(/g4d-slot--([\w-]+)/g)) reserved.add(m[1]); });
  const unreserved = slotsPlaced.filter((s) => !['action', 'header-nav', 'footer'].includes(s) && !reserved.has(s));
  const risk = noDims + unreserved.length + (heroImg && heroImg.attrs.loading === 'lazy' ? 1 : 0);
  return { css, images: imgs.length, lazy: imgs.filter((i) => i.attrs.loading === 'lazy').length, lcp, noDims, unreserved, risk: risk === 0 ? 'low' : risk <= 2 ? 'medium' : 'high', slots: slotsPlaced.length };
}

function performancePage(themes) {
  const sections = themes.map((t) => {
    const themeObj = loadTheme(t);
    const rows = CATEGORIES.map((c) => {
      const f = perfFor(themeObj, t, c.id);
      return `<tr><td><code>${esc(c.id)}</code></td><td>${(f.css.layout / 1024).toFixed(1)} KB / ${(f.css.motion / 1024).toFixed(1)} KB</td><td>${f.images} (${f.lazy} lazy)</td><td>${esc(f.lcp)}</td><td class="${f.risk === 'low' ? 'cell pass' : 'cell fail'}">${esc(f.risk)}${f.noDims ? ` - ${f.noDims} image(s) without size` : ''}${f.unreserved.length ? ` - no reserved space: ${esc(f.unreserved.join(', '))}` : ''}</td></tr>`;
    }).join('');
    return `<h2>${esc(t)}</h2><p class="note">Budgets: layout CSS ${LIMITS.layoutCssBytes / 1024} KB, motion CSS ${LIMITS.motionCssBytes / 1024} KB, page ${LIMITS.htmlPageBytes / 1024} KB. Estimates come from the markup (no browser): LCP is the hero image if there is one, otherwise the main heading.</p><table><tr><th>Category</th><th>CSS size (layout / motion)</th><th>Images</th><th>Estimated LCP element</th><th>Layout shift risk</th></tr>${rows}</table>`;
  });
  return shell('Performance', `<h1>Performance readout</h1>${sections.join('')}`);
}

function contrastPage(p, themes) {
  const accentRaw = p.raw.get('accent');
  const pairs = [['--g4d-text', '--g4d-bg'], ['--g4d-text', '--g4d-surface'], ['--g4d-muted', '--g4d-bg'], ['--g4d-muted', '--g4d-surface'], ['--g4d-primary-contrast', '--g4d-primary'], ['--g4d-accent', '--g4d-bg'], ['--g4d-accent', '--g4d-surface']];
  const blocks = themes.map((t) => {
    const themeObj = loadTheme(t);
    const light = {}; const dark = {};
    for (const r of parseRules(themeObj.css.tokens ?? '')) {
      if (r.type === 'rule' && r.selectors.includes('.g4d-theme')) for (const d of r.decls) light[d.prop] = resolveVarFallback(d.value);
      if (r.type === 'at' && /prefers-color-scheme\s*:\s*dark/.test(r.prelude)) for (const x of r.rules ?? []) for (const d of x.decls ?? []) dark[d.prop] = resolveVarFallback(d.value);
    }
    const table = (label, m) => `<h2>${esc(t)} - ${label}</h2><table><tr><th>Text</th><th>On</th><th>Ratio</th><th>AA ${AA_TEXT}:1</th></tr>${pairs.map(([fg, bg]) => { const rt = ratio(m[fg], m[bg]); return `<tr><td>${esc(fg)} <span class="swatch" style="background:${esc(m[fg])}"></span> ${esc(m[fg])}</td><td>${esc(bg)} <span class="swatch" style="background:${esc(m[bg])}"></span> ${esc(m[bg])}</td><td>${rt === null ? 'n/a' : rt.toFixed(2)}</td><td class="cell ${rt !== null && rt >= AA_TEXT ? 'pass' : 'fail'}">${rt !== null && rt >= AA_TEXT ? 'PASS' : 'FAIL'}</td></tr>`; }).join('')}</table>`;
    const lm = { ...light }; const dm = { ...light, ...dark };
    let tester = '';
    if (accentRaw) {
      if (!HEX.test(accentRaw)) tester = '<p class="cell fail">Enter the accent as #rrggbb.</p>';
      else {
        const bgs = [lm['--g4d-bg'], lm['--g4d-surface']];
        const rts = bgs.map((bg) => ratio(accentRaw, bg));
        const ok = rts.every((x) => x >= AA_TEXT);
        const fix = ok ? accentRaw : suggestAccent(accentRaw, bgs);
        tester = `<p class="cell ${ok ? 'pass' : 'fail'}">Vendor accent <span class="swatch" style="background:${esc(accentRaw)}"></span> ${esc(accentRaw)}: ${rts.map((x) => x.toFixed(2)).join(' and ')} against the theme background and surface (needs ${AA_TEXT}:1). ${ok ? 'Accepted.' : `Suggested fix: <span class="swatch" style="background:${esc(fix)}"></span> <strong>${esc(fix)}</strong>`}</p>`;
      }
    }
    return `${table('Light', lm)}${table('Dark', dm)}${tester}`;
  });
  return shell('Contrast', `<h1>Contrast</h1><form class="h-form" method="get" action="/contrast"><label>Test a vendor accent colour<input name="accent" value="${esc(HEX.test(accentRaw ?? '') ? accentRaw : '')}" placeholder="#ffff00" size="9"></label><button type="submit">Check</button></form>${blocks.join('')}`);
}

// ---------------------------------------------------------------- motion lab
const EFFECTS = [
  ['Scroll reveal', 'Cards fade and rise as they enter the screen, staggered. Starts below the fold only.'],
  ['Hero effects', 'Slow picture zoom, sheen on the accent word, floating badge, animated underline on the call button.'],
  ['Number counters', 'Years, jobs and rating count up with a registered CSS property (the platform sets --g4d-to).'],
  ['Marquee', 'A strip of trust badges that pauses on hover and focus.'],
  ['Card hover', 'Lift, picture zoom; keyboard focus matches.'],
  ['Image treatments', 'Soft parallax, a reveal mask, and a before/after switch that needs no script (:target).'],
  ['Section dividers', 'Wave, curve, diagonal, notch and speed-line shapes chosen by the layout variant.'],
  ['Page transitions', 'Cross-document fade where the browser supports it; otherwise an instant, fully visible page.'],
  ['Sticky bar and floating button', 'The mobile Call/WhatsApp/Directions bar slides up; the floating button pulses three times and stops (phone frame below).'],
  ['Menu', 'The phone menu slides in with :target (open it in the phone frame below).'],
];

function motionPage(p, themes) {
  const themeObj = loadTheme(p.theme);
  const motion = (p.motion ?? 'Rich').toLowerCase();
  const css = (themeObj.css.motion ?? '');
  const reducedCss = css.replace(/\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)/g, 'not all').replace(/\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g, 'all');
  const labCss = [themeObj.css.tokens, themeObj.css.base, p.reduced ? reducedCss : css].join('\n');
  const card = (n) => `<li class="card g4d-lift g4d-zoom"><a class="card-link" href="#"><span class="card-title">Service ${n}</span><span class="desc">Sample card for the motion demo.</span><span class="price">Rs 499</span></a></li>`;
  const img = (kind) => `<img src="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='300'><rect width='100%' height='100%' fill='${kind === 'b' ? '#e6dcc9' : '#cfe3dc'}'/><text x='50%' y='50%' text-anchor='middle' font-family='sans-serif' font-size='28' fill='#33403c'>${kind === 'b' ? 'before' : 'after'}</text></svg>`)}" alt="" role="presentation" width="600" height="300">`;
  const marqueeItems = ['Licensed', 'Insured', 'On time', 'Clear prices', 'Local team'].map((t) => `<li class="badge" style="margin:0 .5rem">${t}</li>`).join('');
  const lab = `<div class="g4d-theme" data-motion="${esc(motion)}" data-divider="wave" lang="en-IN">
<section class="lab" id="reveal"><h2>1. ${EFFECTS[0][0]}</h2><p class="note">${EFFECTS[0][1]}</p><ul class="cards g4d-reveal">${[1, 2, 3, 4, 5, 6].map(card).join('')}</ul></section>
<section class="lab" id="hero"><h2>2. ${EFFECTS[1][0]}</h2><p class="note">${EFFECTS[1][1]}</p><div class="hero-art g4d-hero-zoom" style="max-width:420px">${img('a')}</div><h3 class="g4d-shimmer" style="display:inline-block;padding:.2rem .6rem">Fast, <em>friendly</em> service</h3> <span class="badge g4d-float">24x7</span> <a class="btn g4d-underline" href="#hero">Call now</a></section>
<section class="lab" id="counters"><h2>3. ${EFFECTS[2][0]}</h2><p class="note">${EFFECTS[2][1]}</p><p><strong class="g4d-count" style="--g4d-to:12"></strong> years &nbsp; <strong class="g4d-count" style="--g4d-to:2400"></strong> customers &nbsp; <strong class="g4d-count" style="--g4d-to:5"></strong> star rating</p></section>
<section class="lab" id="marquee"><h2>4. ${EFFECTS[3][0]}</h2><p class="note">${EFFECTS[3][1]}</p><div class="g4d-marquee" style="overflow:hidden"><div class="g4d-marquee__track"><ul style="display:flex">${marqueeItems}</ul><ul style="display:flex" aria-hidden="true">${marqueeItems}</ul></div></div></section>
<section class="lab" id="cards"><h2>5. ${EFFECTS[4][0]}</h2><p class="note">${EFFECTS[4][1]}</p><ul class="cards">${[1, 2, 3].map(card).join('')}</ul></section>
<section class="lab" id="images"><h2>6. ${EFFECTS[5][0]}</h2><p class="note">${EFFECTS[5][1]}</p><div class="g4d-parallax" style="overflow:hidden;max-width:420px">${img('a')}</div><div class="g4d-mask" style="max-width:420px;margin-top:1rem">${img('a')}</div><div class="g4d-ba" id="ba" style="margin-top:1rem">${img('b')}<span class="g4d-ba__after" style="grid-area:1/1">${img('a')}</span></div><p><a href="#ba">Show the after picture</a> | <a href="#images">Reset</a></p></section>
<section class="lab" id="dividers"><h2>7. ${EFFECTS[6][0]}</h2><p class="note">${EFFECTS[6][1]}</p>${['wave', 'curve', 'diagonal', 'notch', 'speed-line'].map((d) => `<div class="g4d-theme" data-divider="${d}"><div class="g4d-divider labbox">${d}</div></div>`).join('')}</section>
<section class="lab" id="transitions"><h2>8. ${EFFECTS[7][0]}</h2><p class="note">${EFFECTS[7][1]}</p><p><a href="/render?${new URLSearchParams({ theme: p.theme, category: 'plumber', motion: p.motion ?? 'Rich' })}">Open a themed page (watch the fade between pages)</a></p></section>
<section class="lab" id="mobile"><h2>9 and 10. ${EFFECTS[8][0]} / ${EFFECTS[9][0]}</h2><p class="note">${EFFECTS[8][1]} ${EFFECTS[9][1]}</p></section></div>`;

  const sets = motionSets((() => { const out = []; eachRule(parseRules(css), (r) => out.push(r)); return out; })());
  const counts = countAnimated(parse(lab), sets);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const worst = Math.max(0, ...counts.values());
  const bytes = Buffer.byteLength(css);
  const q = (extra) => new URLSearchParams({ theme: p.theme, ...(p.motion ? { motion: p.motion } : {}), ...extra }).toString();
  const frame = (hash, label) => `<figure style="margin:0"><figcaption>${label}</figcaption><iframe title="${label}" width="360" height="560" src="/render?${esc(new URLSearchParams({ theme: p.theme, category: 'plumber', motion: p.motion ?? 'Rich' }))}${hash}" style="border:1px solid #9aa7a2;background:#fff"></iframe></figure>`;
  const body = `<h1>Motion lab (${esc(p.theme)})</h1>
<p>Intensity: ${MOTION_INTENSITIES.map((m) => `<a href="/motion?${esc(q({ m, ...(p.reduced ? { reduced: '1' } : {}) }))}">${m}</a>`).join(' | ')} &nbsp; <strong>Reduced motion: ${p.reduced ? 'ON (everything static and fully visible)' : 'OFF'}</strong> - <a href="/motion?${esc(q({ ...(p.motion ? { m: p.motion } : {}), ...(p.reduced ? {} : { reduced: '1' }) }))}">${p.reduced ? 'turn off' : 'switch on (reduced=1)'}</a></p>
<div class="readout"><div>Animated elements in this lab: <strong>${total}</strong> (busiest section ${worst}; the limit is ${MAX_ANIMATED_PER_SECTION} per section)</div><div>Motion CSS size: <strong>${bytes} bytes</strong> of ${LIMITS.motionCssBytes} (${Math.round((bytes / LIMITS.motionCssBytes) * 100)}%)</div><div>Intensity: <strong>${esc(motion)}</strong></div></div>
<p class="note">Some effects (scroll reveal, parallax, mask) need a browser with scroll-driven animations; others fall back to the plain visible layout. The page itself uses no script.</p>
<style>${labCss}</style>${lab}
<div class="frames">${frame('', 'Phone frame: bar slides up, button pulses')}${frame('#g4d-menu', 'Phone frame: menu open')}</div>`;
  return shell('Motion lab', body);
}

// ---------------------------------------------------------------- server
export async function startPreview({ port = 4173 } = {}) {
  const themes = listThemeIds();
  const server = http.createServer((req, res) => {
    const send = (status, body, type = 'text/html; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, ...SECURITY_HEADERS }); res.end(body); };
    try {
      const host = String(req.headers.host ?? '');
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return send(403, 'Forbidden: this server answers on 127.0.0.1 only', 'text/plain; charset=utf-8');
      if (req.method !== 'GET') return send(405, 'Method not allowed', 'text/plain; charset=utf-8');
      const url = new URL(req.url ?? '/', `http://${host}`);
      const q = url.searchParams;
      if (bad(q, 'theme', (v) => themes.includes(v)) || bad(q, 'category', hasCategory)) return send(400, shell('Not found', '<h1>Unknown theme or category</h1><p><a href="/">Back</a></p>'));
      const p = params(url, themes);
      switch (url.pathname) {
        case '/': return send(200, homePage(themes));
        case '/coverage': return send(200, coveragePage(themes));
        case '/lint': return send(200, lintPage(p, themes));
        case '/variants': return send(200, variantsPage(p, themes));
        case '/performance': return send(200, performancePage(themes));
        case '/contrast': return send(200, contrastPage(p, themes));
        case '/motion': return send(200, motionPage(p, themes));
        case '/render': {
          const themeObj = loadTheme(p.theme);
          const rendered = renderFor(p, themeObj);
          return send(200, pageDocument({ theme: themeObj, rendered }));
        }
        default: return send(404, shell('Not found', '<h1>Not found</h1><p><a href="/">Back</a></p>'));
      }
    } catch (e) {
      return send(500, shell('Error', `<h1>Something went wrong</h1><p class="note">${esc(String(e.message ?? e).split('\n')[0])}</p>`));
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const addr = server.address();
  return { server, url: `http://127.0.0.1:${addr.port}`, close: () => new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections?.(); }) };
}
