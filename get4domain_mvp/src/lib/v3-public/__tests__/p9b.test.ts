import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PLUMBERBOY, startFakeBackend } from '../../../../scripts/v3-public/fake-backend-p9.mjs';
import { fetchThemePackage } from '../../../engine/themepack/package-fetch';
import { apiBase } from '../config';
import { freeViewOf, isFreeSite, siteApiBase } from '../site-state';

const srcFile = (f: string): string => fileURLToPath(new URL(`../../../${f}`, import.meta.url));
const readSrc = (f: string): string => readFileSync(srcFile(f), 'utf8');
const pubFile = (f: string): string => fileURLToPath(new URL(`../../../../public/${f}`, import.meta.url));

/** Run with the environment set the way a container is: the built-in public address points nowhere, the runtime INTERNAL_API_URL is right. */
async function withRuntimeEnv(internal: string, run: () => Promise<void>): Promise<void> {
  const keys = ['INTERNAL_API_URL', 'API_BASE_URL', 'NEXT_PUBLIC_API_URL'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.INTERNAL_API_URL = internal;
  delete process.env.API_BASE_URL;
  process.env.NEXT_PUBLIC_API_URL = 'http://127.0.0.1:1'; // the "baked" address: nothing listens
  try { await run(); } finally { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}

describe('P9.5 a themed (Pro) site reads the theme package from the runtime address too', () => {
  test('fetchThemePackage asks INTERNAL_API_URL, not the build-time address (the old code returned null here)', async () => {
    const fake = await startFakeBackend(0);
    try {
      await withRuntimeEnv(fake.url, async () => {
        const pkg = await fetchThemePackage('t1');
        assert.equal(pkg?.id, 't1');
        assert.equal(await fetchThemePackage('t-missing'), null, 'a package the API does not have is null (the page falls back to the built-in design)');
        assert.ok(fake.log.includes('GET /themes/package/t1'));
      });
    } finally { await fake.close(); }
  });

  test('a themed Pro site: the site data and the package both come from the runtime address, and it never gets the Free page', async () => {
    const fake = await startFakeBackend(0);
    try {
      await withRuntimeEnv(fake.url, async () => {
        const res = await fetch(`${siteApiBase()}/cms/site/themed-pro`);
        const site = (((await res.json()) as { data?: Record<string, unknown> }).data ?? {}) as { plan?: string; themeRef?: { id: string } };
        assert.equal(site.plan, 'PRO');
        assert.equal(isFreeSite(site), false);
        assert.equal(await fetchThemePackage(site.themeRef?.id ?? ''), null);
        assert.ok(fake.log.includes('GET /themes/package/t-missing'));
      });
    } finally { await fake.close(); }
  });

  test('the directory and vendor-host calls (apiBase) read INTERNAL_API_URL first, then API_BASE_URL, then the public names last, with no default', () => {
    assert.equal(apiBase({ INTERNAL_API_URL: 'http://int:1/', API_BASE_URL: 'http://b:2', NEXT_PUBLIC_API_URL: 'http://pub:3' }), 'http://int:1');
    assert.equal(apiBase({ API_BASE_URL: 'http://b:2', NEXT_PUBLIC_API_URL: 'http://pub:3' }), 'http://b:2');
    assert.equal(apiBase({ NEXT_PUBLIC_API_BASE_URL: 'http://pubb:4', NEXT_PUBLIC_API_URL: 'http://pub:3' }), 'http://pubb:4');
    assert.equal(apiBase({ NEXT_PUBLIC_API_URL: 'http://pub:3' }), 'http://pub:3');
    assert.equal(apiBase({}), null);
  });

  test('siteApiBase with no argument reads the process environment when the request runs', async () => {
    await withRuntimeEnv('http://runtime.example.invalid:9', async () => assert.equal(siteApiBase(), 'http://runtime.example.invalid:9'));
  });

  // every server-side file that talks to the API for a site, a theme, a directory page or a document, and the decision made for it
  const MOVED = [
    'engine/themepack/package-fetch.ts', 'lib/site-public.ts', 'lib/pricing.ts', 'app/theme-pack/[id]/[[...rest]]/page.tsx', 'app/d/[token]/route.ts',
    'app/api/demo/start/route.ts', 'app/api/demo/tour-pass/route.ts', 'app/api/demo/verify/route.ts', 'app/go/[slug]/page.tsx', 'app/ls/[slug]/page.tsx', 'app/ls/[slug]/go/[n]/route.ts', 'app/sitemap-leadspace.xml/route.ts',
  ];
  test('every moved server-side file asks siteApiBase() and no longer reads NEXT_PUBLIC_API_URL itself', () => {
    for (const f of MOVED) {
      const src = readSrc(f);
      assert.match(src, /siteApiBase\(\)/, f);
      assert.ok(!/process\.env\.NEXT_PUBLIC_API_URL/.test(src), `${f} still reads the build-time address`);
    }
  });

  test('the remaining readers of NEXT_PUBLIC_API_URL are browser code or addresses handed to the browser', () => {
    const KEEP_BROWSER = ['app/customer/page.tsx', 'app/d/[token]/pay/page.tsx', 'app/theme-preview/[id]/page.tsx', 'bos/ui.tsx', 'domainapp/shared/InvoicingView.tsx', 'lib/api.ts', 'lib/auth.ts', 'lib/commerce.ts', 'app/ls/[slug]/leadspace-client.ts'];
    for (const f of KEEP_BROWSER) assert.match(readSrc(f), /NEXT_PUBLIC_API_URL/, f);
    for (const f of ['app/site/[subdomain]/[[...rest]]/page.tsx', 'engine/themepack/site.tsx', 'app/theme-local-test/[[...slug]]/page.tsx']) assert.match(readSrc(f), /const API_BASE = process\.env\.NEXT_PUBLIC_API_URL/, f);
    // theme pictures and files are loaded by the visitor's browser, so that address stays the public one
    assert.match(readSrc('engine/themepack/site.tsx'), /const assetBase = `\$\{API_BASE\}\/themes\/assets\//);
  });
});

describe('P9.6 /starter/... pictures never 404', () => {
  test('the generic banner is a plain SVG: shapes and brand colours, no text, script, outside image, link or logo', () => {
    const f = pubFile('starter/generic/hero.svg');
    assert.ok(existsSync(f) && statSync(f).size > 200 && statSync(f).size < 20000, 'present and small');
    const svg = readFileSync(f, 'utf8');
    assert.match(svg, /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /viewBox="0 0 1600 900"/);
    assert.ok(!/<(text|tspan|image|script|foreignObject|use|a|style)\b|href=|data:|\son[a-z]+=|@import|url\(http/i.test(svg), 'no text, image, script, link or handler');
    for (const c of svg.match(/#[0-9a-fA-F]{6}/g) ?? []) assert.ok(['#1e3a8a', '#1d4ed8', '#3b82f6', '#ffffff', '#ffb420'].includes(c.toLowerCase()), `colour ${c} is not a brand colour`);
  });

  test('every industry key the backend seeds has its hero and four gallery pictures (/starter/<key>/hero.webp, g1..g4.webp)', () => {
    const KEYS = ['advocate', 'agriculture', 'automobile', 'clinic', 'coaching', 'construction', 'diagnostics', 'education', 'events', 'finance', 'freelancer', 'general', 'gym', 'home-services', 'hotel', 'logistics', 'photography', 'professional', 'realestate', 'restaurant', 'retail', 'salon', 'technology', 'travel'];
    for (const k of KEYS) for (const n of ['hero.webp', 'g1.webp', 'g2.webp', 'g3.webp', 'g4.webp']) assert.ok(existsSync(pubFile(`starter/${k}/${n}`)), `${k}/${n}`);
  });

  test('the Free page keeps a /starter/ banner and shows it as an image', () => {
    assert.equal(freeViewOf(JSON.parse(JSON.stringify(PLUMBERBOY))).banner, '/starter/generic/hero.svg');
    // P11: the kit draws the banner (the vendor's own picture); the platform's neutral placeholder is replaced by the theme's own art
    assert.match(readSrc('components/site-kit/SiteApp.tsx'), /<img className="sk-art" src=\{art\}/);
    assert.match(readSrc('components/site-kit/SiteApp.tsx'), /view\.banner \?\? heroArt\(/);
  });
});
