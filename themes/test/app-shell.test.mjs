import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../lib/render.mjs';
import { loadTheme } from '../lib/theme.mjs';
import { sampleContent, ENTITLEMENTS_ON } from '../fixtures/index.mjs';

// S1 shell, platform side: the five-item bar, the request sheet that carries the chosen item, the install button and the chat drawer place. All of it is a call to action: a Free site gets none.
const FORM = [
  { key: 'address', label: 'Your address', type: 'text', required: true },
  { key: 'when', label: 'Preferred time', type: 'select', required: false, options: ['Morning', 'Evening'] },
  { key: 'visit_date', label: 'Visit date', type: 'date', required: false },
  { key: 'notes', label: 'Anything else', type: 'longtext', required: false },
];
const content = (extra = {}) => ({ ...sampleContent('plumber'), requestForm: FORM, ...extra });
const render = (slug, c, ent, page = {}) => renderPage({ theme: loadTheme('free-service-pro'), page: { slug, ...page }, content: c, settings: {}, vendor: { id: 'v' }, host: { siteUrl: 'https://x.get4domain.com' }, entitlements: ent });
const on = { ...ENTITLEMENTS_ON, callsToAction: true };
const FREE = { video: false, cart: false, booking: false, customDomain: false, callsToAction: false };

test('the bottom bar has five items in order: Home, Services, Request, Call, WhatsApp', () => {
  const html = render('home', content(), on).html;
  const nav = /<nav[^>]*data-g4d-slot="bottom-nav"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
  const items = [...nav.matchAll(/<a href="([^"]*)" data-track="([a-z]+)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[2], m[3], m[1]]);
  assert.deepEqual(items.map((i) => i[0]), ['home', 'services', 'request', 'call', 'whatsapp']);
  assert.deepEqual(items.map((i) => i[1]).slice(0, 1), ['Home']);
  assert.equal(items[2][2], '#g4d-request');
  assert.match(items[3][2], /^tel:/);
  assert.match(items[4][2], /^https:\/\/wa\.me\//);
});

test('the request sheet carries the data-driven fields, the name, phone, consent, the source and an item picker', () => {
  const html = render('home', content(), on).html;
  assert.match(html, /<section id="g4d-request" class="g4d-sheet" data-g4d-slot="request-sheet"/);
  assert.match(html, /<form class="g4d-form" method="post" action="\/enquire">/);
  assert.match(html, /name="f_address"[^>]*required/);
  assert.match(html, /<select id="[^"]+" name="f_when"[^>]*><option value=""><\/option><option value="Morning">Morning<\/option><option value="Evening">Evening<\/option><\/select>/);
  assert.match(html, /name="f_visit_date" type="date"/);
  assert.match(html, /<textarea id="[^"]+" name="f_notes"/);
  assert.match(html, /name="source" value="request-sheet"/);
  assert.match(html, /<select id="[^"]+" name="item"><option value="">Not sure yet<\/option>/);
  assert.equal([...html.matchAll(/<label for="([^"]+)"/g)].every((m) => html.includes(`id="${m[1]}"`)), true, 'every label points at a field that exists');
});

test('on an item page the chosen item is already selected in the sheet', () => {
  const c = content(); const item = c.items[0];
  const html = render('item', c, on, { item, parent: 'services' }).html;
  assert.match(html, new RegExp(`<option value="${item.id}" selected>`));
  assert.equal((html.match(/ selected>/g) ?? []).length, 1);
});

test('the install button is in the page but hidden until the browser offers installing', () => {
  const html = render('home', content(), on).html;
  assert.match(html, /<div class="g4d-install" data-g4d-slot="install-button" hidden><button type="button" class="g4d-btn" data-g4d-install>Install app<\/button><\/div>/);
});

test('the chat drawer place exists only when the plan has chat', () => {
  assert.doesNotMatch(render('home', content(), on).html, /data-g4d-slot="chat-drawer"/);
  assert.match(render('home', content(), { ...on, chat: true }).html, /<aside class="g4d-chat" data-g4d-slot="chat-drawer"[^>]*hidden><\/aside>/);
});

test('a Free site (no calls to action) gets none of the shell, not even by the stripping fallback', () => {
  const html = render('home', content(), { ...FREE, chat: true }).html;
  for (const bad of ['g4d-request', 'request-sheet', 'install-button', 'chat-drawer', 'data-g4d-install', '/enquire', 'action="/enquire"']) assert.equal(html.includes(bad), false, bad);
  const stored = render('home', content(), { ...on, chat: true }).html;
  const stripped = render('home', content(), { ...FREE }).html;
  assert.notEqual(stored, stripped);
});

test('a page with no request form data draws no sheet (older pages and fixtures are unchanged)', () => {
  const html = render('home', sampleContent('plumber'), on).html;
  assert.doesNotMatch(html, /g4d-sheet|data-g4d-install/);
});

test('a field with an unsafe key is dropped and values are escaped', () => {
  const bad = content({ requestForm: [{ key: 'x"><script>', label: 'Bad', type: 'text' }, { key: 'ok_field', label: '<b>Label</b>', type: 'select', options: ['<i>a</i>'] }] });
  const html = render('home', bad, on).html;
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;b&gt;Label&lt;\/b&gt;/);
  assert.match(html, /<option value="&lt;i&gt;a&lt;\/i&gt;">/);
});
