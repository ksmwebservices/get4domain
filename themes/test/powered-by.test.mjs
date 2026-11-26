import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, POWERED_BY_HREF, POWERED_BY_BRAND } from '../lib/render.mjs';
import { loadTheme, listVendorThemeIds } from '../lib/theme.mjs';
import { sampleContent, ENTITLEMENTS_ON, ENTITLEMENTS_OFF } from '../fixtures/index.mjs';

// D2: the published (static) site carries "Powered by Get4Domain" on every page, free or paid, listing-only or with calls to action, whatever the theme and the settings.
const MARK = /<p class="g4d-footer__powered" data-g4d-powered-by>Powered by <a href="https:\/\/get4domain\.com\/" target="_blank" rel="noopener">Get4Domain<\/a><\/p>/g;
const page = (id, slug, entitlements, extra = {}) => renderPage({ theme: loadTheme(id), page: { slug }, content: sampleContent('plumber'), settings: {}, vendor: { id: 'v' }, host: { siteUrl: 'https://x.get4domain.com' }, entitlements, ...extra });

test('the mark: the words, the brand name alone as the link text, the address https://get4domain.com', () => {
  assert.equal(POWERED_BY_HREF, 'https://get4domain.com/'); assert.equal(POWERED_BY_BRAND, 'Get4Domain');
});

test('every library theme, Free (listing-only) and Pro, home and a second page: exactly one mark inside the footer', () => {
  let checked = 0;
  for (const id of listVendorThemeIds()) {
    for (const [label, ent] of [['free', ENTITLEMENTS_OFF], ['pro', ENTITLEMENTS_ON]]) {
      for (const slug of ['home', 'contact']) {
        let html; try { html = page(id, slug, ent); } catch { continue; }          // a theme without that page
        const html0 = typeof html === 'string' ? html : html?.html ?? '';
        if (!html0) continue;
        checked += 1;
        assert.equal((html0.match(MARK) ?? []).length, 1, `${id} ${label} ${slug}`);
        const footer = html0.slice(html0.indexOf('<footer'), html0.indexOf('</footer>'));
        assert.match(footer, MARK, `${id} ${label} ${slug}: the mark is inside the footer`);
      }
    }
  }
  assert.ok(checked >= 10, `only ${checked} pages were checked`);
});

test('nothing passed to the renderer can switch it off: plan, entitlements, settings, vendor and host options', () => {
  const id = listVendorThemeIds()[0];
  const out = page(id, 'home', ENTITLEMENTS_ON, { settings: { hidePoweredBy: true, whiteLabel: true, removeBranding: true, showBranding: false }, vendor: { id: 'v', hidePoweredBy: true, plan: 'ENTERPRISE' }, host: { siteUrl: 'https://x.example.com', hidePoweredBy: true, texts: {} } });
  const html = typeof out === 'string' ? out : out.html;
  assert.equal((html.match(MARK) ?? []).length, 1);
  // a custom domain host
  const custom = page(id, 'home', ENTITLEMENTS_ON, { host: { siteUrl: 'https://www.sriganeshplumbing.in' } });
  assert.equal(((typeof custom === 'string' ? custom : custom.html).match(MARK) ?? []).length, 1);
});
