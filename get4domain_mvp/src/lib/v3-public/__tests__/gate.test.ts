import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gateBody, gateDirectory, resetGateMemo } from '../gate';
import { directoryCandidate, LIVE_SEGMENTS } from '../routes';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../app');

/** The first path segments the live app answers, read from the folders of src/app (route groups are looked through, dynamic and private folders are not segments). */
function liveFolders(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (!statSync(path.join(dir, n)).isDirectory()) continue;
    // dotted folders are file routes (sitemap-leadspace.xml): the middleware matcher never sends a dotted path to the gate
    if (n.startsWith('_') || n.startsWith('[') || n.startsWith('@') || n.includes('.')) continue;
    if (n.startsWith('(') && n.endsWith(')')) { if (n !== '(directory)') liveFolders(path.join(dir, n), out); continue; }
    out.push(n);
  }
  return out;
}

describe('the live routes the directory gate never touches', () => {
  test('every live top-level folder of src/app is on the list (add new live routes to LIVE_SEGMENTS)', () => {
    const ours = new Set(['directory', 'claim', 'legal', 'account', 'sitemaps', 'directory-go', 'directory-api', 'directory-pages', 'directory-robots']);
    const missing = liveFolders(app).filter((f) => !LIVE_SEGMENTS.has(f) && !ours.has(f));
    assert.deepEqual(missing, []);
  });

  test('the list holds the redirect sources of next.config.ts and the file routes', () => {
    for (const s of ['domain-campaign', 'products', 'digital-growth', 'robots.txt', 'sitemap.xml']) assert.ok(LIVE_SEGMENTS.has(s), s);
  });

  test('live pages, files and the fixed V3 routes are never candidates', () => {
    for (const p of ['/', '/pricing', '/pricing/x', '/demo/clinic', '/dashboard/crm', '/login', '/go/summer', '/terms', '/claim', '/legal/terms', '/directory', '/directory-go/b-1', '/directory-pages/chennai', '/Pricing']) {
      assert.equal(directoryCandidate(p), null, p);
    }
  });

  test('anything else that can be a directory address is a candidate', () => {
    assert.equal(directoryCandidate('/chennai'), '/chennai');
    assert.equal(directoryCandidate('/chennai/plumbers/page/2'), '/chennai/plumbers/page/2');
    assert.equal(directoryCandidate('/business/x'), '/business/x');
    assert.equal(directoryCandidate('/zzz'), '/zzz');
    assert.equal(directoryCandidate('/a/b/c/d/e/f'), null);
    assert.equal(directoryCandidate('/bad_segment'), null);
  });
});

describe('the gate answers the real status', () => {
  test('an address that exists is rewritten to the page', async () => {
    resetGateMemo();
    assert.deepEqual(await gateDirectory('/chennai/plumbers'), { kind: 'rewrite', path: '/chennai/plumbers' });
    assert.deepEqual(await gateDirectory('/business/sri-murugan-plumbing'), { kind: 'rewrite', path: '/business/sri-murugan-plumbing' });
  });

  test('an unknown address and a page past the last are 404', async () => {
    resetGateMemo();
    assert.deepEqual(await gateDirectory('/zzz'), { kind: 'status', status: 404 });
    assert.deepEqual(await gateDirectory('/chennai/plumbers/page/9'), { kind: 'status', status: 404 });
    assert.deepEqual(await gateDirectory('/business/nope'), { kind: 'status', status: 404 });
  });

  test('a removed business is 410', async () => {
    resetGateMemo();
    assert.deepEqual(await gateDirectory('/business/removed-shop'), { kind: 'status', status: 410 });
  });

  test('a live route passes untouched', async () => {
    assert.deepEqual(await gateDirectory('/pricing'), { kind: 'pass' });
  });

  test('answers are remembered briefly', async () => {
    resetGateMemo();
    let t = 1000;
    const first = await gateDirectory('/zzz', () => t);
    t += 10;
    assert.equal(await gateDirectory('/zzz', () => t), first);
  });

  test('the status pages are noindex and say what happened', () => {
    for (const s of [404, 410, 503] as const) {
      const html = gateBody(s);
      assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
      assert.equal((html.match(/<h1>/g) ?? []).length, 1);
      assert.match(html, /<main>/);
    }
    assert.match(gateBody(404), /Page not found/);
    assert.match(gateBody(410), /no longer listed/);
  });
});
