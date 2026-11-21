// C2.2 the premium motion kit: one shared CSS file (themes/shared/motion-kit.css), under 4 KB, copied byte for byte into every theme package.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listThemeIds, loadTheme } from '../lib/theme.mjs';
import { LIMITS } from '../lib/vocabulary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kit = fs.readFileSync(path.join(ROOT, 'shared', 'motion-kit.css'), 'utf8');
const BEGIN = '/* shared:motion-kit:begin */\n';
const END = '/* shared:motion-kit:end */\n';

test('the kit is under 4 KB, so a theme\'s own motion plus the kit stays under the 6 KB budget', () => {
  assert.ok(Buffer.byteLength(kit) < 4096, `${Buffer.byteLength(kit)} bytes`);
  assert.equal(LIMITS.motionCssBytes, 6 * 1024);
});

test('the kit holds every effect of the brief, each behind the right condition', () => {
  const must = [
    ['scroll reveal on a view timeline, under @supports', /@supports \(animation-timeline:view\(\)\)/],
    ['staggered children', /\.g4d-reveal>:nth-child\(2\)/],
    ['hero image zoom', /\.g4d-hero-zoom img/],
    ['headline shimmer', /\.g4d-shimmer/],
    ['floating badge', /\.g4d-float,/],
    ['animated underline', /\.g4d-underline/],
    ['accent border sweep', /\.g4d-sweep/],
    ['number counter with a registered property', /@property --g4d-num/],
    ['marquee that pauses on hover', /\.g4d-marquee:is\(:hover,:focus-within\) \.g4d-marquee__track\{animation-play-state:paused\}/],
    ['card hover lift', /\.g4d-lift:is\(:hover,:focus-within\)/],
    ['parallax', /\.g4d-parallax img/],
    ['before-after slider with :target', /\.g4d-ba:target \.g4d-ba__after/],
    ['dividers: wave, diagonal, curve, notch, speed-line', /data-divider=wave[\s\S]*data-divider=curve[\s\S]*data-divider=diagonal[\s\S]*data-divider=notch[\s\S]*data-divider=speed-line/],
    ['cross-document view transition', /@view-transition\{navigation:auto\}/],
    ['sticky bar slide-up', /\.g4d-slot--bottom-nav\{animation:g4d-slideup/],
    ['pulsing action button that stops (3 cycles)', /\.g4d-slot--whatsapp-float\{animation-iteration-count:3\}/],
    ['floating badge and action button are off for Off', /:not\(\[data-motion=off\]\) :is\(\.g4d-float,\.g4d-slot--whatsapp-float\)/],
    ['mobile menu slide with :target', /\.g4d-menu:target\{animation:g4d-slideup/],
    ['animated hamburger', /\.g4d-burger i/],
    ['reduced motion block', /@media \(prefers-reduced-motion:reduce\)\{\.g4d-theme \*\{animation:none;transition:none\}\}/],
  ];
  for (const [what, re] of must) assert.match(kit, re, what);
});

test('the three tokens and the four intensities drive the kit; Off is static', () => {
  for (const t of ['--g4d-motion-speed', '--g4d-motion-ease', '--g4d-motion-distance']) assert.ok(kit.includes(t), t);
  for (const m of ['off', 'medium', 'rich']) assert.ok(kit.includes(`data-motion=${m}`), m);
  assert.match(kit, /\[data-motion=off\]\{--g4d-motion-speed:0s;--g4d-lift:0px\}/);
  // the reveal never runs for Off
  assert.match(kit, /:not\(\[data-motion=off\]\) :is\(\.g4d-reveal/);
});

test('every effect that moves something sits inside the no-preference media query (reduced motion shows everything static)', () => {
  const afterMedia = kit.slice(kit.indexOf('@media (prefers-reduced-motion:no-preference)'));
  const outside = kit.slice(0, kit.indexOf('@media (prefers-reduced-motion:no-preference)')) + afterMedia.slice(afterMedia.indexOf('.g4d-theme .g4d-divider'));
  assert.doesNotMatch(outside.replace(/@keyframes[^\n]*\n/g, ''), /(^|[;{])\s*animation\s*:\s*(?!none)/m, 'an animation outside the no-preference block');
});

test('the kit contains no colours and no outside addresses', () => {
  assert.doesNotMatch(kit.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|rgba?\(|url\(|https?:/);
});

test('every theme package carries the kit, byte for byte, between the shared-file markers', () => {
  const ids = listThemeIds();
  assert.ok(ids.includes('_starter') && ids.length >= 6, ids.join(','));
  for (const id of ids) {
    const css = loadTheme(id).css.motion;
    assert.ok(css.startsWith(BEGIN + kit + (kit.endsWith('\n') ? '' : '\n') + END), `${id}: motion.css does not start with the shared kit`);
    assert.ok(Buffer.byteLength(css) < LIMITS.motionCssBytes, `${id}: ${Buffer.byteLength(css)} bytes`);
  }
});

test('the copies are identical in all themes (one extracted kit text)', () => {
  const copies = new Set(listThemeIds().map((id) => { const c = loadTheme(id).css.motion; return c.slice(c.indexOf(BEGIN), c.indexOf(END) + END.length); }));
  assert.equal(copies.size, 1);
});
