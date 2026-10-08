#!/usr/bin/env node
// The registry guard — fails (exit 1) on drift.   node registry/check.mjs      (npm run registry:check in either package)
//  R1 every dashboard route is registered (feature route, legacy route, or a documented KEPT route) and every feature route is reachable
//  R2 ids and purposes are unique; two features may not share a purpose
//  R3 WORKING needs a `[feat:<testId>]` assertion in a verify suite; LIMITED needs a testId or a recorded manual check; LIMITED needs `limits`
//  R4 only built features can be Open/Locked (by construction) and an unbuilt one never claims a testId
//  R5 generated files are current
//  R6 no stub: v2 code may not import the old ComingSoon stub
//  R7 plans, module keys and addon keys exist; labels unique per department
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRegistry, generatedFiles, read, exists } from './lib.mjs';

const reg = await loadRegistry();
const F = reg.FEATURES;
const problems = [];
const bad = (rule, msg) => problems.push(`${rule}  ${msg}`);
const walk = (dir, acc = []) => {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, acc) : acc.push(p);
  }
  return acc;
};

// ── R2 / R7: ids, purposes, labels, plans, keys
const seen = (rule, what, key) => { const m = new Map(); for (const f of F) { const k = key(f); if (m.has(k)) bad(rule, `${what} "${k}" used by both ${m.get(k)} and ${f.id}`); else m.set(k, f.id); } };
seen('R2', 'id', (f) => f.id);
seen('R2', 'purpose', (f) => f.purpose);
seen('R7', 'label in department', (f) => `${f.department}/${f.label}`);
seen('R2', 'route', (f) => f.route);
const backendConst = read('backend-api/src/addons/addons.constants.ts');
const moduleKeys = new Set([...backendConst.matchAll(/key: '([a-z_]+)', label: '[^']*', description: '[^']*', walletGated/g)].map((m) => m[1]));
const addonKeys = new Set([...backendConst.matchAll(/key: '([a-z_]+)', label: '[^']*', description: '[^']*', category/g)].map((m) => m[1]));
for (const f of F) {
  if (!['WORKSPACE', 'BOS', 'CUSTOM'].includes(f.minPlan)) bad('R7', `${f.id}: unknown minPlan ${f.minPlan}`);
  if (f.moduleKey && !moduleKeys.has(f.moduleKey)) bad('R7', `${f.id}: moduleKey "${f.moduleKey}" is not a platform module`);
  if (f.addonKey && !addonKeys.has(f.addonKey)) bad('R7', `${f.id}: addonKey "${f.addonKey}" is not a platform addon`);
  if (f.upgrade && !(f.upgrade.headline && f.upgrade.body)) bad('R7', `${f.id}: upgrade copy needs headline and body`);
}

// ── R3 / R4: evidence
const suiteText = [...walk(path.join(ROOT, 'backend-api/scripts')), ...walk(path.join(ROOT, 'get4domain_mvp/scripts')), ...walk(path.join(ROOT, 'stepnrock/scripts'))]
  .filter((p) => /\.(js|mjs)$/.test(p)).map((p) => fs.readFileSync(p, 'utf8')).join('\n');
for (const f of F) {
  const built = f.status === 'WORKING' || f.status === 'LIMITED';
  if (f.testId && !suiteText.includes(`[feat:${f.testId}]`)) bad('R3', `${f.id}: no assertion tagged [feat:${f.testId}] in any verify suite`);
  if (f.status === 'WORKING' && !f.testId) bad('R3', `${f.id}: WORKING without a testId`);
  if (f.status === 'LIMITED') {
    if (!f.testId && !f.manualCheck) bad('R3', `${f.id}: LIMITED needs a testId or a manualCheck`);
    if (!f.limits && !f.testId) bad('R3', `${f.id}: LIMITED without stated limits`);
    if (!f.limits) bad('R3', `${f.id}: LIMITED must say what the limit is`);
  }
  if (f.manualCheck) {
    const [file, anchor] = f.manualCheck.split('#');
    if (!exists(file)) bad('R3', `${f.id}: manualCheck file ${file} does not exist`);
    else if (anchor && !read(file).includes(`\`${anchor}\``)) bad('R3', `${f.id}: ${file} has no recorded check for \`${anchor}\``);
  }
  if (!built && (f.testId || f.manualCheck)) bad('R4', `${f.id}: ${f.status} must not claim evidence`);
}

// ── R1: routes
const registered = new Set();
for (const f of F) {
  registered.add(f.route);
  for (const l of f.legacyRoutes ?? []) registered.add(typeof l === 'string' ? l : l.from);
}
for (const k of reg.KEPT_ROUTES) registered.add(k.route);
registered.add('/dashboard/domain-app');
const dashDir = path.join(ROOT, 'get4domain_mvp/src/app/dashboard');
const pageRoutes = walk(dashDir).filter((p) => p.endsWith(`${path.sep}page.tsx`)).map((p) => {
  const rel = path.relative(dashDir, path.dirname(p)).split(path.sep).join('/');
  return rel ? `/dashboard/${rel}` : '/dashboard';
});
for (const r of pageRoutes) {
  if (r.includes('[')) { if (!['/dashboard/domain-app/[tab]', '/dashboard/[dept]/[screen]'].includes(r)) bad('R1', `unexpected dynamic dashboard route ${r}`); continue; }
  if (!registered.has(r)) bad('R1', `dashboard route ${r} is not in the registry (add it as a feature route, a legacyRoute, or a KEPT route with a reason)`);
}
for (const f of F) {
  if (f.route === '/dashboard') continue;
  const ok = reg.FEATURES && ['/dashboard/sales', '/dashboard/marketing', '/dashboard/website', '/dashboard/commerce', '/dashboard/finance', '/dashboard/people', '/dashboard/communication', '/dashboard/account', '/dashboard/custom', '/dashboard/home'].some((p) => f.route.startsWith(`${p}/`));
  if (!ok) bad('R1', `${f.id}: route ${f.route} is outside the v2 departments`);
}
if (!exists('get4domain_mvp/src/app/dashboard/[dept]/[screen]/page.tsx')) bad('R1', 'the generic v2 route (dashboard/[dept]/[screen]) is missing');

// ── R5: generated files current
for (const [rel, text] of Object.entries(generatedFiles(reg))) {
  if (!exists(rel)) bad('R5', `${rel} is missing — run npm run registry:build`);
  else if (read(rel) !== text.replace(/\r\n/g, '\n')) bad('R5', `${rel} is out of date — run npm run registry:build`);
}

// ── R6: no stubs in v2 code
for (const p of walk(path.join(ROOT, 'get4domain_mvp/src/dashboard-v2')).filter((x) => /\.(ts|tsx)$/.test(x))) {
  if (/@\/domainapp\/shared\/ComingSoon/.test(fs.readFileSync(p, 'utf8'))) bad('R6', `${path.relative(ROOT, p)} imports the old ComingSoon stub`);
}

if (problems.length) {
  console.error(`registry guard: ${problems.length} problem(s)\n` + problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`registry guard: OK — ${F.length} features, ${pageRoutes.length} dashboard routes registered, generated files current.`);
