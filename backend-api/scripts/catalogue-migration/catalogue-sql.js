'use strict';
/**
 * Universal Catalogue data migration — SQL builders (dispatch 03-Oct-2026).
 *
 * Folds g4d_catalog_items (CatalogItem) and g4d_retail_products (RetailProduct) into
 * "VendorProduct" and backfills the new universal columns on the rows that already exist.
 *
 * Design rules (enforced by test-catalogue-sql.js):
 *   - The ONLY tables ever written are "VendorProduct" and g4d_categories. The two source
 *     tables are read-only here; nothing is deleted, dropped or truncated.
 *   - Copies keep the SOURCE ROW'S id, so Record.catalogItemId / PosSale line ids stay valid
 *     after the later cutover. Re-running is a no-op (NOT EXISTS on id + ON CONFLICT DO NOTHING).
 *   - Copies are inserted with active=false and their real state in `status`, so every live
 *     reader (`WHERE active = true`) sees exactly what it saw before the copy.
 *   - Backfill on existing VendorProduct rows only FILLS NULL new columns; no existing column
 *     is rewritten and updatedAt is not bumped.
 *   - Every select-list expression is explicitly cast: in INSERT ... SELECT an untyped NULL
 *     resolves to text and would be rejected for integer / jsonb targets.
 */

/** Same notion of "plain amount" as engine/checkout-pricing.ts parseListedPrice, minus symbols. */
const NUM_RE = '^[[:space:]]*[0-9]+(\\.[0-9]{1,2})?[[:space:]]*$';

/** Target columns of the INSERT, in order, with the Postgres type each select expression must have. */
const TARGET_COLUMNS = [
  ['id', 'text'], ['vendorId', 'text'], ['name', 'text'], ['description', 'text'], ['price', 'text'],
  ['image', 'text'], ['category', 'text'], ['categoryId', 'text'], ['customFields', 'jsonb'],
  ['active', 'boolean'], ['createdAt', 'timestamp without time zone'], ['updatedAt', 'timestamp without time zone'],
  ['industryType', 'text'], ['priceAmount', 'double precision'], ['unit', 'text'], ['sku', 'text'],
  ['stockQty', 'integer'], ['reorderLevel', 'integer'], ['status', 'text'], ['operationKey', 'text'],
  ['sourceModel', 'text'], ['sourceId', 'text'],
];

/** Columns this migration needs to exist on "VendorProduct" (i.e. the schema migration was applied). */
const NEW_COLUMNS = ['industryType', 'priceAmount', 'unit', 'sku', 'stockQty', 'reorderLevel', 'status', 'operationKey', 'sourceModel', 'sourceId'];

function scopeWhere(opts) {
  const parts = [opts.scope === 'all' ? 'true' : 'v."isSandbox" = false'];
  if (opts.vendorId) {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(opts.vendorId)) throw new Error(`Invalid --vendor id: ${opts.vendorId}`);
    parts.push(`v.id = '${opts.vendorId}'`);
  }
  return parts.join(' AND ');
}

/** Display price string: null for 0/negative (so a 0-priced "visit" is never purchasable online). */
const display = (col) => `(CASE WHEN ${col} > 0 THEN trim_scale(round(${col}::numeric, 2))::text END)`;

function selectList(rows) {
  return TARGET_COLUMNS.map(([name]) => `${rows[name]} AS "${name}"`).join(',\n  ');
}

/** CatalogItem -> VendorProduct rows that do not exist yet. */
function catalogSelect(opts) {
  return `SELECT
  ${selectList({
    id: 'ci.id', vendorId: 'ci."vendorId"', name: 'ci.name', description: 'ci.description::text',
    price: `${display('ci.price')}`, image: 'ci.image::text', category: 'NULL::text', categoryId: 'NULL::text',
    customFields: 'ci."customFields"::jsonb', active: 'false', createdAt: 'ci."createdAt"', updatedAt: 'ci."updatedAt"',
    industryType: 'v.industry::text', priceAmount: 'ci.price::double precision', unit: 'ci.unit::text', sku: 'NULL::text',
    stockQty: 'ci.stock::integer', reorderLevel: 'NULL::integer',
    status: `(CASE WHEN ci.active THEN 'active' ELSE 'inactive' END)::text`, operationKey: 'NULL::text',
    sourceModel: `'catalog_item'::text`, sourceId: 'ci.id',
  })}
FROM g4d_catalog_items ci
JOIN "Vendor" v ON v.id = ci."vendorId"
WHERE ${scopeWhere(opts)}
  AND NOT EXISTS (SELECT 1 FROM "VendorProduct" x WHERE x.id = ci.id)`;
}

/** RetailProduct -> VendorProduct rows that do not exist yet. Category resolved from g4d_categories. */
function retailSelect(opts) {
  return `SELECT
  ${selectList({
    id: 'rp.id', vendorId: 'rp."vendorId"', name: 'rp.name', description: 'NULL::text',
    price: `${display('rp.price')}`, image: 'NULL::text', category: `COALESCE(c.name, NULLIF(btrim(rp.category), ''))::text`,
    categoryId: 'c.id::text', customFields: 'NULL::jsonb', active: 'false', createdAt: 'rp."createdAt"', updatedAt: 'rp."updatedAt"',
    industryType: 'v.industry::text', priceAmount: 'rp.price::double precision', unit: 'NULL::text', sku: 'rp.sku::text',
    stockQty: 'rp."stockQty"::integer', reorderLevel: 'rp."reorderLevel"::integer',
    status: `(CASE WHEN rp.active THEN 'active' ELSE 'inactive' END)::text`, operationKey: 'NULL::text',
    sourceModel: `'retail_product'::text`, sourceId: 'rp.id',
  })}
FROM g4d_retail_products rp
JOIN "Vendor" v ON v.id = rp."vendorId"
LEFT JOIN g4d_categories c ON c."vendorId" = rp."vendorId" AND c."nameNormalized" = lower(btrim(rp.category))
WHERE ${scopeWhere(opts)}
  AND NOT EXISTS (SELECT 1 FROM "VendorProduct" x WHERE x.id = rp.id)`;
}

const insertFrom = (select) =>
  `INSERT INTO "VendorProduct" (${TARGET_COLUMNS.map(([n]) => `"${n}"`).join(', ')})\n${select}\nON CONFLICT DO NOTHING`;

/** Distinct (vendor, normalised name) categories the RetailProduct free-text `category` implies. */
function categoryDistinctSelect(opts) {
  return `SELECT rp."vendorId" AS "vendorId", COALESCE(v.industry, 'general') AS industry,
  min(btrim(rp.category)) AS name, lower(btrim(rp.category)) AS "nameNormalized"
FROM g4d_retail_products rp
JOIN "Vendor" v ON v.id = rp."vendorId"
WHERE ${scopeWhere(opts)} AND btrim(COALESCE(rp.category, '')) <> ''
  AND NOT EXISTS (SELECT 1 FROM g4d_categories c WHERE c."vendorId" = rp."vendorId" AND c."nameNormalized" = lower(btrim(rp.category)))
GROUP BY rp."vendorId", COALESCE(v.industry, 'general'), lower(btrim(rp.category))`;
}

function categoryInsert(opts) {
  return `INSERT INTO g4d_categories (id, "vendorId", industry, name, "nameNormalized", "createdAt", "updatedAt")
SELECT 'mig' || substr(md5(d."vendorId" || '|' || d."nameNormalized"), 1, 29), d."vendorId", d.industry, d.name, d."nameNormalized", now(), now()
FROM (${categoryDistinctSelect(opts)}) d
ON CONFLICT ("vendorId", "nameNormalized") DO NOTHING`;
}

/** Existing-row backfill: fills NULL new columns only. `ready` = new columns exist on the table. */
const stockExpr = `CASE WHEN jsonb_typeof(vp."customFields"->'stockQty') = 'number' AND (vp."customFields"->>'stockQty') ~ '^[0-9]{1,9}$' THEN (vp."customFields"->>'stockQty')::integer END`;
const priceExpr = `CASE WHEN vp.price ~ '${NUM_RE}' THEN btrim(vp.price)::numeric::double precision END`;

function backfillIndustryUpdate(opts) {
  return `UPDATE "VendorProduct" vp SET
  "industryType" = COALESCE(vp."industryType", v.industry),
  "priceAmount"  = COALESCE(vp."priceAmount", ${priceExpr}),
  "stockQty"     = COALESCE(vp."stockQty", ${stockExpr})
FROM "Vendor" v
WHERE v.id = vp."vendorId" AND vp."sourceModel" IS NULL AND ${scopeWhere(opts)}
  AND (vp."industryType" IS NULL OR (vp."priceAmount" IS NULL AND vp.price IS NOT NULL) OR (vp."stockQty" IS NULL AND vp."customFields" IS NOT NULL))`;
}

function backfillStatusUpdate(opts) {
  return `UPDATE "VendorProduct" vp SET status = 'inactive'
FROM "Vendor" v
WHERE v.id = vp."vendorId" AND vp."sourceModel" IS NULL AND vp.active = false AND vp.status = 'active' AND ${scopeWhere(opts)}`;
}

function backfillPreviewSelect(opts, ready) {
  const cur = (col) => (ready ? `vp."${col}"` : 'NULL');
  return `SELECT v.subdomain AS vendor, count(*)::int AS rows,
  count(*) FILTER (WHERE ${cur('industryType')} IS NULL AND v.industry IS NOT NULL)::int AS "industryType",
  count(*) FILTER (WHERE ${cur('priceAmount')} IS NULL AND vp.price ~ '${NUM_RE}')::int AS "priceAmount",
  count(*) FILTER (WHERE ${cur('stockQty')} IS NULL AND ${stockExpr} IS NOT NULL)::int AS "stockQty",
  count(*) FILTER (WHERE vp.active = false)::int AS "statusToInactive"
FROM "VendorProduct" vp
JOIN "Vendor" v ON v.id = vp."vendorId"
WHERE ${ready ? 'vp."sourceModel" IS NULL AND ' : ''}${scopeWhere(opts)}
GROUP BY v.subdomain ORDER BY v.subdomain`;
}

/** Static type probe: pg_typeof is static, so it works even when the select returns zero rows. */
function typeProbe(select) {
  return `SELECT ${TARGET_COLUMNS.map(([n]) => `pg_typeof(s."${n}")::text AS "${n}"`).join(', ')}
FROM (SELECT 1) one LEFT JOIN (${select}) s ON false LIMIT 1`;
}

/** Last line of defence: refuse any statement that could write outside the two allowed tables. */
function assertWriteAllowed(sql) {
  const writes = [...sql.matchAll(/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?|DROP\s+\w+|ALTER\s+\w+)\s+("?[A-Za-z0-9_]+"?)/gi)];
  for (const [, verb, target] of writes) {
    const t = target.replace(/"/g, '');
    const okVerb = /^(INSERT\s+INTO|UPDATE)$/i.test(verb.replace(/\s+/g, ' '));
    if (!okVerb || !['VendorProduct', 'g4d_categories'].includes(t)) {
      throw new Error(`Refusing statement: ${verb} ${target} is outside the allowed write set`);
    }
  }
}

const countOf = (select) => `SELECT count(*)::int AS n FROM (${select}) q`;

module.exports = {
  NUM_RE, TARGET_COLUMNS, NEW_COLUMNS, scopeWhere,
  catalogSelect, retailSelect, insertFrom, categoryDistinctSelect, categoryInsert,
  backfillIndustryUpdate, backfillStatusUpdate, backfillPreviewSelect, typeProbe, countOf, assertWriteAllowed,
};
