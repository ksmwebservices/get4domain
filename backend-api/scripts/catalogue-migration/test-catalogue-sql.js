#!/usr/bin/env node
'use strict';
/** Offline guard tests for the catalogue migration SQL (no database, no network). */
const S = require('./catalogue-sql');

let failed = 0;
const t = (name, fn) => { try { fn(); console.log(`PASS  ${name}`); } catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e.message}`); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'not equal'}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const throws = (fn, m) => { try { fn(); } catch { return; } throw new Error(m || 'expected throw'); };

const scopes = [{ scope: 'real' }, { scope: 'all' }, { scope: 'real', vendorId: 'cmuezz0jabc123' }];
const writes = (o) => [S.categoryInsert(o), S.insertFrom(S.catalogSelect(o)), S.insertFrom(S.retailSelect(o)), S.backfillIndustryUpdate(o), S.backfillStatusUpdate(o)];

t('every write statement passes the write guard (all scopes)', () => scopes.forEach((o) => writes(o).forEach(S.assertWriteAllowed)));
t('no generated statement contains DROP / DELETE / TRUNCATE / ALTER', () =>
  scopes.forEach((o) => writes(o).concat(S.backfillPreviewSelect(o, true), S.typeProbe(S.catalogSelect(o))).forEach((s) => {
    if (/\b(DROP|DELETE|TRUNCATE|ALTER)\b/i.test(s)) throw new Error(s.slice(0, 80));
  })));
t('old tables are never a write target', () => scopes.forEach((o) => writes(o).forEach((s) => {
  if (/(INSERT\s+INTO|UPDATE)\s+"?g4d_(catalog_items|retail_products)"?/i.test(s)) throw new Error('writes to a source table');
})));
t('guard rejects writes to the source tables', () => {
  throws(() => S.assertWriteAllowed('DELETE FROM g4d_catalog_items'));
  throws(() => S.assertWriteAllowed('UPDATE g4d_retail_products SET name = 1'));
  throws(() => S.assertWriteAllowed('INSERT INTO g4d_catalog_items VALUES (1)'));
  throws(() => S.assertWriteAllowed('DROP TABLE "VendorProduct"'));
  throws(() => S.assertWriteAllowed('TRUNCATE "VendorProduct"'));
});
t('insert column list matches the select list (22 columns, same order)', () => {
  eq(S.TARGET_COLUMNS.length, 22);
  for (const sel of [S.catalogSelect({ scope: 'real' }), S.retailSelect({ scope: 'real' })]) {
    const aliases = [...sel.matchAll(/ AS "([A-Za-z]+)"/g)].map((m) => m[1]);
    eq(aliases.join(','), S.TARGET_COLUMNS.map(([n]) => n).join(','), 'alias order');
  }
});
t('copies are inserted hidden (active=false) and keep the source id', () => {
  for (const sel of [S.catalogSelect({ scope: 'real' }), S.retailSelect({ scope: 'real' })]) {
    if (!/false AS "active"/.test(sel)) throw new Error('active not false');
    if (!/ AS "sourceId"/.test(sel)) throw new Error('no sourceId');
  }
  if (!/ci\.id AS "id"/.test(S.catalogSelect({ scope: 'real' }))) throw new Error('catalog id not preserved');
  if (!/rp\.id AS "id"/.test(S.retailSelect({ scope: 'real' }))) throw new Error('retail id not preserved');
});
t('re-run safety: NOT EXISTS on id and ON CONFLICT DO NOTHING', () => {
  if (!/NOT EXISTS \(SELECT 1 FROM "VendorProduct" x WHERE x\.id = ci\.id\)/.test(S.catalogSelect({ scope: 'real' }))) throw new Error('catalog');
  if (!/ON CONFLICT DO NOTHING/.test(S.insertFrom(S.retailSelect({ scope: 'real' })))) throw new Error('on conflict');
});
t('scope=real excludes sandbox vendors; scope=all does not', () => {
  if (!/v\."isSandbox" = false/.test(S.catalogSelect({ scope: 'real' }))) throw new Error('real');
  if (/isSandbox/.test(S.catalogSelect({ scope: 'all' }))) throw new Error('all');
});
t('--vendor value is validated (no SQL injection)', () => {
  throws(() => S.scopeWhere({ scope: 'real', vendorId: "x'; DROP TABLE a;--" }));
  eq(/v\.id = 'cmuezz0jabc123'/.test(S.scopeWhere({ scope: 'real', vendorId: 'cmuezz0jabc123' })), true);
});
t('backfill only fills NULLs (COALESCE) and never rewrites a populated column', () => {
  const u = S.backfillIndustryUpdate({ scope: 'real' });
  for (const c of ['industryType', 'priceAmount', 'stockQty']) if (!new RegExp(`"${c}"\\s*=\\s*COALESCE\\(vp\\."${c}"`).test(u)) throw new Error(c);
  if (/"updatedAt"/.test(u)) throw new Error('bumps updatedAt');
  if (/SET[^]*"(name|price|customFields|category|active)"\s*=/.test(u.replace(/"priceAmount"/g, ''))) throw new Error('rewrites an original column');
});
t('price regex: plain amounts only', () => {
  const re = new RegExp(S.NUM_RE.replace(/\[\[:space:\]\]/g, '\\s'));
  for (const ok of ['8000', '89.99', ' 24.5 ', '0']) if (!re.test(ok)) throw new Error('should match ' + ok);
  for (const bad of ['On Request', 'from 500', '1,299', 'asdfasdfasdfas', '', '12.345', '₹500']) if (re.test(bad)) throw new Error('should NOT match ' + bad);
});

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
