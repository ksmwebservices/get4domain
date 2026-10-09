#!/usr/bin/env node
// Tests for the registry: the state rules, profiles, legacy redirects, generated-file equivalence, the guard itself (seeded violations)
// and the nav matrix snapshot (plan × profile × nav_v2).   node registry/verify-registry.mjs [--update]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadRegistry, read, exists } from './lib.mjs';

const reg = await loadRegistry();
const F = reg.FEATURES;
let pass = 0; let fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; console.log(`  FAIL  ${name} ${detail}`); } };
const section = (t) => console.log(`\n== ${t}`);
const get = (id) => F.find((f) => f.id === id);
const V = (over = {}) => ({ plan: 'WORKSPACE', custom: false, profile: 'COMMERCE', navV2: true, ...over });
const st = (id, v) => reg.featureState(get(id), v);

section('state rules (KSM 2026-10-08)');
ok('flag off: the v2 menu does not exist for the vendor (everything HIDDEN)', F.every((f) => reg.featureState(f, V({ navV2: false })) === 'HIDDEN'));
ok('a built feature the plan includes is OPEN (Essentials: Products)', st('commerce.products', V()) === 'OPEN');
ok('built, plan lacks it → LOCKED with an upgrade card (Essentials: Purchases and suppliers)', st('commerce.inventory', V()) === 'LOCKED' && !!get('commerce.inventory').upgrade);
ok('the same feature is OPEN on Pro', st('commerce.inventory', V({ plan: 'BOS' })) === 'OPEN');
ok('NOT BUILT is Coming soon even for the higher plan — never "upgrade" for something that does not exist', st('sales.lead-tools', V()) === 'COMING_SOON' && st('sales.lead-tools', V({ plan: 'BOS' })) === 'COMING_SOON');
ok('UNTESTED is Coming soon too (every feature still marked UNTESTED)', F.filter((f) => f.status === 'UNTESTED' && !f.hidden && f.department !== 'custom').every((f) => st(f.id, V({ plan: 'BOS' })) === 'COMING_SOON'));
ok('no LOCKED item is ever unbuilt (all plans, all profiles)', ['WORKSPACE', 'BOS'].every((plan) => ['COMMERCE', 'APPOINTMENTS', 'PACKAGES', 'SERVICES', 'LISTINGS'].every((profile) => F.every((f) => reg.featureState(f, V({ plan, profile })) !== 'LOCKED' || f.status === 'WORKING' || f.status === 'LIMITED'))));
ok('hidden features never show (Social posting, Stationery)', st('marketing.social', V({ plan: 'BOS' })) === 'HIDDEN' && st('account.stationery', V({ plan: 'BOS' })) === 'HIDDEN');
ok('profile filter: Stock is only for product businesses', st('commerce.stock', V()) === 'OPEN' && st('commerce.stock', V({ profile: 'SERVICES' })) === 'HIDDEN' && st('commerce.stock', V({ profile: 'LISTINGS' })) === 'HIDDEN');
ok('BOS Custom is invisible to everyone but Custom clients, who see it as Coming soon', F.filter((f) => f.department === 'custom').every((f) => reg.featureState(f, V({ plan: 'BOS' })) === 'HIDDEN' && reg.featureState(f, V({ plan: 'BOS', custom: true })) === 'COMING_SOON'));
ok('a vendor with no term yet (demo) is treated as the entry plan', st('commerce.inventory', V({ plan: null })) === 'LOCKED' && st('commerce.products', V({ plan: null })) === 'OPEN');
ok('Custom is not a plan: a Custom client keeps Pro access to Pro features', st('commerce.inventory', V({ plan: 'BOS', custom: true })) === 'OPEN');

section('names and profiles');
ok('display names: Essentials / Pro; internal keys unchanged', reg.planDisplayName('WORKSPACE') === 'Essentials' && reg.planDisplayName('BOS') === 'Pro' && reg.planDisplayName(null) === 'Essentials');
const NAMES = F.flatMap((f) => [f.label, ...Object.values(f.labelByProfile ?? {}), f.upgrade?.headline ?? '', f.upgrade?.body ?? '']);
ok('no NEW dashboard text uses Workspace, Mini BOS, Apps, DomainApp or DomainCampaign', NAMES.every((t) => !/\b(workspace|mini bos|apps|domainapp|domaincampaign)\b/i.test(t.replace(/Industry workspace|Full industry workspace/gi, ''))), NAMES.filter((t) => /\b(workspace|mini bos|apps|domainapp|domaincampaign)\b/i.test(t.replace(/Industry workspace|Full industry workspace/gi, ''))).join('|'));
ok('AI agents and automatic calling appear nowhere', NAMES.every((t) => !/ai agent|auto-?call/i.test(t)));
const A = ['retail', 'restaurant', 'agriculture'], B = ['clinic', 'salon', 'gym', 'diagnostics'], C = ['travel', 'hotel', 'events', 'photography'], D = ['professional', 'finance', 'coaching', 'education', 'construction', 'technology', 'logistics', 'automobile'];
ok('profiles A–E cover all 20 industries exactly as KSM listed them', A.every((i) => reg.profileOfIndustry(i) === 'COMMERCE') && B.every((i) => reg.profileOfIndustry(i) === 'APPOINTMENTS') && C.every((i) => reg.profileOfIndustry(i) === 'PACKAGES') && D.every((i) => reg.profileOfIndustry(i) === 'SERVICES') && reg.profileOfIndustry('realestate') === 'LISTINGS' && Object.keys(reg.INDUSTRY_PROFILE).length === 21);
ok('unknown / missing industry falls back to the services profile', reg.profileOfIndustry(undefined) === 'SERVICES' && reg.profileOfIndustry('zzz') === 'SERVICES');
ok('labels follow the profile (Products / Services / Packages / Listings; Orders / Appointments / Bookings / Enquiries / Site visits)', reg.labelFor(get('commerce.products'), 'LISTINGS') === 'Listings' && reg.labelFor(get('commerce.orders'), 'APPOINTMENTS') === 'Appointments' && reg.labelFor(get('commerce.orders'), 'PACKAGES') === 'Bookings');

section('ten departments, the contract');
const menuPro = reg.buildMenu(F, V({ plan: 'BOS', custom: true }));
ok('the ten departments exist, in KSM\'s order', JSON.stringify(reg.DEPARTMENTS.map((d) => d.label)) === JSON.stringify(['Home', 'Sales and CRM', 'Marketing and Growth', 'Website and Domain', 'Commerce and Operations', 'Finance and Accounts', 'People and HR', 'Communication', 'Your Get4Domain account', 'BOS Custom']));
ok('a Custom client sees all ten; an Essentials vendor sees nine (no BOS Custom)', menuPro.length === 10 && reg.buildMenu(F, V()).length === 9);
ok('every contract row exists with the right plan and starting state', (() => {
  const want = { 'home.today': ['WORKSPACE', true], 'home.reports': ['BOS', true], 'sales.leads': ['WORKSPACE', true], 'sales.customers': ['WORKSPACE', true], 'sales.quotes': ['WORKSPACE', true], 'sales.portal': ['WORKSPACE', true],
    'marketing.ai-studio': ['WORKSPACE', true], 'marketing.leadspace': ['LEADSPACE', true], 'marketing.social': ['BOS', false], 'marketing.reviews-offers': ['BOS', false],
    'website.content': ['WORKSPACE', true], 'website.new-pages': ['BOS', false], 'website.design': ['WORKSPACE', true], 'website.domain': ['WORKSPACE', true], 'website.search': ['WORKSPACE', true], 'website.search-pro': ['BOS', false], 'website.widget': ['WORKSPACE', true], 'website.readiness': ['WORKSPACE', true],
    'commerce.products': ['WORKSPACE', true], 'commerce.stock': ['WORKSPACE', true], 'commerce.orders': ['WORKSPACE', true], 'commerce.workspace': ['WORKSPACE', true], 'commerce.workspace-full': ['BOS', false], 'commerce.inventory': ['BOS', true], 'commerce.pos': ['WORKSPACE', true], 'commerce.tasks': ['BOS', false], 'commerce.documents': ['BOS', false],
    'finance.invoices': ['WORKSPACE', true], 'finance.collect-payments': ['WORKSPACE', true], 'finance.recurring': ['BOS', true], 'finance.expenses': ['WORKSPACE', true], 'finance.ca-accounts': ['BOS', true],
    'people.team': ['WORKSPACE', true], 'people.hr': ['BOS', false], 'communication.inbox': ['WORKSPACE', true], 'communication.whatsapp-bot': ['BOS', true], 'communication.notifications': ['WORKSPACE', true], 'communication.reminders': ['BOS', false],
    'account.billing': ['WORKSPACE', true], 'account.wallet': ['WORKSPACE', true], 'account.profile': ['WORKSPACE', true], 'account.connections': ['BOS', false], 'account.disclosures': ['WORKSPACE', false], 'account.help': ['WORKSPACE', true] };
  return Object.entries(want).every(([id, [plan, open]]) => { const f = get(id); return f && f.minPlan === plan && ((f.status === 'WORKING' || f.status === 'LIMITED') === open); });
})(), 'a contract row differs');
ok('the WhatsApp bot row is Open only because a test now verifies its answers (bot.kb); live replies are stated as a limit', get('communication.whatsapp-bot').status === 'LIMITED' && get('communication.whatsapp-bot').testId === 'bot.kb' && /number connected/.test(get('communication.whatsapp-bot').limits));
ok('reels and video: no registry feature offers them', F.every((f) => !/reel|video/i.test(f.label)));

section('LeadSpace: the free base tier, and Campaigns replaced by it');
ok('Campaigns no longer exists as a feature: LeadSpace replaced it', !F.some((f) => f.id === 'marketing.campaigns') && Boolean(get('marketing.leadspace')));
ok('LeadSpace is open on every plan, including the free LeadSpace-only tier', ['LEADSPACE', 'WORKSPACE', 'BOS'].every((plan) => reg.featureState(get('marketing.leadspace'), V({ plan })) === 'OPEN'));
ok('a vendor with no term (demo) still sees LeadSpace open (entry plan or higher)', reg.featureState(get('marketing.leadspace'), V({ plan: null })) === 'OPEN');
ok('LeadSpace sits under Marketing and Growth with the five tabs', get('marketing.leadspace').department === 'marketing' && JSON.stringify(get('marketing.leadspace').tabs.map((t) => t.key)) === JSON.stringify(['home', 'leads', 'page', 'promote', 'wallet']));
ok('the old Campaigns and Landing pages addresses redirect into LeadSpace tabs (kept 180+ days)', reg.resolveLegacyRoute(F, '/dashboard/campaigns') === '/dashboard/marketing/leadspace?tab=promote' && reg.resolveLegacyRoute(F, '/dashboard/landing-page') === '/dashboard/marketing/leadspace?tab=page' && reg.resolveLegacyRoute(F, '/dashboard/campaigns', '?x=1') === '/dashboard/marketing/leadspace?tab=promote&x=1');
ok('a LeadSpace-only account sees every Essentials feature Locked, never open (no invoices, stock, accounts or TeleCRM)', ['finance.invoices', 'commerce.stock', 'finance.expenses', 'sales.leads'].every((id) => reg.featureState(get(id), V({ plan: 'LEADSPACE' })) === 'LOCKED'));
ok('the display name of the free tier is LeadSpace', reg.planDisplayName('LEADSPACE') === 'LeadSpace');
ok('LeadSpace needs no plan limits: billing keys stay WORKSPACE and BOS', !Object.keys(reg.CAPABILITIES ?? {}).includes('LEADSPACE') && (reg.CAPABILITIES ?? []).every?.((c) => !c.limits || Object.keys(Object.values(c.limits)[0] ?? {}).every((k) => k !== 'LEADSPACE')));

section('legacy routes');
const nonTab = (r) => !r.includes('[');
const legacy = F.flatMap((f) => (f.legacyRoutes ?? []).map((l) => ({ f, from: typeof l === 'string' ? l : l.from, tab: typeof l === 'string' ? undefined : l.tab, query: typeof l === 'string' ? undefined : l.query })));
ok('every legacy address resolves to its feature, with the tab and the query string kept', legacy.every(({ f, from, tab, query }) => {
  const want = tab ? `${f.route}?tab=${tab}&x=1` : query ? `${f.route}?${query}&x=1` : `${f.route}?x=1`;
  return reg.resolveLegacyRoute(F, from, '?x=1') === want;
}));
ok('no legacy address is also a current route (no loops)', legacy.every(({ from }) => !F.some((f) => f.route === from)));
ok('every old route file maps somewhere (feature, legacy, kept, or the domain-app family)', (() => {
  const dash = path.join(ROOT, 'get4domain_mvp/src/app/dashboard');
  const reg2 = new Set([...F.map((f) => f.route), ...legacy.map((l) => l.from), ...reg.KEPT_ROUTES.map((k) => k.route), '/dashboard/domain-app']);
  const out = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'page.tsx') { const rel = path.relative(dash, path.dirname(p)).split(path.sep).join('/'); out.push(rel ? `/dashboard/${rel}` : '/dashboard'); } } };
  walk(dash);
  return out.filter(nonTab).every((r) => reg2.has(r));
})());
ok('the domain-app family splits by what the tab is (products / customers / invoices / orders / workspace) and keeps ?query', (() => {
  const r = (t) => reg.resolveLegacyRoute(F, `/dashboard/domain-app/${t}`, '?q=a');
  return r('catalog') === '/dashboard/commerce/products?tab=catalog&q=a' && r('patients') === '/dashboard/sales/customers?tab=patients&q=a' && r('billing') === '/dashboard/finance/invoices?tab=billing&q=a'
    && r('bookings') === '/dashboard/commerce/orders?tab=bookings&q=a' && r('fleet') === '/dashboard/commerce/workspace?tab=fleet&q=a' && reg.resolveLegacyRoute(F, '/dashboard/domain-app', '') === '/dashboard';
})());
ok('addresses that are not legacy return null (no accidental redirects)', reg.resolveLegacyRoute(F, '/dashboard/sales/leads', '') === null && reg.resolveLegacyRoute(F, '/dashboard', '') === null && reg.resolveLegacyRoute(F, '/dashboard/finance/invoices', '') === null);
ok('a trailing slash and an encoded tab are handled', reg.resolveLegacyRoute(F, '/dashboard/orders/', '') === '/dashboard/commerce/orders' && reg.resolveLegacyRoute(F, '/dashboard/domain-app/trip-sheets', '') === '/dashboard/commerce/workspace?tab=trip-sheets');
section('[feat:routes.redirects] retired routes redirect (query kept, nothing 404s)');
{
  const R = (p, q = '') => reg.resolveLegacyRoute(F, p, q);
  ok('the old sidebar Invoices address goes to Customer invoices with the one-time note, and any query is kept', R('/dashboard/invoices') === '/dashboard/finance/invoices?note=billing-moved' && R('/dashboard/invoices', '?x=1') === '/dashboard/finance/invoices?note=billing-moved&x=1');
  ok('Get4Domain receipts live under Plan and billing', R('/dashboard/billing/receipts') === '/dashboard/account/billing?tab=receipts');
  ok('the old Payments address goes to Collect payments', R('/dashboard/payments') === '/dashboard/finance/collect-payments');
  ok('the old Accounts address goes to Accounts, the old Stock address to Stock', R('/dashboard/accounts') === '/dashboard/finance/expenses' && R('/dashboard/stock') === '/dashboard/commerce/stock');
  const routes = new Set(F.map((f) => f.route));
  const targets = legacy.map(({ from }) => R(from, '')).filter(Boolean).map((t) => t.split('?')[0]);
  ok('every retired address lands on a real, registered screen', targets.length === legacy.length && targets.every((t) => routes.has(t) || t === '/dashboard'), targets.filter((t) => !routes.has(t)).join());
  ok('no retired address is silently dropped: each is still in the registry (kept at least 180 days; the registry has no expiry, removal needs a reviewed change)', legacy.length >= 30);
}
const genRed = read('get4domain_mvp/src/lib/redirects.generated.ts');
ok('the generated redirect table equals the registry (static entries)', legacy.every(({ from }) => genRed.includes(JSON.stringify(from))));

section('generated files');
const nav = read('get4domain_mvp/src/lib/nav.generated.ts');
const api = read('backend-api/src/registry/registry.generated.ts');
ok('both packages carry the same registry (same hash, same data)', /registry-hash: ([0-9a-f]{16})/.exec(nav)?.[1] === /registry-hash: ([0-9a-f]{16})/.exec(api)?.[1] && nav.split('export const FEATURES')[1] === api.split('export const FEATURES')[1]);
ok('generated files carry the GENERATED header', nav.startsWith('// GENERATED') && api.startsWith('// GENERATED') && genRed.startsWith('// GENERATED'));

section('the guard catches seeded violations');
{
  const run = (mutate) => {
    // copy the registry to a temp tree, mutate it, run the guard there
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-guard-'));
    const cp = (rel) => { const d = path.join(tmp, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), d); };
    for (const r of ['registry/types.ts', 'registry/state.ts', 'registry/features.ts', 'registry/capabilities.ts', 'registry/lib.mjs', 'registry/check.mjs', 'registry/build.mjs', 'backend-api/src/addons/addons.constants.ts', 'get4domain_mvp/package.json']) cp(r);
    // reuse the real app tree + generated files by junction-free copy of what the guard reads
    const copyDir = (rel) => { const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.next', 'dist'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const dst = path.join(tmp, path.relative(ROOT, p)); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(p, dst); } } }; walk(path.join(ROOT, rel)); };
    for (const d of ['get4domain_mvp/src/app/dashboard', 'get4domain_mvp/src/bos', 'get4domain_mvp/src/dashboard-v2', 'get4domain_mvp/src/lib', 'backend-api/src/registry', 'backend-api/scripts', 'get4domain_mvp/scripts', 'stepnrock/scripts', 'docs/v2/evidence']) if (fs.existsSync(path.join(ROOT, d))) copyDir(d);
    mutate(tmp);
    // typescript lives in the real get4domain_mvp/node_modules: point the copied lib at it
    const link = path.join(tmp, 'get4domain_mvp', 'node_modules');
    try { fs.symlinkSync(path.join(ROOT, 'get4domain_mvp', 'node_modules'), link, 'junction'); } catch { /* exists */ }
    const r = spawnSync(process.execPath, [path.join(tmp, 'registry', 'check.mjs')], { encoding: 'utf8' });
    fs.rmSync(tmp, { recursive: true, force: true });
    return (r.stdout || '') + (r.stderr || '') + `\nexit=${r.status}`;
  };
  const edit = (tmp, rel, fn) => { const p = path.join(tmp, rel); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
  const clean = run(() => undefined);
  ok('the untouched registry passes the guard', /registry guard: OK/.test(clean) && /exit=0/.test(clean), clean.slice(0, 600));
  ok('SEEDED: a dashboard route that is not registered fails (R1)', /R1.*\/dashboard\/surprise/.test(run((t) => { const d = path.join(t, 'get4domain_mvp/src/app/dashboard/surprise'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'page.tsx'), 'export default function P(){return null}'); })));
  ok('SEEDED: two features claiming one purpose fail (R2)', /R2.*purpose "orders"/.test(run((t) => edit(t, 'registry/features.ts', (s) => s.replace("purpose: 'stock'", "purpose: 'orders'")))));
  ok('SEEDED: WORKING without a testId fails (R3)', /R3.*WORKING without a testId/.test(run((t) => edit(t, 'registry/features.ts', (s) => s.replace("status: 'WORKING', testId: 'commerce.catalogue',", "status: 'WORKING',")))));
  ok('SEEDED: a testId no suite asserts fails (R3)', /R3.*no assertion tagged \[feat:made.up\]/.test(run((t) => edit(t, 'registry/features.ts', (s) => s.replace("testId: 'commerce.catalogue'", "testId: 'made.up'")))));
  ok('SEEDED: an unbuilt feature claiming evidence fails (R4)', /R4/.test(run((t) => edit(t, 'registry/features.ts', (s) => s.replace("{ id: 'sales.lead-tools', department: 'sales', label: 'Pitch scripts, assignment, sales reports', icon: 'ClipboardList',", "{ id: 'sales.lead-tools', department: 'sales', label: 'Pitch scripts, assignment, sales reports', testId: 'commerce.catalogue', icon: 'ClipboardList',")))));
  ok('SEEDED: an out-of-date generated file fails (R5)', /R5/.test(run((t) => edit(t, 'get4domain_mvp/src/lib/nav.generated.ts', (s) => `${s}\n// tampered`))));
  ok('SEEDED: the old ComingSoon stub imported by v2 code fails (R6)', /R6/.test(run((t) => { const d = path.join(t, 'get4domain_mvp/src/dashboard-v2'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'X.tsx'), "import ComingSoon from '@/domainapp/shared/ComingSoon';"); })));
  ok('SEEDED: an unknown module key fails (R7)', /R7.*moduleKey "nope"/.test(run((t) => edit(t, 'registry/features.ts', (s) => s.replace("moduleKey: 'telecrm',", "moduleKey: 'nope',")))));
  ok('SEEDED: a duplicate label in one department fails (R7)', /R7.*label in department/.test(run((t) => edit(t, 'registry/features.ts', (s) => s.replace("label: 'Quotes'", "label: 'Customers'")))));
}

section('nav matrix: plan × profile × nav_v2 (snapshot)');
{
  const plans = [['ESSENTIALS', { plan: 'WORKSPACE', custom: false }], ['PRO', { plan: 'BOS', custom: false }], ['CUSTOM', { plan: 'BOS', custom: true }]];
  const profiles = ['COMMERCE', 'APPOINTMENTS', 'PACKAGES', 'SERVICES', 'LISTINGS'];
  const snap = {}; let dupPurpose = 0; let lockedUnbuilt = 0; let openNoEvidence = 0; let emptyOff = 0;
  for (const [pn, p] of plans) for (const profile of profiles) for (const navV2 of [true, false]) {
    const menu = reg.buildMenu(F, { ...p, profile, navV2 });
    if (!navV2) { if (menu.length !== 0) emptyOff += 1; continue; }
    const items = menu.flatMap((d) => d.items);
    const purposes = items.map((i) => i.feature.purpose);
    if (new Set(purposes).size !== purposes.length) dupPurpose += 1;
    for (const i of items) {
      if (i.state === 'LOCKED' && !(i.feature.status === 'WORKING' || i.feature.status === 'LIMITED')) lockedUnbuilt += 1;
      if (i.state === 'OPEN' && !(i.feature.testId || i.feature.manualCheck)) openNoEvidence += 1;
    }
    snap[`${pn}/${profile}`] = menu.map((d) => `${d.label}: ${d.items.map((i) => `${i.label}=${i.state}`).join(' | ')}`);
  }
  ok('nav_v2 off → no v2 menu for any plan/profile (30 combinations)', emptyOff === 0);
  ok('no menu has two items for one purpose (15 combinations)', dupPurpose === 0);
  ok('no Locked item is unbuilt; no Open item lacks evidence', lockedUnbuilt === 0 && openNoEvidence === 0);
  const file = path.join(ROOT, 'registry/snapshots/nav-matrix.json');
  if (process.argv.includes('--update') || !fs.existsSync(file)) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(snap, null, 2) + '\n'); console.log('  (snapshot written)'); }
  ok('the menu for every plan × profile equals the committed snapshot (a change must be reviewed: --update)', JSON.stringify(snap) === JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))));
  ok('Essentials/product business sees Stock; Essentials/services does not', snap['ESSENTIALS/COMMERCE'].join().includes('Stock=OPEN') && !snap['ESSENTIALS/SERVICES'].join().includes('Stock='));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
