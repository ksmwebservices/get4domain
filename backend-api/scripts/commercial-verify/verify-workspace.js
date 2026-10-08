// Addendum A/F: set-vendor-access (stepnrock only, idempotent, dry-run plan) and notification isolation. The menu itself is checked in
// get4domain_mvp/scripts/verify-workspace-menu.mjs.
const { dist, ok, section, finish, recorder } = require('../security-verify/harness');
const { createMemPrisma } = require('./mem-prisma');
const { planAccess, applyAccess, readCurrent, TARGET } = require('../set-vendor-access-lib');
const { AddonsService } = dist('addons/addons.service');
const { AVAILABLE_ADDONS } = dist('addons/addons.constants');
const { NotificationsService } = dist('notifications/notifications.service');

const seed = () => ({
  vendor: [
    { id: 'v_step', name: 'Suresh', email: 's@x.in', businessName: 'Step N Rock', subdomain: 'stepnrock', createdAt: new Date('2026-05-01T00:00:00Z') },
    { id: 'v_other', name: 'Other', email: 'o@x.in', businessName: 'Other Co', subdomain: 'otherco', createdAt: new Date('2026-05-01T00:00:00Z') },
  ],
  vendorAddon: [{ id: 'a1', vendorId: 'v_other', addonKey: 'fleet', enabled: true }],
  vendorModule: [{ id: 'm1', vendorId: 'v_other', moduleKey: 'growth_hub', enabled: true }, { id: 'm2', vendorId: 'v_step', moduleKey: 'growth_hub', enabled: true }],
  vendorPaymentConfig: [{ id: 'c1', vendorId: 'v_step', enabled: true, razorpayKeyId: 'rzp_test_abc', razorpayKeySecret: 'enc:secret' }, { id: 'c2', vendorId: 'v_other', enabled: false, checkoutMode: 'ONLINE' }],
});

(async () => {
  section('set-vendor-access: plan');
  {
    const prisma = createMemPrisma(seed());
    const cur = await readCurrent(prisma, 'v_step');
    const plan = planAccess(cur);
    ok('a fresh stepnrock needs exactly 4 changes: workspace_menu, website_manager, telecrm, checkoutMode', plan.pending.length === 4 && plan.pending.map((c) => c.key).sort().join() === 'checkoutMode,telecrm,website_manager,workspace_menu', plan.pending.map((c) => c.key).join());
    ok('the dry-run plan itself writes nothing (it is a pure function over what was read)', (await readCurrent(prisma, 'v_step')).addons.length === 0);
    ok('the target is only ever these items', JSON.stringify(Object.keys(TARGET.addons)) === '["workspace_menu"]' && JSON.stringify(Object.keys(TARGET.modules)) === '["website_manager","telecrm"]' && TARGET.checkoutMode === 'ORDER_REQUEST');
  }

  section('set-vendor-access: apply touches stepnrock only');
  {
    const prisma = createMemPrisma(seed());
    const before = JSON.stringify(prisma.$tables);
    const plan = planAccess(await readCurrent(prisma, 'v_step'));
    await applyAccess(prisma, 'v_step', plan);
    const t = prisma.$tables;
    ok('stepnrock now has workspace_menu ON, website_manager ON, telecrm ON', t.vendorAddon.some((a) => a.vendorId === 'v_step' && a.addonKey === 'workspace_menu' && a.enabled) && ['website_manager', 'telecrm'].every((k) => t.vendorModule.some((m) => m.vendorId === 'v_step' && m.moduleKey === k && m.enabled)));
    const cfg = t.vendorPaymentConfig.find((c) => c.vendorId === 'v_step');
    ok('checkout mode is ORDER_REQUEST and the Razorpay keys / enabled flag are exactly as they were', cfg.checkoutMode === 'ORDER_REQUEST' && cfg.razorpayKeyId === 'rzp_test_abc' && cfg.razorpayKeySecret === 'enc:secret' && cfg.enabled === true);
    ok('the OTHER vendor\'s rows are byte-identical (addons, modules, payment config)', JSON.stringify(t.vendorAddon.filter((x) => x.vendorId === 'v_other')) === JSON.stringify(JSON.parse(before).vendorAddon.filter((x) => x.vendorId === 'v_other')) && JSON.stringify(t.vendorModule.filter((x) => x.vendorId === 'v_other')) === JSON.stringify(JSON.parse(before).vendorModule.filter((x) => x.vendorId === 'v_other')) && JSON.stringify(t.vendorPaymentConfig.find((c) => c.vendorId === 'v_other')) === JSON.stringify(JSON.parse(before).vendorPaymentConfig.find((c) => c.vendorId === 'v_other')));
    ok('stepnrock\'s unrelated module (growth_hub) was not changed', t.vendorModule.find((m) => m.vendorId === 'v_step' && m.moduleKey === 'growth_hub').enabled === true);
    ok('an audit entry records what changed', t.commercialAuditLog.some((a) => a.action === 'vendor.access_set' && a.entityId === 'v_step'));
    ok('IDEMPOTENT: planning again shows nothing pending; applying again adds no rows', planAccess(await readCurrent(prisma, 'v_step')).pending.length === 0);
    const rowsBefore = t.vendorAddon.length + t.vendorModule.length;
    await applyAccess(prisma, 'v_step', planAccess(await readCurrent(prisma, 'v_step')));
    ok('…no duplicate rows were created', t.vendorAddon.length + t.vendorModule.length === rowsBefore);

    const addons = new AddonsService(prisma);
    const step = await addons.getVendorAddons('v_step');
    const other = await addons.getVendorAddons('v_other');
    ok('through the real AddonsService: workspace_menu is ON for stepnrock and OFF for every other vendor', step.find((a) => a.key === 'workspace_menu').enabled === true && other.find((a) => a.key === 'workspace_menu').enabled === false);
    ok('workspace_menu is registered as an addon whose default is OFF', AVAILABLE_ADDONS.find((a) => a.key === 'workspace_menu')?.defaultEnabled === false);
  }

  section('notifications: a vendor sees only their own');
  {
    const prisma = createMemPrisma({
      notification: [
        { id: 'n1', recipientId: 'v_step', recipientType: 'VENDOR', type: 'NEW_ORDER', title: 'New order', message: 'x', read: false, createdAt: new Date('2026-10-08T05:00:00Z') },
        { id: 'n2', recipientId: 'v_other', recipientType: 'VENDOR', type: 'NEW_ORDER', title: 'Other shop order', message: 'secret customer', read: false, createdAt: new Date('2026-10-08T06:00:00Z') },
        { id: 'n3', recipientId: '__admin__', recipientType: 'ADMIN', type: 'x', title: 'Admin only', message: 'x', read: false, createdAt: new Date() },
      ],
    });
    const svc = new NotificationsService(prisma, recorder('push'));
    const mine = await svc.findForRecipient('v_step');
    ok('[feat:notifications.own-only] the list contains only this vendor\'s notifications (no other vendor, no admin rows)', mine.length === 1 && mine[0].id === 'n1');
    const cross = await svc.markRead('n2', 'v_step');
    ok('one vendor CANNOT mark another vendor\'s notification read (0 rows changed, still unread)', cross.count === 0 && prisma.$tables.notification.find((n) => n.id === 'n2').read === false);
    const own = await svc.markRead('n1', 'v_step');
    ok('they can mark their own', own.count === 1 && prisma.$tables.notification.find((n) => n.id === 'n1').read === true);
    await svc.markAllRead('v_step');
    ok('mark-all-read stays inside the vendor', prisma.$tables.notification.find((n) => n.id === 'n2').read === false);
    for (let i = 0; i < 130; i += 1) prisma.$tables.notification.push({ id: `bulk${i}`, recipientId: 'v_step', recipientType: 'VENDOR', type: 'x', title: 't', message: 'm', read: true, createdAt: new Date(Date.now() - i * 1000) });
    ok('the list is capped at 100', (await svc.findForRecipient('v_step')).length === 100);
  }
  section('team members: orders and stock need the products (website) area');
  {
    const { Reflector } = require('@nestjs/core');
    const { ModuleGuard } = dist('common/guards/module.guard');
    const { EngineController } = dist('engine/engine.controller');
    const { StockController } = dist('stock/stock.controller');
    const guard = new ModuleGuard(new Reflector());
    const ctx = (cls, method, user) => ({ getHandler: () => cls.prototype[method], getClass: () => cls, switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    const allowed = (cls, method, user) => { try { return guard.canActivate(ctx(cls, method, user)); } catch { return false; } };
    const owner = { kind: 'vendor', sub: 'v1' };
    const withArea = { kind: 'team_member', sub: 'v1', modules: ['website'] };
    const without = { kind: 'team_member', sub: 'v1', modules: ['telecrm'] };
    for (const [cls, name, m] of [[EngineController, 'orders list', 'orders'], [EngineController, 'mark paid', 'markPaid'], [EngineController, 'cancel order', 'cancel'], [StockController, 'adjust stock', 'adjust'], [StockController, 'stock history', 'history'], [StockController, 'low stock', 'low']]) {
      ok(`[feat:team.area-access] ${name}: owner allowed, staff with the products area allowed, staff WITHOUT it refused (403)`, allowed(cls, m, owner) && allowed(cls, m, withArea) && !allowed(cls, m, without));
    }
  }
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
