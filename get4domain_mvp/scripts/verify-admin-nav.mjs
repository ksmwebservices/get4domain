// Verifies the admin navigation never exposes the Commerce area to the MARKETING staff role.
//   node scripts/verify-admin-nav.mjs            (npm run verify:admin-nav)
// The server is the real control (CommercialAdminGuard — see backend-api/scripts/commercial-verify); this checks the UI.
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const src = join(root, 'src');
let passed = 0;
let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { passed += 1; console.log(`  ok   ${name}`); } else { failed += 1; console.log(`  FAIL ${name} ${detail}`); }
};

// Load the TypeScript nav module for real.
const compiled = ts.transpileModule(readFileSync(join(src, 'lib', 'admin-nav.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 } }).outputText;
const tmp = mkdtempSync(join(tmpdir(), 'g4d-nav-'));
writeFileSync(join(tmp, 'admin-nav.mjs'), compiled);
const nav = await import(pathToFileURL(join(tmp, 'admin-nav.mjs')).href);

console.log('\nNAV CONFIG');
const marketing = nav.navForRole('MARKETING');
const ops = nav.navForRole('OPERATIONS');
const sup = nav.navForRole('SUPER_ADMIN');
ok('MARKETING sees some sections (the role is not locked out of everything)', marketing.length >= 4, String(marketing.length));
ok('no nav entry visible to MARKETING is under /admin/commerce', marketing.every((i) => !nav.isCommerceHref(i.href)), marketing.map((i) => i.href).join());
ok('no nav entry visible to MARKETING is labelled Commerce', marketing.every((i) => !/commerce/i.test(i.label)));
ok('canSeeCommerce(MARKETING) is false', nav.canSeeCommerce('MARKETING') === false);
ok('SUPER_ADMIN and OPERATIONS still see Commerce', sup.some((i) => nav.isCommerceHref(i.href)) && ops.some((i) => nav.isCommerceHref(i.href)));
ok('every commerce entry excludes MARKETING in its roles', nav.ADMIN_NAV.filter((i) => nav.isCommerceHref(i.href)).every((i) => !i.roles.includes('MARKETING')));
ok('isCommerceHref is exact on the path boundary (does not match /admin/commercefoo)', nav.isCommerceHref('/admin/commerce/deals') && nav.isCommerceHref('/admin/commerce') && !nav.isCommerceHref('/admin/commercefoo'));

console.log('\nNO LEAKS OUTSIDE THE NAV CONFIG');
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(src).filter((f) => /\.(tsx?|jsx?)$/.test(f));
const rel = (f) => relative(root, f).split(sep).join('/');
const mentions = files.filter((f) => !rel(f).startsWith('src/app/admin/commerce/') && !rel(f).startsWith('src/lib/') && !rel(f).startsWith('src/components/admin/') && /\/admin\/commerce/.test(readFileSync(f, 'utf8')));
const customersRoles = nav.ADMIN_NAV.find((i) => i.href === '/admin/customers')?.roles ?? [];
ok('the vendor pages that link to commerce live under a SUPER-only nav section', !customersRoles.includes('MARKETING'));
for (const f of mentions) {
  const r = rel(f);
  const text = readFileSync(f, 'utf8');
  if (r.startsWith('src/app/admin/customers/')) ok(`${r}: reachable only from the SUPER-only Vendors section`, !customersRoles.includes('MARKETING'));
  else ok(`${r}: gates its commerce references with canSeeCommerce`, /canSeeCommerce|COMMERCE_PREFIX/.test(text), 'no role gate found');
}
const layout = readFileSync(join(src, 'app/admin/layout.tsx'), 'utf8');
ok('admin layout builds its menu from ADMIN_NAV (no hand-written commerce entry)', /ADMIN_NAV\.map/.test(layout) && !/href:\s*'\/admin\/commerce/.test(layout));
ok('admin layout only polls the commerce API for roles that may use it', /canSeeCommerce\(adminRole\)/.test(layout));
const settings = readFileSync(join(src, 'app/admin/settings/page.tsx'), 'utf8');
ok('settings page shows the Payee & QR link only when showCommerce', /showCommerce && \(/.test(settings) && settings.indexOf('showCommerce &&') < settings.indexOf('/admin/commerce/payee'));
const cl = readFileSync(join(src, 'app/admin/commerce/layout.tsx'), 'utf8');
ok('commerce layout refuses to render for MARKETING and skips its API calls', /!allowed/.test(cl) && /if \(!allowed\) return;/.test(cl));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
