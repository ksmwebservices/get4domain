import { ActivityBus } from '../src/common/activity-bus';
import { ActivityBusListener, entityOf } from '../src/v3-activity/activity-bus.listener';
import { ActivityService } from '../src/v3-activity/activity.service';
import { ALERT_RULE_SEED, loadAlertRules } from '../src/v3-activity/seed/alert-rules-seed';
import { activityWorld, ActivityWorld, MemoryActivityStore } from './support/memory-activity-store';

/** Slice 5.20: the activity service, the alerts, the rules, the attention board and the rule loader, over the memory twin of the store. */
let w: ActivityWorld;
beforeEach(async () => { w = activityWorld(); await w.seedRules(); });
const staff = { id: 'staff-1', ip: '10.0.0.1' };
const vendorActor = { type: 'VENDOR' as const, id: 'v1', ip: '203.0.113.9' };
const rec = (o: Partial<Parameters<ActivityService['record']>[0]> = {}) => w.activity.record({ vendorId: 'v1', actor: vendorActor, actionKey: 'domain.custom_added', entityType: 'domain', entityId: 'd1', summary: { host: 'shop.example.in' }, ...o });

describe('ActivityService.record()', () => {
  it('stores who, what and on which entity, as VENDOR_USER for a vendor, with the time from the clock', async () => {
    const r = await rec();
    expect(r).toMatchObject({ vendorId: 'v1', actorType: 'VENDOR_USER', actorId: 'v1', actionKey: 'domain.custom_added', entityType: 'domain', entityId: 'd1' });
    expect(r!.at.getTime()).toBe(w.now.t);
  });
  it('keeps only a hash of the address, never the address', async () => {
    const r = await rec();
    expect(r!.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(w.store.activity)).not.toContain('203.0.113.9');
    expect((await rec({ actor: { type: 'SYSTEM', id: null } }))!.ipHash).toBeNull();
  });
  it('masks personal data and drops secrets before the row is stored', async () => {
    await rec({ actionKey: 'payment_method.created', entityType: 'payment_method', summary: { kind: 'UPI', upiPin: '1234', apiKey: 'k', accountNumber: '111122223333', phone: '9876543210', customerName: 'Priya Sharma' } });
    const stored = JSON.stringify(w.store.activity[0].summary);
    for (const bad of ['1234', '"k"', '111122223333', '9876543210', 'Priya Sharma']) expect(stored).not.toContain(bad);
    expect(w.store.activity[0].summary).toMatchObject({ kind: 'UPI' });
  });
  it('never throws into the caller when the database fails: it returns null and stores nothing', async () => {
    w.store.failInsert = true;
    await expect(rec()).resolves.toBeNull();
    expect(w.store.activity).toHaveLength(0);
  });
  it('an alert evaluation fault never loses the activity row', async () => {
    w.store.failRules = true;
    const r = await rec();
    expect(r).not.toBeNull(); expect(w.store.activity).toHaveLength(1); expect(w.store.alerts).toHaveLength(0);
  });
  it('is append-only: neither the service nor the store offers a way to change or remove a row', () => {
    const names = [...Object.getOwnPropertyNames(MemoryActivityStore.prototype), ...Object.getOwnPropertyNames(ActivityService.prototype)];
    expect(names.filter((n) => /^(update|delete|remove|edit|truncate|purge)Activity|^(updateLog|deleteLog)/i.test(n))).toEqual([]);
  });
});

describe('alerts raised by record()', () => {
  it('no rule is on after seeding, so nothing is raised', async () => { await rec(); expect(w.store.alerts).toHaveLength(0); expect(w.store.notifications).toHaveLength(0); });
  it('a rule that is on raises one alert for the vendor with the activity behind it, and tells the roles of the rule', async () => {
    await w.store.updateRule('DOMAIN_CHANGED', { enabled: true }, 's');
    const r = await rec();
    expect(w.store.alerts).toHaveLength(1);
    expect(w.store.alerts[0]).toMatchObject({ vendorId: 'v1', ruleKey: 'DOMAIN_CHANGED', level: 'MEDIUM', status: 'NEW', activityIds: [r!.id], ownerStaffId: null, resolvedAt: null });
    expect(w.store.notifications.map((n) => [n.role, n.kind, n.refId])).toEqual([['SUPER_ADMIN', 'ALERT_MEDIUM', w.store.alerts[0].id], ['OPERATIONS', 'ALERT_MEDIUM', w.store.alerts[0].id]]);
  });
  it('a log-only rule (THEME_SWITCHED) writes the row but never an alert or a notice', async () => {
    await w.store.updateRule('THEME_SWITCHED', { enabled: true }, 's');
    await rec({ actionKey: 'theme.switched', entityType: 'theme' });
    expect(w.store.activity).toHaveLength(1); expect(w.store.alerts).toHaveLength(0); expect(w.store.notifications).toHaveLength(0);
  });
  it('a rule with numbers fires only past the number staff set', async () => {
    await w.store.updateRule('LARGE_IMPORT', { enabled: true, thresholdJson: { rows: 500 } }, 's');
    await rec({ actionKey: 'import.completed', entityType: 'import', summary: { rows: 499 } });
    expect(w.store.alerts).toHaveLength(0);
    await rec({ actionKey: 'import.completed', entityType: 'import', summary: { rows: 500 } });
    expect(w.store.alerts.map((a) => a.ruleKey)).toEqual(['LARGE_IMPORT']);
  });
  it('an alert does nothing else: it carries no field that hides, freezes or deletes, and the service has no such method', async () => {
    await w.store.updateRule('PAYMENT_METHOD_CHANGED', { enabled: true }, 's');
    await rec({ actionKey: 'payment_method.updated', entityType: 'payment_method' });
    expect(Object.keys(w.store.alerts[0]).sort()).toEqual(['activityIds', 'createdAt', 'id', 'level', 'note', 'ownerStaffId', 'resolvedAt', 'ruleKey', 'status', 'updatedAt', 'vendorId']);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(w.alerts)).filter((n) => /hide|delete|freeze|suspend|block/i.test(n))).toEqual([]);
  });
});

describe('the bus listener', () => {
  it('writes every event on the bus to the log, with the entity named by the type and the first id the event carries', async () => {
    const bus = new ActivityBus(); const l = new ActivityBusListener(w.activity, bus); l.onModuleInit();
    await bus.emit({ type: 'wallet.topup.credited', vendorId: 'v1', at: new Date(), actor: { type: 'VENDOR', id: 'v1' }, data: { topupId: 't1', amountPaise: 99900 } });
    await bus.emit({ type: 'theme.restored', vendorId: 'v2', at: new Date(), data: { themeId: 'pro-b' } });
    expect(w.store.activity.map((a) => [a.vendorId, a.actorType, a.actionKey, a.entityType, a.entityId])).toEqual([['v1', 'VENDOR_USER', 'wallet.topup.credited', 'wallet', 't1'], ['v2', 'SYSTEM', 'theme.restored', 'theme', 'pro-b']]);
  });
  it('a failing log never breaks the sender', async () => {
    const bus = new ActivityBus(); new ActivityBusListener(w.activity, bus).onModuleInit(); w.store.failInsert = true;
    await expect(bus.emit({ type: 'pack.purchased', vendorId: 'v1', at: new Date(), data: {} })).resolves.toBeUndefined();
  });
  it('entityOf falls back to the type and no id', () => { expect(entityOf({ type: 'plan.order.paid', vendorId: 'v', at: new Date() })).toEqual({ entityType: 'plan', entityId: null }); });
});

describe('a vendor sees only their own rows (cross-tenant)', () => {
  it('vendor B never sees vendor A\'s activity, and the address hash is not returned', async () => {
    await rec({ vendorId: 'vA', summary: { note: 'A only' } }); await rec({ vendorId: 'vB', summary: { note: 'B only' } });
    const b = await w.activity.myActivity('vB', 1, 25);
    expect(b.total).toBe(1); expect(JSON.stringify(b)).not.toContain('A only'); expect(JSON.stringify(b)).not.toContain('ipHash');
    expect((await w.activity.myActivity('vC', 1, 25)).items).toEqual([]);
  });
  it('rows come newest first and are paged', async () => {
    for (let i = 0; i < 5; i++) { w.now.t += 1000; await rec({ entityId: `e${i}` }); }
    const p1 = await w.activity.myActivity('v1', 1, 2); const p2 = await w.activity.myActivity('v1', 2, 2);
    expect([...p1.items, ...p2.items].map((r) => r.entityId)).toEqual(['e4', 'e3', 'e2', 'e1']); expect(p1.total).toBe(5);
  });
  it('staff see one vendor\'s rows, with the same masking', async () => {
    await rec({ summary: { phone: '9876543210' } });
    const r = await w.activity.vendorActivity('v1', 1, 25);
    expect(r.items).toHaveLength(1); expect(JSON.stringify(r)).not.toContain('9876543210');
  });
});

describe('AlertsService: list and change', () => {
  const raise = async (): Promise<string> => { await w.store.updateRule('DOMAIN_CHANGED', { enabled: true }, 's'); await rec(); return w.store.alerts[w.store.alerts.length - 1].id; };
  it('lists with filters by level, status, vendor and owner', async () => {
    await raise(); await rec({ vendorId: 'v2' });
    await w.store.updateRule('PAYMENT_METHOD_CHANGED', { enabled: true }, 's'); await rec({ actionKey: 'payment_method.created', entityType: 'payment_method' });
    expect((await w.alerts.list({}, 1, 25)).total).toBe(3);
    expect((await w.alerts.list({ level: 'HIGH' }, 1, 25)).total).toBe(1);
    expect((await w.alerts.list({ vendorId: 'v2' }, 1, 25)).total).toBe(1);
    expect((await w.alerts.list({ status: 'RESOLVED' }, 1, 25)).total).toBe(0);
    const id = w.store.alerts[0].id; await w.alerts.update(id, staff, { expectedStatus: 'NEW', ownerStaffId: 'staff-9' });
    expect((await w.alerts.list({ ownerStaffId: 'staff-9' }, 1, 25)).items.map((a) => a.id)).toEqual([id]);
  });
  it('detail returns the alert with the activity behind it, and a missing alert is ALERT_NOT_FOUND', async () => {
    const id = await raise(); const d = await w.alerts.detail(id);
    expect(d.activity.map((a) => a.actionKey)).toEqual(['domain.custom_added']);
    await expect(w.alerts.detail('nope')).rejects.toMatchObject({ response: { code: 'ALERT_NOT_FOUND' } });
  });
  it('NEW to LOOKING to RESOLVED stamps the closing time; reopening clears it; a closed alert can only be looked at again', async () => {
    const id = await raise();
    expect((await w.alerts.update(id, staff, { expectedStatus: 'NEW', status: 'LOOKING', ownerStaffId: 'staff-1' })).resolvedAt).toBeNull();
    w.now.t += 60_000;
    const done = await w.alerts.update(id, staff, { expectedStatus: 'LOOKING', status: 'RESOLVED', note: 'Checked with the vendor' });
    expect(done).toMatchObject({ status: 'RESOLVED', note: 'Checked with the vendor' }); expect(done.resolvedAt!.getTime()).toBe(w.now.t);
    await expect(w.alerts.update(id, staff, { expectedStatus: 'RESOLVED', status: 'NEW' })).rejects.toMatchObject({ response: { code: 'ALERT_INVALID' } });
    expect((await w.alerts.update(id, staff, { expectedStatus: 'RESOLVED', status: 'LOOKING' })).resolvedAt).toBeNull();
  });
  it('NOT_AN_ISSUE closes an alert too', async () => {
    const id = await raise();
    expect(await w.alerts.update(id, staff, { expectedStatus: 'NEW', status: 'NOT_AN_ISSUE' })).toMatchObject({ status: 'NOT_AN_ISSUE', resolvedAt: new Date(w.now.t) });
  });
  it('a change made against a status the alert no longer has is refused (ALERT_STALE) and changes nothing', async () => {
    const id = await raise();
    await w.alerts.update(id, staff, { expectedStatus: 'NEW', status: 'LOOKING' });
    await expect(w.alerts.update(id, { id: 'staff-2', ip: null }, { expectedStatus: 'NEW', status: 'RESOLVED' })).rejects.toMatchObject({ response: { code: 'ALERT_STALE' } });
    expect(w.store.alerts[0].status).toBe('LOOKING');
  });
  it('two changes at once: exactly one wins', async () => {
    const id = await raise();
    const r = await Promise.allSettled([w.alerts.update(id, staff, { expectedStatus: 'NEW', status: 'RESOLVED' }), w.alerts.update(id, staff, { expectedStatus: 'NEW', status: 'NOT_AN_ISSUE' })]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  });
  it('every change is written to the activity log by staff, without the note text', async () => {
    const id = await raise();
    await w.alerts.update(id, staff, { expectedStatus: 'NEW', status: 'LOOKING', note: 'private words' });
    const row = w.store.activity.find((a) => a.actionKey === 'alert.updated')!;
    expect(row).toMatchObject({ actorType: 'STAFF', actorId: 'staff-1', entityType: 'alert', entityId: id });
    expect(JSON.stringify(row.summary)).not.toContain('private words');
  });
  it('changing an alert changes nothing outside the alert (no activity row of the vendor is touched, no new alert)', async () => {
    const id = await raise(); const before = w.store.activity.filter((a) => a.vendorId === 'v1').length;
    await w.alerts.update(id, staff, { expectedStatus: 'NEW', status: 'RESOLVED' });
    expect(w.store.activity.filter((a) => a.vendorId === 'v1' && a.actionKey !== 'alert.updated')).toHaveLength(before);
    expect(w.store.alerts).toHaveLength(1);
  });
});

describe('AlertsService: the rules', () => {
  it('lists the ten seeded rules, all off and with no numbers', async () => {
    const r = await w.alerts.rules();
    expect(r).toHaveLength(10); expect(r.every((x) => !x.enabled && x.thresholdJson === null)).toBe(true);
  });
  it('a rule with no numbers can be switched on, and the change is audited with the staff member', async () => {
    const r = await w.alerts.updateRule('DOMAIN_CHANGED', staff, { enabled: true, notifyRoles: ['OPERATIONS'] });
    expect(r).toMatchObject({ enabled: true, notifyRoles: ['OPERATIONS'], updatedByStaffId: 'staff-1', level: 'MEDIUM' });
    expect(w.store.activity.find((a) => a.actionKey === 'alert_rule.updated')).toMatchObject({ actorType: 'STAFF', vendorId: null, entityId: 'DOMAIN_CHANGED' });
  });
  it('a rule that needs numbers is refused until they are set (no number is invented)', async () => {
    for (const key of ['PAYMENT_FAILURES', 'LARGE_IMPORT', 'CAMPAIGN_SPIKE']) await expect(w.alerts.updateRule(key, staff, { enabled: true })).rejects.toMatchObject({ response: { code: 'ALERT_RULE_NEEDS_THRESHOLD' } });
    expect((await w.store.getRule('LARGE_IMPORT'))!.enabled).toBe(false);
    expect(await w.alerts.updateRule('LARGE_IMPORT', staff, { enabled: true, thresholdJson: { rows: 200 } })).toMatchObject({ enabled: true, thresholdJson: { rows: 200 } });
    expect(await w.alerts.updateRule('CAMPAIGN_SPIKE', staff, { enabled: true, thresholdJson: { stops: 5 } })).toMatchObject({ enabled: true });
  });
  it('the numbers are checked: a name the rule does not have, zero, a fraction or text are refused', async () => {
    await expect(w.alerts.updateRule('LARGE_IMPORT', staff, { thresholdJson: { rowz: 5 } })).rejects.toMatchObject({ response: { code: 'ALERT_RULE_INVALID' } });
    await expect(w.alerts.updateRule('LARGE_IMPORT', staff, { thresholdJson: { rows: 0 } })).rejects.toMatchObject({ response: { code: 'ALERT_RULE_INVALID' } });
    await expect(w.alerts.updateRule('LARGE_IMPORT', staff, { thresholdJson: { rows: 1.5 } })).rejects.toMatchObject({ response: { code: 'ALERT_RULE_INVALID' } });
    await expect(w.alerts.updateRule('LARGE_IMPORT', staff, { thresholdJson: { rows: '5' as unknown as number } })).rejects.toMatchObject({ response: { code: 'ALERT_RULE_INVALID' } });
    await expect(w.alerts.updateRule('DOMAIN_CHANGED', staff, { thresholdJson: { anything: 1 } })).rejects.toMatchObject({ response: { code: 'ALERT_RULE_INVALID' } });
  });
  it('switching off a rule that has numbers is allowed, and removing the numbers of an enabled rule is refused', async () => {
    await w.alerts.updateRule('PAYMENT_FAILURES', staff, { enabled: true, thresholdJson: { count: 3 } });
    await expect(w.alerts.updateRule('PAYMENT_FAILURES', staff, { thresholdJson: null })).rejects.toMatchObject({ response: { code: 'ALERT_RULE_NEEDS_THRESHOLD' } });
    expect((await w.alerts.updateRule('PAYMENT_FAILURES', staff, { enabled: false })).enabled).toBe(false);
  });
  it('an unknown rule, and a role that is not staff, are refused', async () => {
    await expect(w.alerts.updateRule('MADE_UP', staff, { enabled: true })).rejects.toMatchObject({ response: { code: 'ALERT_RULE_UNKNOWN' } });
    await expect(w.alerts.updateRule('DOMAIN_CHANGED', staff, { notifyRoles: ['MARKETING'] })).rejects.toMatchObject({ response: { code: 'ALERT_RULE_INVALID' } });
  });
  it('a rule switched on starts to fire for the next event and not for earlier ones', async () => {
    await rec(); expect(w.store.alerts).toHaveLength(0);
    await w.alerts.updateRule('DOMAIN_CHANGED', staff, { enabled: true });
    await rec(); expect(w.store.alerts).toHaveLength(1);
  });
});

describe('AlertsService: the attention board', () => {
  it('counts NEW alerts by level for each role the rule tells, unread notices per role, and the queues', async () => {
    await w.alerts.updateRule('DOMAIN_CHANGED', staff, { enabled: true, notifyRoles: ['OPERATIONS'] });
    await w.alerts.updateRule('PAYMENT_METHOD_CHANGED', staff, { enabled: true });
    await rec(); await rec({ actionKey: 'payment_method.created', entityType: 'payment_method' });
    w.store.queues.serviceRequestsOpen = 4;
    const a = await w.alerts.attention();
    expect(a.roles.OPERATIONS.alertsNew).toEqual({ HIGH: 1, MEDIUM: 1, LOW: 0 });
    expect(a.roles.SUPER_ADMIN.alertsNew).toEqual({ HIGH: 1, MEDIUM: 0, LOW: 0 });
    expect(a.roles.OPERATIONS.unreadNotifications).toBe(2); expect(a.roles.SUPER_ADMIN.unreadNotifications).toBe(1);
    expect(a.queues).toEqual({ serviceRequestsOpen: 4 });
    expect(Object.keys(a.roles)).not.toContain('MARKETING');
  });
  it('a closed alert no longer counts', async () => {
    await w.alerts.updateRule('DOMAIN_CHANGED', staff, { enabled: true }); await rec();
    await w.alerts.update(w.store.alerts[0].id, staff, { expectedStatus: 'NEW', status: 'RESOLVED' });
    expect((await w.alerts.attention()).roles.OPERATIONS.alertsNew).toEqual({ HIGH: 0, MEDIUM: 0, LOW: 0 });
  });
});

describe('the rule loader', () => {
  const fresh = () => { const s = new MemoryActivityStore(); return { s, port: { existing: async () => (await s.listRules()).map((r) => r.key), create: (rows: Parameters<MemoryActivityStore['createRulesIfMissing']>[0]) => s.createRulesIfMissing(rows) } }; };
  it('a dry run writes nothing and names the ten rules it would create', async () => {
    const { s, port } = fresh(); const r = await loadAlertRules(port, { apply: false });
    expect(r.toCreate).toHaveLength(10); expect(r.created).toEqual([]); expect(s.rules).toHaveLength(0);
  });
  it('apply creates the ten rules disabled, with no numbers, at the owner\'s levels, and tells no role for the log-only rule', async () => {
    const { s, port } = fresh(); await loadAlertRules(port, { apply: true });
    expect(s.rules).toHaveLength(10);
    expect(s.rules.every((x) => !x.enabled && x.thresholdJson === null)).toBe(true);
    expect(Object.fromEntries(s.rules.map((x) => [x.key, x.level]))).toEqual({ PAYMENT_METHOD_CHANGED: 'HIGH', BUSINESS_IDENTITY_CHANGED: 'HIGH', CAMPAIGN_SPIKE: 'HIGH', PAYMENT_FAILURES: 'HIGH', PROHIBITED_TEXT: 'HIGH', DOMAIN_CHANGED: 'MEDIUM', LARGE_IMPORT: 'MEDIUM', PLAN_STATE_CHANGED: 'MEDIUM', LISTING_DELETION_REQUESTED: 'MEDIUM', THEME_SWITCHED: 'LOW' });
    expect(s.rules.find((x) => x.key === 'THEME_SWITCHED')!.notifyRoles).toEqual([]);
  });
  it('run twice, it changes nothing the second time and never overwrites what staff set', async () => {
    const { s, port } = fresh(); await loadAlertRules(port, { apply: true });
    await s.updateRule('LARGE_IMPORT', { enabled: true, thresholdJson: { rows: 99 } }, 'staff');
    const again = await loadAlertRules(port, { apply: true });
    expect(again.created).toEqual([]); expect(again.alreadyThere).toHaveLength(10);
    expect(s.rules.find((x) => x.key === 'LARGE_IMPORT')).toMatchObject({ enabled: true, thresholdJson: { rows: 99 } });
  });
  it('the seed holds exactly the ten rules and no threshold', () => { expect(ALERT_RULE_SEED).toHaveLength(10); expect(JSON.stringify(ALERT_RULE_SEED)).not.toMatch(/threshold|enabled/i); });
});
