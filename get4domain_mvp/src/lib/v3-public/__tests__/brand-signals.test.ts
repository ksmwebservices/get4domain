import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import nextConfig from '../../../../next.config';
import { siteConfig } from '../../../constants/site';
import { POWERED_BY_BRAND, POWERED_BY_HREF, PoweredBy } from '../../../engine/components/PoweredBy';
import { PORTAL } from '../portal-strings';
import { firmOrganizationLd, organizationLd, webSiteLd } from '../site-jsonld';

const withEnv = <T,>(env: Record<string, string | undefined>, fn: () => T): T => {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { return fn(); } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
};
const HOST = { MAIN_HOST: 'get4domain.com', DIRECTORY_HOST: 'directory.get4domain.com' };
const FIRM = { legalName: 'KSM QUANTUM TECHNOLOGIES', address: 'Tidel Park, Chennai', gstin: '', supportEmail: '', supportPhone: '' };

describe('brand signals: Organization and WebSite JSON-LD', () => {
  test('the Organization names the brand, its legal name, url, logo and a stable @id', () => {
    const o = withEnv(HOST, organizationLd);
    assert.equal(o['@type'], 'Organization');
    assert.equal(o['@id'], 'https://get4domain.com/#organization');
    assert.equal(o.name, 'Get4Domain');
    assert.equal(o.legalName, 'KSM QUANTUM TECHNOLOGIES');
    assert.equal(o.url, 'https://get4domain.com/');
    assert.equal(o.logo, 'https://get4domain.com/logo.png');
    assert.equal(o.alternateName, 'Get4Domain.com');
  });
  test('sameAs is left out while every profile is "#" or empty, and never invented', () => {
    assert.ok(Object.values(siteConfig.social).every((v) => v === '#' || v === '' || /^https?:\/\//.test(v)));
    const social = siteConfig.social as Record<string, string>;
    const saved = { ...social };
    try {
      for (const k of Object.keys(social)) social[k] = '#';
      assert.ok(!('sameAs' in withEnv(HOST, organizationLd)));
      social.linkedin = 'https://www.linkedin.com/company/example-profile';
      social.twitter = '';
      assert.deepEqual(withEnv(HOST, organizationLd).sameAs, ['https://www.linkedin.com/company/example-profile']);
    } finally { Object.assign(social, saved); }
  });
  test('About and Contact describe the same entity (same @id, same spellings) and add the address', () => {
    withEnv(HOST, () => {
      const home = organizationLd(); const firm = firmOrganizationLd(FIRM);
      assert.equal(firm['@id'], home['@id']);
      assert.equal(firm.name, 'Get4Domain');
      assert.equal(firm.logo, home.logo);
      assert.equal((firm.address as { addressLocality: string }).addressLocality, 'Chennai');
    });
  });
  test('the WebSite block has its own @id, the brand name, the publisher and the search action', () => {
    const w = withEnv(HOST, webSiteLd) as Record<string, unknown> & { potentialAction?: { '@type': string } };
    assert.equal(w['@id'], 'https://get4domain.com/#website');
    assert.equal(w.name, 'Get4Domain');
    assert.equal(w.url, 'https://get4domain.com/');
    assert.deepEqual(w.publisher, { '@id': 'https://get4domain.com/#organization' });
    assert.equal(w.potentialAction?.['@type'], 'SearchAction');
  });
  test('with MAIN_HOST unset no address is guessed', () => {
    const o = withEnv({ MAIN_HOST: undefined }, organizationLd);
    for (const k of ['@id', 'url', 'logo']) assert.ok(!(k in o), k);
    assert.equal(o.name, 'Get4Domain');
  });
});

describe('brand signals: the home h1 and the Powered by link', () => {
  test('the home h1 contains the brand once, spelled Get4Domain', () => {
    assert.match(PORTAL.home.h1, /^Get4Domain\b/);
    assert.equal((PORTAL.home.h1.match(/Get4Domain/gi) ?? []).length, 1);
    assert.ok(!/get 4 domain|get4 domain/i.test(PORTAL.home.h1));
  });
  test('Powered by is a link to the main site with the anchor text Get4Domain', () => {
    assert.equal(POWERED_BY_HREF, 'https://get4domain.com/');
    assert.equal(POWERED_BY_BRAND, 'Get4Domain');
    const html = renderToStaticMarkup(createElement(PoweredBy));
    assert.match(html, /Powered by <a href="https:\/\/get4domain\.com\/"[^>]*>Get4Domain<\/a>/);
  });
});

describe('brand signals: private screens are noindex by header', () => {
  test('admin, dashboard, customer, account and sign-in carry X-Robots-Tag noindex', async () => {
    const rules = await nextConfig.headers!();
    for (const source of ['/admin/:path*', '/dashboard/:path*', '/customer/:path*', '/account/:path*', '/login']) {
      const r = rules.find((x) => x.source === source);
      assert.ok(r, source);
      assert.ok(r.headers.some((h) => h.key === 'X-Robots-Tag' && /noindex/.test(h.value)), source);
    }
  });
});
