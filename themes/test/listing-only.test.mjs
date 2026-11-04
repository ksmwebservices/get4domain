import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../lib/render.mjs';
import { loadTheme, listVendorThemeIds } from '../lib/theme.mjs';
import { sampleContent, ENTITLEMENTS_LISTING, ENTITLEMENTS_ON, ENTITLEMENTS_OFF } from '../fixtures/index.mjs';

/**
 * Slice 5.4b (owner rules 5, 6 and 8): a site without the callsToAction entitlement is an informational listing. The assertion list below is the contract: it must hold on every
 * theme, for one category of each track, on every page template.
 */
const TEXTS = { listedOn: 'Listed on Get4Domain', footerBridge: 'Footer bridge line from the setting.', seededNotice: 'This page was created from public information. Is this your business? Claim it or ask us to remove it.', customerDisclosure: 'Disclosure line from the setting.' };
const HOST = { siteUrl: 'https://x.get4domain.com', texts: TEXTS };
const CATS = ['plumber', 'dentist', 'jewellery'];   // one category of each track: handyman, professional, ecommerce
const FORBIDDEN = [
  [/<form\b/i, 'a form'], [/<button\b/i, 'a button'], [/<input\b/i, 'an input'], [/<textarea\b/i, 'a textarea'],
  [/href="tel:/i, 'a tel: link'], [/href="sms:/i, 'an sms: link'], [/href="mailto:/i, 'a mailto: link'], [/wa\.me/i, 'a wa.me link'], [/api\.whatsapp\.com/i, 'a WhatsApp link'],
  [/href="\/(?:cart|book|enquire|checkout)\b/i, 'a cart, booking or enquiry link'],
  [/data-g4d-slot="(?:enquiry-form|booking|cart|whatsapp-float|action|bottom-nav|share-qr|search)"/, 'a call-to-action slot'], [/data-track="(?:cta|call|whatsapp)"/, 'a call-to-action tracker'],
];
const themeFor = (cat) => listVendorThemeIds().map((id) => loadTheme(id)).find((t) => t.manifest.categories.includes(cat));
const render = (theme, cat, page, ent, host = HOST) => {
  const content = sampleContent(cat);
  return renderPage({ theme, page: page === 'item' ? { slug: 'item', item: content.items[0] } : { slug: page }, content, settings: {}, vendor: { id: 'v', unclaimed: false }, host, entitlements: ent });
};

for (const cat of CATS) {
  test(`${cat}: the listing-only output has no call to action of any kind on any page of its theme`, () => {
    const theme = themeFor(cat);
    assert.ok(theme, `a theme serves ${cat}`);
    for (const page of Object.keys(theme.templates)) {
      const html = render(theme, cat, page, ENTITLEMENTS_LISTING).html;
      for (const [re, what] of FORBIDDEN) assert.doesNotMatch(html, re, `${theme.manifest.id}/${cat}/${page}: ${what}`);
    }
  });
}

test('the phone number is plain text on a listing-only site, and the hours, map and photos still render', () => {
  const theme = themeFor('plumber'); const phone = sampleContent('plumber').contact.phone;
  const all = render(theme, 'plumber', 'home', ENTITLEMENTS_LISTING).html + render(theme, 'plumber', 'contact', ENTITLEMENTS_LISTING).html;
  assert.ok(all.includes(phone), 'the number is shown as text');
  assert.ok(/g4d-hours/.test(all), 'hours');
  assert.ok(/data-g4d-slot="map"/.test(all), 'map');
  assert.ok(/<img\b/.test(all), 'photos');
});

test('the slots report says the call-to-action slots were not drawn', () => {
  const r = render(themeFor('plumber'), 'plumber', 'home', ENTITLEMENTS_LISTING);
  for (const n of ['enquiry-form', 'whatsapp-float', 'bottom-nav', 'action', 'share-qr']) assert.ok(!r.slots.some((s) => s.name === n && s.rendered), n);
});

test('listing-only pages carry the Listed on Get4Domain line and the footer line from the platform setting; a site with calls to action does not', () => {
  const theme = themeFor('plumber');
  const html = render(theme, 'plumber', 'home', ENTITLEMENTS_LISTING).html;
  assert.match(html, /data-g4d-listed-on[^>]*>Listed on Get4Domain</); assert.match(html, /data-g4d-footer-bridge[^>]*>Footer bridge line from the setting\.</);
  assert.doesNotMatch(render(theme, 'plumber', 'home', ENTITLEMENTS_OFF).html, /data-g4d-listed-on|data-g4d-footer-bridge/);
});

test('a Pro site draws the call-to-action slots, and the customer disclosure sits inside the form', () => {
  const theme = themeFor('plumber');
  const all = render(theme, 'plumber', 'contact', ENTITLEMENTS_ON).html + render(theme, 'plumber', 'home', ENTITLEMENTS_ON).html;
  assert.match(all, /<form class="g4d-form"/); assert.match(all, /href="tel:/);
  const form = /<form class="g4d-form"[\s\S]*?<\/form>/.exec(all)[0];
  assert.match(form, /data-g4d-disclosure[^>]*>Disclosure line from the setting\.</);
});

test('the seeded notice appears only for SEEDED and INVITED sites, with working claim and remove links', () => {
  const theme = themeFor('plumber');
  for (const life of ['SEEDED', 'INVITED']) {
    const html = render(theme, 'plumber', 'home', ENTITLEMENTS_LISTING, { ...HOST, lifecycle: life }).html;
    assert.match(html, /data-g4d-seeded-notice[^>]*>This page was created from public information\. Is this your business\? Claim it or ask us to remove it\./);
    assert.match(html, /<a href="\/claim">/); assert.match(html, /<a href="\/remove">/);
  }
  for (const life of ['CLAIMED_FREE', 'PRO', undefined]) assert.doesNotMatch(render(theme, 'plumber', 'home', ENTITLEMENTS_LISTING, { ...HOST, lifecycle: life }).html, /data-g4d-seeded-notice/, String(life));
});

test('a call or chat link written into the vendor text never becomes a link on a listing-only page', () => {
  const theme = themeFor('plumber');
  const content = sampleContent('plumber');
  content.about = { ...(content.about ?? {}), text: '<p>Call <a href="tel:+919876543210">us</a> or <a href="https://wa.me/919876543210">chat</a> or <a href="https://example.com/about">read more</a></p>' };
  const free = renderPage({ theme, page: { slug: 'about' }, content, settings: {}, vendor: {}, host: HOST, entitlements: ENTITLEMENTS_LISTING }).html;
  assert.doesNotMatch(free, /href="tel:|href="https:\/\/wa\.me/);
});

test('with no texts from the platform nothing is invented: no listing lines and no notice', () => {
  const html = render(themeFor('plumber'), 'plumber', 'home', ENTITLEMENTS_LISTING, { siteUrl: 'https://x.get4domain.com', lifecycle: 'SEEDED' }).html;
  assert.doesNotMatch(html, /data-g4d-listing-note/);
});

test('the contract: calls to action default to false and only an explicit true switches them on', () => {
  const theme = themeFor('plumber');
  for (const ent of [undefined, {}, { callsToAction: 'yes' }, { callsToAction: 1 }]) assert.doesNotMatch(render(theme, 'plumber', 'home', ent).html, /<form\b|href="tel:/);
});
