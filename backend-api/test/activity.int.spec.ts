// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { OtpPepper } from '../src/directory/pepper';
import { ActivityService, AlertsService } from '../src/v3-activity/activity.service';
import { PrismaActivityStore } from '../src/v3-activity/prisma-activity.store';
import { cleanupTenants, newPrisma, seedTenant, SeededTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Slice 5.20 on STAGING: the activity log trigger, the table constraints and the Prisma store against the real database. NOT RUN in the build session that wrote it (no .env.staging there).
 * It touches no real alert rule: the one rule it needs has a key of its own (V3TEST_<run id>) and is deleted afterwards.
 */
jest.setTimeout(180_000);

describe('activity log and alerts on staging', () => {
  let prisma: PrismaClient; let store: PrismaActivityStore; let activity: ActivityService; let alerts: AlertsService; let a: SeededTenant; let b: SeededTenant;
  const ruleKey = `V3TEST_${RUN_ID}`;

  beforeAll(async () => {
    prisma = newPrisma(); store = new PrismaActivityStore(prisma as unknown as PrismaService); activity = new ActivityService(store, new OtpPepper()); alerts = new AlertsService(store, activity);
    a = await seedTenant(prisma, 'p520a', RUN_ID); b = await seedTenant(prisma, 'p520b', RUN_ID);
  }, 240000);

  afterAll(async () => {
    // the vendors go first: the append-only trigger allows a delete only once the vendor row is gone
    await runCleanup([
      () => cleanupTenants(prisma, RUN_ID),
      () => prisma.v3AlertRule.deleteMany({ where: { key: ruleKey } }),
      () => prisma.v3ActivityLog.deleteMany({ where: { entityId: ruleKey } }),
      () => prisma.$disconnect(),
    ]);
  }, 180000);

  it('stores a masked row with a hashed address, for the signed-in vendor only', async () => {
    const r = await activity.record({ vendorId: a.vendorId, actor: { type: 'VENDOR', id: a.vendorId, ip: '203.0.113.9' }, actionKey: 'domain.custom_added', entityType: 'domain', entityId: 'd1', summary: { phone: '9876543210', host: 'shop.example.in' } });
    expect(r).not.toBeNull();
    const row = await prisma.v3ActivityLog.findUniqueOrThrow({ where: { id: r!.id } });
    expect(row.actorType).toBe('VENDOR_USER'); expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/); expect(JSON.stringify(row)).not.toMatch(/9876543210|203\.0\.113\.9/);
    expect((await activity.myActivity(b.vendorId, 1, 25)).items.map((x) => x.id)).not.toContain(r!.id);
    expect((await activity.myActivity(a.vendorId, 1, 25)).items.map((x) => x.id)).toContain(r!.id);
  });

  it('the database refuses to change or delete an activity row while its vendor exists (the trigger)', async () => {
    const r = await activity.record({ vendorId: a.vendorId, actor: { type: 'SYSTEM', id: null }, actionKey: 'plan.state_changed', entityType: 'plan', summary: {} });
    await expect(prisma.v3ActivityLog.update({ where: { id: r!.id }, data: { actionKey: 'x' } })).rejects.toThrow(/cannot be changed/);
    await expect(prisma.v3ActivityLog.delete({ where: { id: r!.id } })).rejects.toThrow(/cannot be deleted/);
    await expect(prisma.$executeRawUnsafe(`UPDATE "g4d_activity_log" SET "actionKey" = 'x' WHERE "vendorId" = '${a.vendorId}'`)).rejects.toThrow(/cannot be changed/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "g4d_activity_log" WHERE "vendorId" = '${a.vendorId}'`)).rejects.toThrow(/cannot be deleted/);
  });

  it('a rule with its own key: an alert is raised, the notices are written, the closing time is enforced by the database', async () => {
    await store.createRulesIfMissing([{ key: ruleKey, level: 'MEDIUM', notifyRoles: ['OPERATIONS'] }]);
    expect((await prisma.v3AlertRule.findUniqueOrThrow({ where: { key: ruleKey } })).enabled).toBe(false);
    const alert = await store.insertAlert({ vendorId: a.vendorId, ruleKey, level: 'MEDIUM', activityIds: [] });
    await store.insertNotification({ userId: null, role: 'OPERATIONS', kind: 'ALERT_MEDIUM', refId: alert.id });
    await expect(prisma.v3Alert.update({ where: { id: alert.id }, data: { status: 'RESOLVED' } })).rejects.toThrow(/g4d_alerts_resolved_chk/);
    await expect(prisma.v3Alert.update({ where: { id: alert.id }, data: { resolvedAt: new Date() } })).rejects.toThrow(/g4d_alerts_resolved_chk/);
    await expect(prisma.v3Notification.create({ data: { kind: 'X' } })).rejects.toThrow(/g4d_v3_notifications_target_chk/);
    const closed = await alerts.update(alert.id, { id: null, ip: null }, { expectedStatus: 'NEW', status: 'RESOLVED', note: 'checked' });
    expect(closed.resolvedAt).not.toBeNull();
    await expect(alerts.update(alert.id, { id: null, ip: null }, { expectedStatus: 'NEW', status: 'LOOKING' })).rejects.toMatchObject({ response: { code: 'ALERT_STALE' } });
  });

  it('two staff changing the same alert at once: exactly one wins', async () => {
    const alert = await store.insertAlert({ vendorId: a.vendorId, ruleKey, level: 'MEDIUM', activityIds: [] });
    const r = await Promise.allSettled([alerts.update(alert.id, { id: null, ip: null }, { expectedStatus: 'NEW', status: 'RESOLVED' }), alerts.update(alert.id, { id: null, ip: null }, { expectedStatus: 'NEW', status: 'NOT_AN_ISSUE' })]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  });

  it('the attention board counts from the real tables', async () => {
    const att = await alerts.attention();
    expect(Object.keys(att.roles).sort()).toEqual(['OPERATIONS', 'SUPER_ADMIN']); expect(typeof att.queues.serviceRequestsOpen).toBe('number');
  });
});
