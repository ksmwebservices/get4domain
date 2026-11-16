// Smoke checks of the V3 public site against real built servers (run `npm run build` first).
// One server with the flag off (the live behaviour, must not change) and one with the flag on and sample data. No database, no backend, no network beyond localhost.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const next = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const OFF = 3061;
const ON = 3062;

let failures = 0;
let checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) {
    failures++;
    process.stdout.write(`FAIL  ${msg}\n`);
  }
};

function start(port, env) {
  const child = spawn(process.execPath, [next, 'start', '-p', String(port)], { cwd: root, env: { ...process.env, V3_PUBLIC_ENABLED: '', V3_PUBLIC_USE_MOCKS: '', ...env }, stdio: 'ignore' });
  return child;
}

async function waitFor(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/pricing`, { redirect: 'manual' });
      if (r.status) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server on ${port} did not start`);
}

const get = async (port, p, init = {}) => {
  const r = await fetch(`http://localhost:${port}${p}`, { redirect: 'manual', ...init });
  return { status: r.status, headers: r.headers, text: await r.text() };
};
const count = (s, re) => (s.match(re) ?? []).length;
const h1s = (html) => count(html, /<h1[\s>]/g);

function sourceFiles(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

async function flagOff() {
  for (const p of ['/directory', '/claim', '/claim/screens', '/claim/start/sri-murugan-plumbing', '/legal', '/legal/terms', '/account/login', '/account/register', '/account/forgot-password', '/account/reset-password', '/sitemaps/directory-index.xml', '/sitemaps/directory-1.xml', '/directory-go/b-1001', '/directory-pages/chennai', '/directory-robots']) {
    ok((await get(OFF, p)).status === 404, `flag off: ${p} is a 404`);
  }
  ok((await get(OFF, '/directory-api/claim/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"slug":"x"}' })).status === 404, 'flag off: the claim proxy is a 404');
  for (const p of ['/chennai', '/chennai/plumbers', '/business/sri-murugan-plumbing', '/zzz', '/pricing/nothing']) {
    ok((await get(OFF, p)).status === 404, `flag off: ${p} stays the live 404`);
  }
  ok((await get(OFF, '/chennai', { headers: { 'x-v3-public': '1' } })).status === 404, 'flag off: a visitor cannot arm the directory with the header');
  for (const p of ['/pricing', '/terms', '/privacy-policy', '/refund-policy', '/about', '/login', '/register']) {
    const r = await get(OFF, p);
    ok(r.status === 200, `flag off: live page ${p} still answers 200 (${r.status})`);
  }
  const go = await get(OFF, '/go/b-1001');
  ok(go.status === 200, `flag off: /go/{segment} still reaches the campaign page (${go.status})`);
  const robots = await get(OFF, '/robots.txt');
  ok(robots.status === 200 && !/\/go\/|directory-index|v3\/go/.test(robots.text), 'flag off: robots.txt has no directory lines');
  ok(/Sitemap: https:\/\/get4domain\.com\/sitemap\.xml/.test(robots.text), 'flag off: robots.txt keeps its existing sitemap line');
  const sm = await get(OFF, '/sitemap.xml');
  ok(sm.status === 200 && !/directory|business\//.test(sm.text), 'flag off: sitemap.xml has no directory urls');
}

function pageChecks(name, r) {
  ok(r.status === 200, `${name}: 200 (${r.status})`);
  ok(h1s(r.text) === 1, `${name}: exactly one h1 (${h1s(r.text)})`);
  ok(/<html[^>]*lang="en-IN"/.test(r.text), `${name}: html lang`);
  ok(/<header[\s>]/.test(r.text) && /<main[\s>]/.test(r.text) && /<footer[\s>]/.test(r.text), `${name}: header, main and footer landmarks`);
  ok(/<nav[^>]*aria-label="Directory navigation"/.test(r.text), `${name}: labelled navigation`);
  ok(/href="#main"/.test(r.text), `${name}: skip link`);
  ok(!/<img(?![^>]*\balt=)/.test(r.text), `${name}: every image has alt text`);
  ok(!/tel:|mailto:|wa\.me/i.test(r.text), `${name}: no tel, mailto or wa.me`);
  const inputs = [...r.text.matchAll(/<input[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  for (const id of inputs) ok(new RegExp(`<label[^>]*for="${id}"`).test(r.text), `${name}: input ${id} has a label`);
}

async function flagOn() {
  const listing = ['/directory', '/chennai', '/category/plumbers', '/chennai/plumbers', '/chennai/plumbers/page/2', '/chennai/plumbers-in-adyar', '/chennai/plumbers-in-velachery', '/chennai/electricians', '/pincode/600020/plumbers', '/state/tamil-nadu'];
  for (const p of listing) {
    const r = await get(ON, p);
    pageChecks(p, r);
    ok(/<nav[^>]*aria-label="Breadcrumb"/.test(r.text), `${p}: breadcrumbs`);
    ok(/<link rel="canonical" href="https:\/\/directory\.example\.invalid[^"]*"/.test(r.text), `${p}: canonical from the model`);
    const articles = r.text.split('<article').slice(1);
    for (const a of articles) {
      const body = a.split('</article>')[0];
      ok(count(body, /href="\/go\//g) <= 1, `${p}: a card has at most one go link`);
      ok(count(body, />Visit site</g) === count(body, /href="\/go\//g), `${p}: a card's go link is the Visit site link`);
      ok(!/href="https?:\/\//.test(body), `${p}: a card has no direct external link`);
    }
    ok(!/href="https?:\/\/(api|sites)\.example\.invalid/.test(r.text), `${p}: no link to the API host or a business site`);
    for (const m of r.text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
      let parsed = null;
      try { parsed = JSON.parse(m[1]); } catch { parsed = null; }
      ok(parsed !== null, `${p}: a JSON-LD script parses`);
    }
  }
  const robotsOf = (t) => (t.match(/name="robots" content="([^"]*)"/) ?? [])[1];
  ok(robotsOf((await get(ON, '/chennai/plumbers')).text) === 'index, follow, max-image-preview:large', 'indexable model renders index');
  ok(robotsOf((await get(ON, '/chennai/plumbers-in-velachery')).text) === 'noindex, follow', 'thin page stays noindex as the model says');
  ok(robotsOf((await get(ON, '/directory')).text) === 'noindex, follow', 'home stays noindex as the model says');

  const p1 = (await get(ON, '/chennai/plumbers')).text;
  const p2 = (await get(ON, '/chennai/plumbers/page/2')).text;
  ok(/<link rel="next" href="https:\/\/directory\.example\.invalid\/chennai\/plumbers\/page\/2"/.test(p1), 'page 1 has rel next');
  ok(!/<link rel="prev"/.test(p1), 'page 1 has no rel prev');
  ok(/<link rel="prev" href="https:\/\/directory\.example\.invalid\/chennai\/plumbers"/.test(p2), 'page 2 has rel prev');
  ok(/<nav[^>]*aria-label="Pagination"/.test(p1) && /href="\/chennai\/plumbers\/page\/2"/.test(p1), 'page 1 links to page 2');
  ok(/rel="prev"[^>]*href="\/chennai\/plumbers"|href="\/chennai\/plumbers"[^>]*rel="prev"/.test(p2), 'page 2 has a previous link in the pagination');
  ok(/aria-current="page"/.test(p1), 'the current page is marked');

  const unclaimed = await get(ON, '/business/sri-murugan-plumbing');
  pageChecks('business unclaimed', unclaimed);
  ok(count(unclaimed.text, /href="\/go\//g) === 1, 'business: one Visit site link');
  ok(/href="\/claim\?business=sri-murugan-plumbing"/.test(unclaimed.text), 'unclaimed business has the claim link');
  ok(/has not claimed it yet/.test(unclaimed.text), 'unclaimed business says so');
  ok(robotsOf(unclaimed.text) === 'noindex, follow', 'unclaimed business is noindex as the model says');
  const claimed = await get(ON, '/business/anand-electricals');
  ok(!/href="\/claim\?business=/.test(claimed.text), 'claimed business has no claim link');
  ok(/claimed by the business owner/.test(claimed.text), 'claimed business says so');
  ok(/More from the directory/.test(claimed.text), 'backlink block shows when the API has one');
  for (const p of ['/business/nope', '/zzz', '/chennai/plumbers/page/9', '/chennai/plumbers/page/1', '/nowhere/at-all', '/pincode/600020/nothing']) {
    const r = await get(ON, p);
    ok(r.status === 404, `flag on: ${p} is a real HTTP 404 (${r.status})`);
    ok((r.headers.get('x-robots-tag') ?? '').includes('noindex') && /name="robots" content="noindex/.test(r.text), `flag on: ${p} is noindex in the header and the page`);
    ok(h1s(r.text) === 1 && !/Workspace|SoftwareApplication/.test(r.text), `flag on: ${p} has one h1 and no site-wide JSON-LD`);
  }
  const gone = await get(ON, '/business/removed-shop');
  ok(gone.status === 410 && /no longer listed/.test(gone.text) && (gone.headers.get('x-robots-tag') ?? '').includes('noindex'), `flag on: a removed business is a real 410 (${gone.status})`);
  ok((await get(ON, '/zzz', { method: 'HEAD' })).status === 404, 'flag on: HEAD of an unknown address is 404');
  ok((await get(ON, '/demo/zzz')).status === (await get(OFF, '/demo/zzz')).status, 'flag on: an unknown /demo address behaves as with the flag off');
  ok((await get(ON, '/pricing/nothing')).status === (await get(OFF, '/pricing/nothing')).status, 'flag on: an unknown address under a live route behaves as with the flag off');

  const go = await get(ON, '/go/b-1001?src=city');
  ok(go.status === 302 && /sites\.example\.invalid/.test(go.headers.get('location') ?? ''), `click-out redirects (${go.status})`);
  ok((go.headers.get('cache-control') ?? '').includes('no-store') && (go.headers.get('x-robots-tag') ?? '').includes('noindex'), 'click-out is no-store and noindex');
  ok((await get(ON, '/go/no-such-id')).status === 200, 'a campaign slug still reaches the campaign page');
  ok((await get(ON, '/go/b-9999')).status === 404, 'an unknown business id is a uniform 404');
  ok((await get(ON, '/directory-go/b-1001')).status === 302, 'click-out handler answers');

  const beacon = await get(ON, '/directory-api/page-visit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"path":"/chennai","utm_source":"x"}' });
  ok(beacon.status === 200 && /"ok":true/.test(beacon.text), 'beacon answers ok');

  const find = await get(ON, '/claim?name=murugan');
  pageChecks('claim find', find);
  ok(/Choose this business/.test(find.text), 'claim search lists a business that can be chosen');
  ok(/No listing matches/.test((await get(ON, '/claim?name=zzzzzz')).text), 'claim search says when nothing matches');
  ok(/Start the claim/.test((await get(ON, '/claim/start/sri-murugan-plumbing')).text), 'unclaimed listing can start a claim');
  ok(/already claimed/i.test((await get(ON, '/claim/start/blue-tap-services')).text) && !/Start the claim/.test((await get(ON, '/claim/start/blue-tap-services')).text), 'claimed listing cannot start a claim');
  ok(/being prepared/.test((await get(ON, '/claim/start/kavitha-home-care')).text), 'draft listing has its screen');
  ok(/This listing is live/.test((await get(ON, '/claim/start/anand-electricals')).text), 'live listing has its screen');
  const link = await get(ON, '/claim/mock-claim-token-00000000');
  ok(/Get your one-time code/.test(link.text) && /no-referrer/.test(link.text) && /noindex/.test(link.text), 'claim link shows the first step, no referrer, noindex');
  ok(/This link is not valid/.test((await get(ON, '/claim/not-a-real-token-xxxxxxxx')).text), 'a bad claim link says so');
  const screens = (await get(ON, '/claim/screens')).text;
  for (const t of ['This listing is not claimed', 'This listing is being prepared', 'This listing is already claimed', 'This listing is live', 'This link is not valid', 'Email is switched off', 'Waiting for approval', 'Your site is live']) ok(screens.includes(t), `claim screen: ${t}`);
  ok(/Your site is live/.test((await get(ON, '/claim/live')).text), 'go-live notice page');
  const liveSafe = (await get(ON, '/claim/live?redirectTo=%2Fpricing')).text;
  ok(/href="\/pricing"/.test(liveSafe), 'go-live page offers a safe relative redirectTo');
  for (const bad of ['javascript%3Aalert(1)', '%2F%2Fevil.example.invalid', 'http%3A%2F%2Fevil.example.invalid', 'data%3Atext%2Fhtml%2Cx']) {
    const t = (await get(ON, `/claim/live?redirectTo=${bad}`)).text;
    ok(!/href="(javascript:|\/\/evil|http:\/\/evil|data:)/i.test(t) && !/target[^,]{0,6}(evil|javascript|data:)/i.test(t), `go-live page drops redirectTo=${decodeURIComponent(bad)}`);
  }

  for (const p of ['/account/login', '/account/register', '/account/forgot-password', '/account/reset-password?token=mock-reset-token-000000000']) pageChecks(p, await get(ON, p));
  const reset = await get(ON, '/account/reset-password?token=mock-reset-token-000000000');
  ok(/Choose a new password/.test(reset.text) && /Save the new password/.test(reset.text) && /no-referrer/.test(reset.text) && /noindex/.test(reset.text), 'reset page shows the form, no referrer, noindex');
  ok(/This reset link is not valid/.test((await get(ON, '/account/reset-password')).text), 'reset page without a token says the link is not valid');
  const resetApi = await fetch(`http://localhost:${ON}/directory-api/auth/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'mock-reset-token-000000000', newPassword: 'Newpass123' }) });
  ok((await resetApi.json()).ok === true, 'reset confirm answers ok in sample mode');
  ok(/This reset link is not valid/.test((await get(ON, '/account/reset-password?token=short-token')).text), 'reset page with a token under 20 characters says the link is not valid');
  const shortApi = await (await fetch(`http://localhost:${ON}/directory-api/auth/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'short-token', newPassword: 'Newpass123' }) })).json();
  ok(shortApi.ok === false && shortApi.code === 'GRANT_INVALID', 'reset confirm with a short token answers link-not-valid');
  const oldNameApi = await (await fetch(`http://localhost:${ON}/directory-api/auth/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'mock-reset-token-000000000', password: 'Newpass123' }) })).json();
  ok(oldNameApi.ok === false, 'reset confirm rejects the old field name "password"');
  const post = async (route, payload) => (await fetch(`http://localhost:${ON}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })).json();
  const loginOk = await post('/directory-api/auth/login', { email: 'owner@example.invalid', password: 'Password1' });
  ok(loginOk.ok === true && loginOk.data?.handoff === 'mock-handoff-code-0000', 'sign-in in sample mode answers with a handoff code');
  const loginNoHandoff = await post('/directory-api/auth/login', { email: 'nohandoff@example.invalid', password: 'Password1' });
  ok(loginNoHandoff.ok === true && loginNoHandoff.data?.handoff === null, 'sign-in without a handoff route answers ok with no code');
  const setupOk = await post('/directory-api/claim/setup', { setupToken: 'mock-setup-token-0000000000', password: 'long-enough-1', acceptTerms: true });
  ok(setupOk.ok === true && setupOk.data?.handoff === 'mock-handoff-code-0000', 'claim setup in sample mode answers with a handoff code');
  const mailOffApi = await fetch(`http://localhost:${ON}/directory-api/auth/forgot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'mailoff@example.invalid' }) });
  ok((await mailOffApi.json()).code === 'MAIL_DISABLED', 'reset request in sample mode can answer email switched off');

  for (const p of ['/legal/terms', '/legal/privacy', '/legal/refund-and-cancellation', '/legal/wallet-terms', '/legal/directory-listing-terms', '/legal']) {
    const r = await get(ON, p);
    pageChecks(p, r);
    ok(/Draft for review/.test(r.text), `${p}: draft banner`);
    ok(robotsOf(r.text) === 'noindex, nofollow', `${p}: noindex while a draft`);
    ok(!/GSTIN/.test(r.text) || p === '/legal', `${p}: no GSTIN line while pending`);
    if (p !== '/legal') ok(/KSM QUANTUM TECHNOLOGIES/.test(r.text) && /Tidel Park, Chennai/.test(r.text), `${p}: firm identity`);
  }

  const idx = await get(ON, '/sitemaps/directory-index.xml');
  ok(idx.status === 200 && /xml/.test(idx.headers.get('content-type') ?? '') && /<sitemapindex/.test(idx.text), 'sitemap index');
  ok((await get(ON, '/sitemaps/directory-1.xml')).status === 200, 'sitemap chunk');
  ok((await get(ON, '/sitemaps/directory-9.xml')).status === 404 && (await get(ON, '/sitemaps/evil.xml')).status === 404, 'a chunk past the last and a bad name are 404');
  const robots = await get(ON, '/robots.txt');
  ok(/Disallow: \/go\//.test(robots.text) && /Sitemap: https:\/\/get4domain\.com\/sitemap\.xml/.test(robots.text), 'flag on: robots.txt keeps its lines and gains the directory lines');
  ok(/User-Agent: GPTBot/.test(robots.text) && /Disallow: \/dashboard\//.test(robots.text), 'flag on: existing rules are kept');
  ok((await get(ON, '/directory-pages/chennai')).status === 404 && (await get(ON, '/directory-robots')).status === 404, 'rewrite targets cannot be typed');

  for (const p of ['/pricing', '/terms', '/about']) ok((await get(ON, p)).status === 200, `flag on: live page ${p} untouched`);

  // Site-wide JSON-LD (Organization, SoftwareApplication, WebSite): left out of V3 public routes, kept everywhere else.
  const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => m[1]);
  const hasRoot = (items) => items.some((s) => /"@type":"SoftwareApplication"/.test(s)) && items.some((s) => /"@type":"WebSite"/.test(s)) && items.some((s) => /"legalName"/.test(s));
  const SITEWIDE = /Workspace|BOS|SoftwareApplication|"Organization"|"WebSite"/;
  for (const p of ['/directory', '/chennai/plumbers', '/business/anand-electricals', '/claim', '/claim/screens', '/claim/mock-claim-token-00000000', '/account/login', '/legal/terms', '/legal']) {
    const items = ld((await get(ON, p)).text);
    ok(items.every((s) => !SITEWIDE.test(s)), `flag on: ${p} has none of the site-wide JSON-LD`);
    if (['/claim', '/claim/screens', '/claim/mock-claim-token-00000000', '/account/login', '/legal/terms', '/legal'].includes(p)) ok(items.length === 0, `flag on: ${p} has no JSON-LD at all (${items.length})`);
    else ok(items.length >= 1 && items.every((s) => /BreadcrumbList|LocalBusiness|CollectionPage/.test(s)), `flag on: ${p} has only the page model JSON-LD (${items.length})`);
  }
  for (const p of ['/pricing', '/terms']) {
    ok(hasRoot(ld((await get(ON, p)).text)), `flag on: live page ${p} keeps its site-wide JSON-LD`);
    ok(hasRoot(ld((await get(OFF, p)).text)), `flag off: live page ${p} keeps its site-wide JSON-LD`);
    ok(ld((await get(ON, p)).text).join('') === ld((await get(OFF, p)).text).join(''), `${p}: the JSON-LD is identical with the flag on and off`);
  }
  ok(hasRoot(ld((await get(OFF, '/')).text)), 'flag off: the home page keeps its site-wide JSON-LD');
}

function noConsole() {
  const dirs = [path.join(root, 'src', 'lib', 'v3-public'), path.join(root, 'src', 'components', 'directory'), path.join(root, 'src', 'app', '(directory)')];
  for (const d of dirs) {
    for (const f of sourceFiles(d)) {
      if (f.includes('__tests__')) continue;
      ok(!/\bconsole\.(log|error|warn|info|debug)\b/.test(readFileSync(f, 'utf8')), `no console output in ${path.relative(root, f)}`);
    }
  }
}

const servers = [start(OFF, {}), start(ON, { V3_PUBLIC_ENABLED: 'true', V3_PUBLIC_SITE_ORIGIN: 'https://www.staging.example.invalid', NEXT_PUBLIC_VENDOR_APP_URL: 'https://vendor.example.invalid' })];
try {
  await Promise.all([waitFor(OFF), waitFor(ON)]);
  await flagOff();
  await flagOn();
  noConsole();
} finally {
  for (const s of servers) s.kill();
}
process.stdout.write(`${checks - failures} of ${checks} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
