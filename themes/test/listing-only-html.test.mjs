import test from 'node:test';
import assert from 'node:assert/strict';
import { listingOnlyHtml } from '../lib/render.mjs';

/** listingOnlyHtml turns an already rendered page (built when the vendor had calls to action) into a listing, for a lapsed plan or a suspended vendor. */
const PAGE = '<!doctype html><html><body><div class="g4d-theme">'
  + '<section class="g4d-slot" data-g4d-slot="enquiry-form"><div><div>nested</div></div><form action="/enquire"><button>Send</button></form></section>'
  + '<p>Keep this text</p>'
  + '<a class="g4d-slot" data-g4d-slot="action" href="/enquire">Get a quote</a>'
  + '<nav data-g4d-slot="bottom-nav"><ul><li><a href="tel:+911234567890">Call</a></li></ul></nav>'
  + '<footer data-g4d-slot="footer"><p>Phone: <a href="tel:+911234567890">+91 12345 67890</a> <a href="mailto:a@b.in">a@b.in</a></p></footer>'
  + '<div data-g4d-slot="map">Map and address</div>'
  + '</div></body></html>';
const TEXTS = { listedOn: 'Listed on Get4Domain', footerBridge: 'Bridge line.' };

test('every call-to-action slot element goes with what is inside it, nested tags included; everything else stays', () => {
  const out = listingOnlyHtml(PAGE, TEXTS);
  assert.doesNotMatch(out, /enquiry-form|nested|<form|<button|bottom-nav|data-g4d-slot="action"|Get a quote/);
  assert.match(out, /Keep this text/); assert.match(out, /data-g4d-slot="map">Map and address</); assert.match(out, /data-g4d-slot="footer"/);
});

test('a phone or email link in the footer becomes plain text', () => {
  const out = listingOnlyHtml(PAGE, TEXTS);
  assert.doesNotMatch(out, /href="tel:|href="mailto:/); assert.match(out, /\+91 12345 67890/); assert.match(out, /a@b\.in/);
});

test('the two platform lines are added inside the theme wrapper, once; running it again changes nothing', () => {
  const out = listingOnlyHtml(PAGE, TEXTS);
  assert.match(out, /data-g4d-listed-on[^>]*>Listed on Get4Domain</); assert.match(out, /data-g4d-footer-bridge[^>]*>Bridge line\.</);
  assert.ok(out.indexOf('data-g4d-listing-note') < out.indexOf('</body>'));
  assert.equal(listingOnlyHtml(out, TEXTS), out);
});

test('without texts nothing is invented; a page with no calls to action is left byte for byte', () => {
  assert.doesNotMatch(listingOnlyHtml(PAGE, {}), /data-g4d-listing-note/);
  const plain = '<!doctype html><html><body><div class="g4d-theme"><p>Only text</p></div></body></html>';
  assert.equal(listingOnlyHtml(plain, {}), plain);
});
