// Real-API probe for the V3 public site (dispatch C1, P3). Read-only: GET requests only, no login, no secret, nothing is created.
// Run it once the owner has the API running locally:
//   node --no-warnings --import ./scripts/v3-public/register.mjs scripts/real-probe.mjs http://localhost:3008
// The base URL is the first argument, or the environment variable named by --env NAME, or PROBE_API_BASE_URL, or API_BASE_URL.
// (The loader flag lets this script call the site's own TypeScript parsers; no new dependency.) API not reachable: one line, exit 0.
import { fromPricing } from '../src/lib/v3-public/plans.ts';
import { subdomainStateOf } from '../src/lib/v3-public/register.ts';

const args = process.argv.slice(2);
const envIdx = args.indexOf('--env');
const envName = envIdx >= 0 ? args[envIdx + 1] : null;
const arg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--env');
const base = String(arg || (envName && process.env[envName]) || process.env.PROBE_API_BASE_URL || process.env.API_BASE_URL || '').trim().replace(/\/+$/, '');
if (!base) { console.log('real-probe: no API address given (pass a base URL, e.g. http://localhost:3008). Nothing checked.'); process.exit(0); }

const rows = [];
const unwrap = (j) => (j && typeof j === 'object' && 'data' in j && j.data !== undefined ? j.data : j);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

async function get(route, accept = 'application/json') {
  const res = await fetch(`${base}${route}`, { headers: { accept }, signal: AbortSignal.timeout(8000), redirect: 'manual' });
  const body = await res.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* text answer */ }
  return { status: res.status, body, json, type: res.headers.get('content-type') ?? '' };
}
const add = (name, route, ok, note) => rows.push({ check: name, route, result: ok ? 'OK' : 'DIFF', note });

async function run() {
  try { await get('/v3/public/pricing'); } catch (e) {
    console.log(`real-probe: API not reachable at ${base} (${e?.cause?.code ?? e?.name ?? 'no answer'}). Start it and run again. Nothing checked.`);
    return;
  }
  // pricing
  {
    const r = await get('/v3/public/pricing');
    const d = unwrap(r.json);
    let ok = r.status === 200 && isObj(d) && d.pricesExcludeGst === true && Array.isArray(d.plans) && isObj(d.free);
    let note = `status ${r.status}`;
    if (ok) {
      try {
        const p = fromPricing(d);
        const pendingOk = d.plans.every((pl) => (pl.terms ?? []).every((t) => (t.state === 'AVAILABLE' ? t.price && Number.isFinite(t.price.priceMinor) : t.state === 'PRICE_PENDING' && t.price == null)));
        ok = ok && p.plans.length > 0 && pendingOk;
        note = `${p.plans.length} plans, ${p.addons?.length ?? 0} add-ons, gst ${p.tax ? p.tax.ratePercent + '%' : 'not set'}${pendingOk ? '' : ', a term breaks the AVAILABLE/PRICE_PENDING rule'}`;
      } catch { ok = false; note = 'the site normaliser threw'; }
    }
    add('pricing', '/v3/public/pricing', ok, note);
  }
  // address check: a free-looking name, a reserved name, a bad shape
  for (const [name, want] of [['probe-address-check', ['available', 'taken']], ['admin', ['reserved']], ['-bad-', ['invalid']]]) {
    const r = await get(`/v3/public/subdomain-availability?name=${encodeURIComponent(name)}`);
    const state = subdomainStateOf(r.status, r.json);
    add(`address "${name}"`, '/v3/public/subdomain-availability', want.includes(state), `status ${r.status}, site reads "${state}"`);
  }
  // referral: an unknown code is { valid:false } and nothing else
  {
    const r = await get('/v3/public/referral/PROBE-NO-SUCH-CODE');
    const d = unwrap(r.json);
    const ok = (r.status === 200 && isObj(d) && d.valid === false && Object.keys(d).length === 1) || r.status === 404;
    add('referral (unknown code)', '/v3/public/referral/:code', ok, `status ${r.status}${isObj(d) ? ', keys ' + Object.keys(d).join(',') : ''}`);
  }
  // directory page model and its raw files
  {
    const r = await get('/v3/directory/pages/resolve?path=%2F');
    const m = unwrap(r.json);
    const ok = r.status === 200 && isObj(m) && isObj(m.meta) && typeof m.meta.canonical === 'string' && typeof m.meta.robots === 'string' && Array.isArray(m.jsonLd) && Array.isArray(m.breadcrumbs);
    const prefix = ok && /^https?:\/\/[^/]+\/directory(\/|$)/.test(m.meta.canonical);
    add('directory home model', '/v3/directory/pages/resolve', ok, ok ? `canonical ${m.meta.canonical}${prefix ? ' (still carries /directory: DIRECTORY_PUBLIC_BASE_URL not set on the API?)' : ''}` : `status ${r.status}`);
  }
  for (const [name, route, accept, test] of [
    ['directory sitemap index', '/v3/directory/sitemaps/index.xml', 'application/xml', (r) => r.status === 200 && /<(sitemapindex|urlset)/.test(r.body)],
    ['directory robots', '/v3/directory/robots.txt', 'text/plain', (r) => r.status === 200 && /user-agent/i.test(r.body)],
    ['directory llms.txt', '/v3/directory/llms.txt', 'text/plain', (r) => r.status === 200 || r.status === 404],
    ['vendor site, unknown host', '/v3/public/site/by-host?host=probe-no-such-host.invalid&path=%2F&lang=', '*/*', (r) => r.status === 404],
  ]) {
    const r = await get(route, accept);
    add(name, route.split('?')[0], test(r), `status ${r.status}, ${r.type.split(';')[0] || 'no type'}`);
  }
  const w = Math.max(...rows.map((x) => x.check.length));
  for (const x of rows) console.log(`${x.result.padEnd(4)} ${x.check.padEnd(w)}  ${x.route}  ${x.note}`);
  const bad = rows.filter((x) => x.result !== 'OK').length;
  console.log(`real-probe: ${rows.length - bad} of ${rows.length} agree with the site's own parsers${bad ? `; ${bad} differ (listed above)` : ''}.`);
}
run().catch((e) => { console.log(`real-probe: stopped (${e?.message ?? e}). Nothing more checked.`); }).finally(() => { process.exitCode = 0; });
