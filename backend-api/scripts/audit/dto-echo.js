// Bug B1 class audit (server side).  node scripts/audit/dto-echo.js [--strict]   (needs `npx nest build` first)
//
// For every Update*/Patch* DTO, compare what the DTO accepts with the columns of the table it edits. A form that loads a record and sends it back
// (the Website Manager did) hits "property X should not exist" for every column the DTO does not list. Metadata (id, vendorId, createdAt, updatedAt,
// deletedAt) is stripped for every edit by the EditBodyMiddleware, so only real columns count here.
//   --strict  exit 1 when a DTO is missing columns that the dashboard can edit (the permanent guard uses this with an allow-list)
const fs = require('fs');
const path = require('path');
require('reflect-metadata');
const { getMetadataStorage } = require('class-validator');
const { Prisma } = require('@prisma/client');

const DIST = path.join(__dirname, '..', '..', 'dist', 'src');
// the keys the EditTolerantValidationPipe drops from an edit body (single source: the pipe)
const { ECHOED_READ_ONLY_KEYS } = require(path.join(DIST, 'common', 'pipes', 'edit-validation.pipe'));
const META = new Set(ECHOED_READ_ONLY_KEYS);
// Reviewed: a DTO that deliberately does not accept some column of its table. Each needs the reason.
const REVIEWED = {
  UpdateVendorDto: 'admin-only form; role, status, isSandbox, expiresAt, configOverride and the reseller ids are deliberately NOT editable here (they have their own audited actions)',
  UpdateSessionDto: 'only changed by a status button ({ status } literal in coaching/BatchesView); its batch is fixed when the session is made',
  UpdateCaseDocumentDto: 'only changed by a status button ({ status } literal in finance/CasesView and DocumentsView)',
  UpdateOrderDto: 'restaurant order: only changed by a status button ({ status } literal in restaurant/OrdersView); totals are computed from the items',
  UpdateMemberDto: 'team member: only role and modules are editable (owner-only form); the rest is set by the invitation',
  UpdateCatalogItemDto: 'two different DTOs share this name; the managed-services one edits the platform services catalogue (admin page) not the vendor catalogue table it was matched to',
  UpdatePlatformCmsDto: 'PlatformCMS is stored as key/value rows; this DTO is the flat shape the admin page reads and writes (the page sends only these keys)',
};
// columns that are never edited through a form (computed, set by the server, or edited through their own action), with the reason
const SERVER_OWNED = new Set(['password', 'inviteToken', 'refreshToken', 'status_changed_at', 'industry']);

const walk = (d, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (/\.dto\.js$/.test(e.name)) acc.push(p); } return acc; };
const classes = [];
for (const f of walk(DIST)) {
  let mod; try { mod = require(f); } catch { continue; }
  for (const [name, cls] of Object.entries(mod)) if (typeof cls === 'function' && /^(Update|Patch)/.test(name)) classes.push({ name, cls, file: path.relative(DIST, f) });
}
const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name.toLowerCase(), m]));
const storage = getMetadataStorage();
const rows = [];
for (const { name, cls, file } of classes) {
  const base = name.replace(/^(Update|Patch)/, '').replace(/Dto$/, '').toLowerCase();
  const folder = file.split(path.sep)[0].replace(/-/g, '');
  // the table is named like the DTO, or like the module + the DTO (clinic + Appointment = ClinicAppointment)
  const model = models.get(folder + base) ?? models.get(base) ?? [...models.values()].find((m) => m.name.toLowerCase() === base.replace(/s$/, ''));
  if (!model) continue;
  const metas = storage.getTargetValidationMetadatas(cls, null, false, false);
  const accepted = new Set(metas.map((m) => m.propertyName));
  // inherited (PartialType / extends) properties are included by the storage lookup above
  const scalars = model.fields.filter((f) => f.kind !== 'object' && !META.has(f.name) && !SERVER_OWNED.has(f.name)).map((f) => f.name);
  const missing = scalars.filter((c) => !accepted.has(c));
  rows.push({ dto: name, file, model: model.name, accepted: accepted.size, missing });
}
const bad = rows.filter((r) => r.missing.length && !REVIEWED[r.dto]);
console.log(`update DTOs compared with their table: ${rows.length}; DTOs that would reject some column of the record they edit: ${bad.length} (${rows.filter((r) => r.missing.length && REVIEWED[r.dto]).length} more reviewed as deliberate)`);
for (const r of bad) console.log(`  ${r.dto} (${r.file}) vs ${r.model}: ${r.missing.join(', ')}`);
if (process.argv.includes('--strict') && bad.length) { console.error('FAIL: add the column to the DTO, or review it above with a reason.'); process.exit(1); }
if (process.argv.includes('--strict')) console.log('PASS: every update DTO accepts every editable column of its table.');
