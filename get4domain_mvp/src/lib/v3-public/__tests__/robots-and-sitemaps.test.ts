import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MOCK_DIRECTORY_ROBOTS } from '../mocks';
import { parseDirectoryRobots, robotsToText, sitemapRoute, type RobotsInput } from '../robots';

const BASE: RobotsInput = {
  rules: [
    { userAgent: 'GPTBot', allow: '/' },
    { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/admin/', '/login'] },
  ],
  sitemap: ['https://main.example.invalid/sitemap.xml'],
  host: 'main.example.invalid',
};

const INDEXABLE = parseDirectoryRobots(MOCK_DIRECTORY_ROBOTS);
const OFF = parseDirectoryRobots('User-agent: *\nAllow: /\nDisallow: /go/\n');
const SITEMAP = 'https://staging.example.invalid/sitemaps/directory-index.xml';

describe('the backend robots text', () => {
  test('is indexable only when it carries a Sitemap line', () => {
    assert.equal(INDEXABLE.indexable, true);
    assert.equal(OFF.indexable, false);
    assert.equal(parseDirectoryRobots(null).indexable, false);
  });

  test('the directory Disallow lines are taken from it, and a bare Disallow slash never is', () => {
    assert.ok(INDEXABLE.disallow.includes('/go/'));
    assert.ok(INDEXABLE.disallow.includes('/v3/go/'));
    assert.equal(parseDirectoryRobots('Disallow: /\nDisallow: /x/\nSitemap: https://a.example.invalid/s.xml').disallow.includes('/'), false);
  });
});

describe('the main robots output', () => {
  test('unchanged in content while the directory pages are not indexable', () => {
    const t = robotsToText(BASE, OFF, SITEMAP);
    assert.doesNotMatch(t, /go\//);
    assert.doesNotMatch(t, /sitemaps\/directory-index/);
    assert.match(t, /User-Agent: GPTBot\nAllow: \//);
    assert.match(t, /Disallow: \/dashboard\//);
    assert.match(t, /Sitemap: https:\/\/main\.example\.invalid\/sitemap\.xml/);
    assert.match(t, /Host: main\.example\.invalid/);
  });

  test('gains only the directory Disallow lines and the directory Sitemap line when indexable', () => {
    const off = robotsToText(BASE, OFF, SITEMAP);
    const on = robotsToText(BASE, INDEXABLE, SITEMAP);
    const added = on.split('\n').filter((l) => !off.split('\n').includes(l) && l.trim());
    for (const l of added) assert.match(l, /^(Disallow: |Sitemap: )/, l);
    assert.ok(on.includes(`Sitemap: ${SITEMAP}`));
    assert.ok(on.includes('Disallow: /go/'));
    // every group gets the lines: a crawler with its own group ignores the catch-all group
    assert.equal(on.split('Disallow: /go/').length - 1, 2);
  });

  test('no Sitemap line without a canonical origin, and no line twice', () => {
    assert.doesNotMatch(robotsToText(BASE, INDEXABLE, null), /directory-index/);
    const withDup: RobotsInput = { rules: { userAgent: '*', disallow: ['/go/'] } };
    assert.equal(robotsToText(withDup, INDEXABLE, null).split('Disallow: /go/').length - 1, 1);
  });
});

describe('the directory sitemap paths', () => {
  test('the index and numbered chunks map to the backend; nothing else is served', () => {
    assert.equal(sitemapRoute('directory-index.xml'), '/v3/directory/sitemaps/index.xml');
    assert.equal(sitemapRoute('directory-1.xml'), '/v3/directory/sitemaps/directory-1.xml');
    assert.equal(sitemapRoute('directory-123.xml'), '/v3/directory/sitemaps/directory-123.xml');
    for (const bad of ['directory-0.xml', 'directory-01.xml', 'directory-.xml', 'index.xml', '../directory-1.xml', 'directory-1.xml/x', 'directory-12345.xml', 'sitemap.xml']) assert.equal(sitemapRoute(bad), null, bad);
  });
});

import { directoryHostRobots } from '../robots';

describe('robots.txt of the directory host', () => {
  const backend = ['User-agent: Googlebot', 'Allow: /', 'Disallow: /go/', 'Disallow: /*?*q=', '', 'User-agent: *', 'Allow: /', 'Disallow: /go/', 'Disallow: /*?*q=', '', 'Sitemap: https://other.example.invalid/sitemap.xml', ''].join('\n');
  test('the backend rules are kept and the Sitemap line points at this host only', () => {
    const t = directoryHostRobots(backend, 'https://directory.main.example.invalid');
    assert.match(t, /User-agent: Googlebot\nAllow: \/\nDisallow: \/go\//);
    assert.match(t, /Disallow: \/\*\?\*q=/);
    assert.match(t, /Sitemap: https:\/\/directory\.main\.example\.invalid\/sitemaps\/directory-index\.xml/);
    assert.equal((t.match(/^Sitemap:/gim) ?? []).length, 1);
    assert.doesNotMatch(t, /other\.example\.invalid/);
  });
  test('no Sitemap line from the backend (not indexable) means none here, and Host lines are dropped', () => {
    const t = directoryHostRobots('User-agent: *\nAllow: /\nDisallow: /go/\nHost: other.example.invalid\n', 'https://directory.main.example.invalid');
    assert.doesNotMatch(t, /sitemap|Host:|other\.example/i);
    assert.match(t, /Disallow: \/go\//);
  });
  test('never closes the whole site', () => {
    assert.doesNotMatch(directoryHostRobots(backend, 'https://directory.main.example.invalid'), /^Disallow: \/\s*$/m);
  });
});
