#!/usr/bin/env node
'use strict';
/**
 * Website Manager Phase 0 reproduction, on TEST data only (an in-memory PGlite database, never a real one).
 * Boots the real API on 3090, starts the real Next.js server (a production build made with NEXT_PUBLIC_API_URL=http://127.0.0.1:3090) on 3022,
 * creates one test vendor per rendering path, changes ONE Website Manager field at a time, saves it through the real API, fetches the public page HTML
 * and records whether the change appears.   Needs `npx nest build` in backend-api and a local frontend build.
 *   node scripts/website-manager/repro-public-html.js [--out ../evidence/website-manager/REPRO.md]
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { startHarness, available } = require('../e2e/bos-harness');

const FRONT = 'http://127.0.0.1:3022';
const outArg = process.argv.indexOf('--out');
const OUT = outArg > -1 ? process.argv[outArg + 1] : null;

// one vendor per public rendering path of the shared frontend
const VENDORS = [
  { key: 'wmtravel', industry: 'travel', label: 'travel (engine kit)' },
  { key: 'wmclinic', industry: 'clinic', label: 'clinic (engine kit)' },
  { key: 'wmretail', industry: 'retail', label: 'retail (hand-built RetailSite)' },
  { key: 'wmrealestate', industry: 'realestate', label: 'real estate (hand-built)' },
  { key: 'wmgeneral', industry: 'general', label: 'general (generic fallback renderer)' },
];

const FIELDS = [
  ['businessName', 'Business name', (m) => `Biz ${m} Name`],
  ['tagline', 'Tagline', (m) => `Tagline ${m} here`],
  ['about', 'About text', (m) => `About text ${m} for the page`],
  ['logo', 'Logo', (m) => `https://img.example.test/logo-${m}.png`],
  ['banner', 'Banner', (m) => `https://img.example.test/banner-${m}.png`],
  ['seoTitle', 'SEO title', (m) => `Seo Title ${m}`],
  ['seoDesc', 'SEO description', (m) => `Seo description ${m} text`],
  ['phone', 'Phone', () => '9876500011'],
  ['whatsapp', 'WhatsApp', () => '9876500022'],
  ['email', 'E-mail', (m) => `hello-${m}@example.test`.toLowerCase()],
  ['address', 'Address', (m) => `12 Marker Street ${m} Chennai`],
  ['businessHours', 'Opening hours', (m) => `Mon-Sat ${m} 9am-6pm`],
  ['instagram', 'Instagram', (m) => `https://instagram.com/acct${m}`],
  ['facebook', 'Facebook', (m) => `https://facebook.com/page${m}`],
  ['googleMaps', 'Google Maps', (m) => `https://maps.example.test/place-${m}`],
  ['favicon', 'Favicon', (m) => `https://img.example.test/fav-${m}.png`],
  ['portfolio', 'Portfolio image', (m) => [{ id: `p${m}`, src: `https://img.example.test/portfolio-${m}.png`, title: `Work ${m}`, category: 'x' }]],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function html(sub) {
  const r = await fetch(`${FRONT}/site/${sub}`, { headers: { 'cache-control': 'no-cache' } });
  return { status: r.status, text: await r.text() };
}
const decoded = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed'); process.exit(0); }
  const h = await startHarness({ port: 3090, pgPort: 54350 });
  let front;
  const lines = [];
  try {
    front = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'start', '-p', '3022'], { cwd: path.join(__dirname, '..', '..', '..', 'get4domain_mvp'), shell: true, stdio: 'ignore', env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3090', INTERNAL_API_URL: 'http://127.0.0.1:3090' } });
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`${FRONT}/`); if (r.status < 500) break; } catch { /* starting */ } await sleep(1500); }
    const vendors = [];
    for (const v of VENDORS) vendors.push({ ...v, ...(await h.createVendor({ key: v.key, industry: v.industry, plan: 'WORKSPACE' })) });
    // a few products so the renderers show their catalogue path rather than the empty state
    for (const v of vendors) await h.prisma.vendorProduct.create({ data: { vendorId: v.id, name: `Item of ${v.key}`, price: '500', description: 'A product', image: `https://img.example.test/item-${v.key}.png`, active: true } });

    const results = {}; // vendorKey -> field -> yes/no
    for (const v of vendors) {
      results[v.key] = {};
      const first = await html(v.subdomain);
      if (first.status !== 200) { for (const [f] of FIELDS) results[v.key][f] = `HTTP ${first.status}`; continue; }
      for (const [field, , make] of FIELDS) {
        const m = `ZQ${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const value = make(m);
        const put = await h.call('PUT', `/cms/vendor/${v.id}`, { [field]: value }, v.token);
        if (put.status >= 300) { results[v.key][field] = `save refused (${put.status})`; continue; }
        const page = await html(v.subdomain);
        const hay = decoded(page.text);
        const token = field === 'phone' ? '9876500011' : field === 'whatsapp' ? '9876500022' : m;
        results[v.key][field] = hay.includes(token) ? 'yes' : 'NO';
        // reset so the next field is tested alone against the same baseline
        await h.call('PUT', `/cms/vendor/${v.id}`, { [field]: field === 'portfolio' ? [] : '' }, v.token);
      }
    }

    lines.push('| Field the vendor saves | ' + vendors.map((v) => v.label).join(' | ') + ' |');
    lines.push('|---|' + vendors.map(() => '---|').join(''));
    for (const [field, label] of FIELDS) lines.push(`| ${label} (\`${field}\`) | ` + vendors.map((v) => results[v.key][field]).join(' | ') + ' |');
    const text = lines.join('\n');
    console.log(text);
    if (OUT) fs.writeFileSync(OUT, `# Phase 0 reproduction on test data\n\nGenerated ${new Date().toISOString()} by scripts/website-manager/repro-public-html.js. A field is saved with a unique marker through PUT /cms/vendor/:id, then the public page HTML (\`/site/<subdomain>\`, the same renderer every custom domain and subdomain uses) is fetched. "yes" = the marker is in the HTML.\n\n${text}\n`);
  } finally {
    if (front) { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', String(front.pid), '/T', '/F']) : front.kill(); } catch { /* ignore */ } }
    await h.stop();
    setTimeout(() => process.exit(0), 500);
  }
})().catch((e) => { console.error(e); process.exit(1); });
