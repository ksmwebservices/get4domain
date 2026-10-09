// A Workspace-plan vendor sees the Workspace menu only: no BOS-only items, no duplicate catalogue tabs; notifications and settings are real.
//   node scripts/verify-workspace-menu.mjs
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const src = join(root, 'src');
let passed = 0; let failed = 0;
const ok = (name, cond, detail = '') => { if (cond) { passed += 1; console.log(`  ok   ${name}`); } else { failed += 1; console.log(`  FAIL ${name} ${detail}`); } };
const read = (rel) => readFileSync(join(src, rel), 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'g4d-wsmenu-'));
async function load(rel) {
  const js = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 } }).outputText;
  const f = join(tmp, rel.replace(/\//g, '_').replace(/\.ts$/, '.mjs'));
  writeFileSync(f, js);
  return import(pathToFileURL(f).href);
}

const M = await load('lib/workspace-menu.ts');
const N = await load('lib/notifications-ui.ts');
const items = M.WORKSPACE_SECTIONS.flatMap((s) => s.items);
const labels = items.map((i) => i.label);
const hrefs = items.map((i) => i.href);

console.log('\nTHE SWITCH');
ok('only an explicit boolean true turns the Workspace menu on', M.isWorkspaceMenu({ workspace_menu: true }) && !M.isWorkspaceMenu({ workspace_menu: false }) && !M.isWorkspaceMenu({}) && !M.isWorkspaceMenu(undefined) && !M.isWorkspaceMenu(null) && !M.isWorkspaceMenu({ workspace_menu: 'true' }));
ok('a vendor with no such addon (every other vendor today) keeps the standard menu', M.isWorkspaceMenu({ fleet: true, inventory_management: true }) === false);

console.log('\nTHE WORKSPACE SET');
for (const want of ['Home', 'My Products', 'Stock', 'Orders', 'Leads & CRM', 'TeleCRM', 'Website Manager', 'Domain', 'AI Studio', 'Customer invoices', 'Accounts', 'Team', 'Plan & Billing', 'Settings']) ok(`shows "${want}"`, labels.includes(want));
ok('Plan & Billing links to the billing page (audit finding 7)', items.find((i) => i.label === 'Plan & Billing')?.href === '/dashboard/billing');
ok('no BOS-only item is present (HRM, campaigns/Growth Hub, WhatsApp bot, communication hub, stationery, customer hub, analytics hub, website engine, embed)', M.BOS_ONLY_HREFS.every((h) => !hrefs.some((x) => x === h || x.startsWith(`${h}/`))), hrefs.join());
ok('no industry catalogue / retail inventory / POS tab (the duplicate CatalogItem / RetailProduct screens)', hrefs.every((h) => !h.startsWith(M.DUPLICATE_CATALOGUE_PREFIX)));
ok('no duplicate entries', new Set(hrefs).size === hrefs.length && new Set(labels).size === labels.length);
ok('exactly one catalogue entry: My Products', labels.filter((l) => /product|catalog|inventory|pos\b/i.test(l)).join() === 'My Products');
ok('every entry points at a page that exists', hrefs.every((h) => existsSync(join(src, 'app', ...h.split('/').filter(Boolean), 'page.tsx'))), hrefs.filter((h) => !existsSync(join(src, 'app', ...h.split('/').filter(Boolean), 'page.tsx'))).join());
ok('team-gated items map to team areas the server enforces (products/stock/orders → website)', items.filter((i) => ['My Products', 'Stock', 'Orders'].includes(i.label)).every((i) => i.moduleKey === 'website_manager'));
ok('workspaceVisible drops hidden items and empty sections', M.workspaceVisible(M.WORKSPACE_SECTIONS, (i) => i.href === '/dashboard/team').flatMap((s) => s.items).every((i) => i.href !== '/dashboard/team'));

console.log('\nTHE LAYOUT USES IT (and leaves other vendors alone)');
const layout = read('app/dashboard/layout.tsx');
ok('Workspace mode returns the fixed list — it does not filter the standard one', /if \(workspace\) return WORKSPACE_SECTIONS/.test(layout));
ok('the switch is read from the vendor\'s own addon states', /isWorkspaceMenu\(cfg\.addons\)/.test(layout));
ok('the standard menu is still all there for everyone else', ['LeadSpace', 'WhatsApp Bot', 'HRM', 'Accounts', 'Customer Hub', 'Analytics Hub', 'Stationery'].every((l) => layout.includes(`label: '${l}'`)));
ok('plan & billing is owner-only for team members', /item\.href === '\/dashboard\/billing'/.test(layout));
ok('while the vendor\'s switches load, a skeleton shows — the full menu never flashes first', /cfg\.loading \?/.test(layout) && /aria-label="Loading menu"/.test(layout));
ok('the bell shows a real unread count, not a permanent dot', /unread > 0/.test(layout) && !/absolute top-1\.5 right-1\.5 h-2 w-2 rounded-full bg-error-500/.test(layout));
ok('the "What BOS adds" card is on Home for Workspace vendors only, once', /isWorkspaceMenu\(cfg\.addons\) && <WhatBosAdds \/>/.test(read('app/dashboard/page.tsx')) && !/coming soon/i.test(read('components/dashboard/WhatBosAdds.tsx')));

console.log('\nNOTIFICATIONS AND SETTINGS ARE REAL');
const notif = read('app/dashboard/notifications/page.tsx');
ok('the notifications page has no hard-coded demo rows (no mrtravels, INV-001, Muthukumar)', !/mrtravels|INV-00\d|Muthukumar/i.test(notif) && /api\.getNotifications\(\)/.test(notif));
const settings = read('app/dashboard/settings/page.tsx');
ok('settings no longer fakes a save (no setTimeout "Saved", no MR Travels defaults)', !/setTimeout|mrtravels|Muthukumar|98765/i.test(settings) && /useAuth/.test(settings));
ok('settings tells the vendor how to change details (Support)', /dashboard\/support/.test(settings));
ok('order → orders page, low stock → stock page, lead → CRM page', N.notificationLink({ type: 'NEW_ORDER' }) === '/dashboard/orders' && N.notificationLink({ type: 'LOW_STOCK' }) === '/dashboard/stock' && N.notificationLink({ type: 'website_enquiry', actionType: 'view_lead' }) === '/dashboard/crm');
ok('a link in notification data is followed only if it is a dashboard path', N.notificationLink({ type: 'x', data: { link: '/dashboard/billing' } }) === '/dashboard/billing' && N.notificationLink({ type: 'x', data: { link: 'https://evil.example' } }) === null && N.notificationLink({ type: 'x', data: { link: 'javascript:alert(1)' } }) === null && N.notificationLink({ type: 'x', data: { link: '//evil.example' } }) === null);
ok('order / low stock / lead each get their own look', N.notificationMeta('NEW_ORDER') === 'order' && N.notificationMeta('LOW_STOCK') === 'stock' && N.notificationMeta('website_enquiry') === 'lead' && N.notificationMeta('whatever') === 'info');
ok('timeAgo reads naturally', N.timeAgo(new Date(1_000_000).toISOString(), 1_000_000 + 30_000) === 'just now' && N.timeAgo(new Date(1_000_000).toISOString(), 1_000_000 + 5 * 60_000) === '5 min ago' && N.timeAgo(new Date(1_000_000).toISOString(), 1_000_000 + 3 * 3_600_000) === '3 hours ago');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
