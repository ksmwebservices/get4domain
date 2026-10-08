'use strict';
// Pure planning + apply logic for scripts/set-vendor-access.js (kept separate so the verify suite can run it against a fake database).
//
// It sets up ONE vendor — Step N Rock (subdomain "stepnrock") — as a Workspace shop:
//   * addon  workspace_menu = ON       (dashboard shows only the Workspace menu; see get4domain_mvp/src/lib/workspace-menu.ts)
//   * module website_manager = ON      (My Products, Stock, Orders, Website Manager)
//   * module telecrm = ON              (Leads / call list)
//   * checkout mode = ORDER_REQUEST    (orders are requests; no online payment yet)
// Nothing else is read or written: no other vendor, no payment keys, no modules/addons beyond these.

const ONLY_SUBDOMAIN = 'stepnrock';
const TARGET = {
  addons: { workspace_menu: true },
  modules: { website_manager: true, telecrm: true },
  checkoutMode: 'ORDER_REQUEST',
};
const CONFIRM = 'I_HAVE_READ_THE_DRY_RUN';

/** @param {{ addons: {addonKey:string,enabled:boolean}[], modules: {moduleKey:string,enabled:boolean}[], paymentConfig: {checkoutMode:string|null}|null }} cur */
function planAccess(cur) {
  const changes = [];
  for (const [key, want] of Object.entries(TARGET.addons)) {
    const row = cur.addons.find((a) => a.addonKey === key);
    changes.push({ kind: 'addon', key, from: row ? row.enabled : 'not set (default off)', to: want, needed: !row || row.enabled !== want });
  }
  for (const [key, want] of Object.entries(TARGET.modules)) {
    const row = cur.modules.find((m) => m.moduleKey === key);
    changes.push({ kind: 'module', key, from: row ? row.enabled : 'not set (default off)', to: want, needed: !row || row.enabled !== want });
  }
  const mode = cur.paymentConfig ? cur.paymentConfig.checkoutMode : null;
  changes.push({ kind: 'checkoutMode', key: 'checkoutMode', from: mode ?? 'not set', to: TARGET.checkoutMode, needed: mode !== TARGET.checkoutMode });
  return { changes, pending: changes.filter((c) => c.needed) };
}

/** Writes exactly the pending changes for ONE vendor id, in one transaction, with an audit entry. */
async function applyAccess(prisma, vendorId, plan, actor = 'script:set-vendor-access') {
  await prisma.$transaction(async (tx) => {
    for (const c of plan.pending) {
      if (c.kind === 'addon') {
        await tx.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId, addonKey: c.key } }, create: { vendorId, addonKey: c.key, enabled: c.to }, update: { enabled: c.to } });
      } else if (c.kind === 'module') {
        await tx.vendorModule.upsert({ where: { vendorId_moduleKey: { vendorId, moduleKey: c.key } }, create: { vendorId, moduleKey: c.key, enabled: c.to }, update: { enabled: c.to } });
      } else if (c.kind === 'checkoutMode') {
        // Only the mode column: keys / enabled flag are left exactly as they are.
        await tx.vendorPaymentConfig.upsert({ where: { vendorId }, create: { vendorId, checkoutMode: c.to }, update: { checkoutMode: c.to } });
      }
    }
    await tx.commercialAuditLog.create({ data: { actor, actorRole: 'system', action: 'vendor.access_set', entityType: 'Vendor', entityId: vendorId, detail: { changes: plan.pending.map((c) => ({ [c.kind]: c.key, from: c.from, to: c.to })) } } });
  });
}

async function readCurrent(prisma, vendorId) {
  const [addons, modules, paymentConfig] = await Promise.all([
    prisma.vendorAddon.findMany({ where: { vendorId, addonKey: { in: Object.keys(TARGET.addons) } } }),
    prisma.vendorModule.findMany({ where: { vendorId, moduleKey: { in: Object.keys(TARGET.modules) } } }),
    prisma.vendorPaymentConfig.findUnique({ where: { vendorId } }),
  ]);
  return { addons, modules, paymentConfig };
}

// ── Dashboard v2 switch (Release 1A): `--nav-v2 on|off --vendor <subdomain>`. Touches ONLY the nav_v2 add-on of the ONE named vendor. ──
/** @param {{ row: {enabled:boolean}|null, defaultOn: boolean }} cur  defaultOn = what the vendor gets without a row (ON for vendors created on/after NAV_V2_DEFAULT_FROM) */
function planNavV2(cur, want) {
  const effective = cur.row ? cur.row.enabled : cur.defaultOn;
  const change = { kind: 'addon', key: 'nav_v2', from: cur.row ? cur.row.enabled : `not set (default ${cur.defaultOn ? 'on' : 'off'})`, to: want, needed: effective !== want };
  return { changes: [change], pending: change.needed ? [change] : [] };
}

async function readNavV2(prisma, vendorId, defaultFromIso) {
  const [row, vendor] = await Promise.all([
    prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId, addonKey: 'nav_v2' } } }),
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { createdAt: true } }),
  ]);
  return { row, defaultOn: Boolean(vendor && vendor.createdAt.getTime() >= new Date(defaultFromIso).getTime()) };
}

async function applyNavV2(prisma, vendorId, plan, actor = 'script:set-vendor-access') {
  await prisma.$transaction(async (tx) => {
    for (const c of plan.pending) {
      await tx.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId, addonKey: 'nav_v2' } }, create: { vendorId, addonKey: 'nav_v2', enabled: c.to }, update: { enabled: c.to } });
    }
    await tx.commercialAuditLog.create({ data: { actor, actorRole: 'system', action: 'vendor.nav_v2_set', entityType: 'Vendor', entityId: vendorId, detail: { changes: plan.pending.map((c) => ({ addon: c.key, from: c.from, to: c.to })) } } });
  });
}

module.exports = { planAccess, applyAccess, readCurrent, planNavV2, readNavV2, applyNavV2, ONLY_SUBDOMAIN, TARGET, CONFIRM };
