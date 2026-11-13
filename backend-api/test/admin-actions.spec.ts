import { AdminActionsService } from '../src/v3-admin-actions/admin-actions.service';
import { HostVisitService } from '../src/v3-admin-actions/host-visits.service';
import { cleanBusinessName, cleanReason, foldCounts, mergeWindowOpen, planCustomerMerge } from '../src/v3-admin-actions/core/admin-actions-core';
import { cleanDay, effectiveWhen, reversibleUntil } from '../src/v3-admin-actions/time';
import { AdminActionsSettings, AdminActionsSettingsService, DEFAULT_ADMIN_ACTIONS_SETTINGS, adminActionsSettingProblem, resolveAdminActionsSettings } from '../src/v3-admin-actions/settings/admin-actions-settings';
import { MemoryAdminActionsStore } from './support/memory-admin-actions-store';

const NOW = new Date('2026-11-14T10:00:00Z'); const STAFF = { type: 'STAFF' as const, id: 's1', ip: null };
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { return (e as { response?: { code?: string } }).response?.code ?? 'ERR'; } };

function make(over: Partial<AdminActionsSettings> = { adminMergeReversalDays: 30 }, withPayee = true) {
  const store = new MemoryAdminActionsStore(); store.vendors.set('v1', { id: 'v1', businessName: 'Acme Stores', email: 'a@x.example' }); store.vendors.set('v2', { id: 'v2', businessName: 'Acme Store (dup)', email: 'b@x.example' });
  const assigned: unknown[] = []; const subscriptions = { assignPlan: async (a: unknown) => { if ((a as { planKey: string }).planKey === 'boom') throw new Error('plan engine refused'); assigned.push(a); return {}; } };
  const checks: Array<[string, string]> = []; const payee = { check: async (v: string, n: string) => { checks.push([v, n]); return 'MISMATCH'; } };
  const settings = { get: async () => ({ ...DEFAULT_ADMIN_ACTIONS_SETTINGS, ...over }) } as unknown as AdminActionsSettingsService;
  const svc = new AdminActionsService(store, subscriptions as never, settings, withPayee ? (payee as never) : undefined); svc.clock = () => NOW;
  return { svc, store, assigned, checks };
}

describe('staff action rules (pure)', () => {
  it('a reason is 5 to 300 characters; a business name is 2 to 120 on one line with no angle brackets', () => {
    expect(cleanReason('  too  short ')).toBe('too short'); expect(cleanReason('abcd')).toBeNull(); expect(cleanReason('x'.repeat(301))).toBeNull(); expect(cleanReason(5)).toBeNull();
    expect(cleanBusinessName('  Priya   Stores ')).toBe('Priya Stores'); for (const bad of ['x', 'a<b>c', 'x'.repeat(121), 'two\nlines'.replace('\n', '\u0007'), 5]) expect(cleanBusinessName(bad)).toBeNull();
  });
  it('an effective date: no date or not in the future is now; a later one waits; a made-up one is refused', () => {
    expect(effectiveWhen(undefined, NOW)).toEqual({ when: 'NOW' }); expect(effectiveWhen('2026-11-13', NOW)).toEqual({ when: 'NOW' }); expect(effectiveWhen('2026-11-14T10:00:00Z', NOW)).toEqual({ when: 'NOW' });
    expect(effectiveWhen('2026-12-01', NOW)).toEqual({ when: 'LATER', at: new Date('2026-12-01') }); for (const bad of ['tomorrow', '2026-13-45', '01/12/2026', 5, {}]) expect(effectiveWhen(bad, NOW)).toBeNull();
  });
  it('a merge moves a contact unless the kept business already has that phone or email; moved keys count as taken', () => {
    const keep = [{ id: 'k1', phoneKey: '91111', emailKey: null }, { id: 'k2', phoneKey: null, emailKey: 'a@x' }];
    const merge = [{ id: 'm1', phoneKey: '91111', emailKey: null }, { id: 'm2', phoneKey: '92222', emailKey: 'a@x' }, { id: 'm3', phoneKey: '93333', emailKey: null }, { id: 'm4', phoneKey: '93333', emailKey: null }, { id: 'm5', phoneKey: null, emailKey: null }];
    const p = planCustomerMerge(keep, merge); expect(p.move).toEqual(['m3', 'm5']); expect(p.conflicts).toEqual([{ id: 'm1', because: 'PHONE' }, { id: 'm2', because: 'EMAIL' }, { id: 'm4', because: 'PHONE' }]);
    expect(p).toMatchObject({ keepCount: 2, mergeCount: 5 });
  });
  it('the undo window and the day helpers', () => {
    const until = reversibleUntil(NOW, 30); expect(until.toISOString()).toBe('2026-12-14T10:00:00.000Z'); expect(mergeWindowOpen(until.getTime(), NOW.getTime())).toBe(true); expect(mergeWindowOpen(until.getTime(), new Date('2026-12-14T10:00:01Z').getTime())).toBe(false);
    expect(cleanDay('2026-11-14')).toBe('2026-11-14'); expect(cleanDay('2026-02-30')).toBeNull(); expect(cleanDay('x')).toBeNull(); expect(foldCounts(new Map([['a.example', 3], ['b.example', 0]]), '2026-11-14')).toEqual([{ host: 'a.example', day: '2026-11-14', count: 3 }]);
  });
  it('settings: merging is off until the days are set; the days are whole numbers', () => {
    expect(resolveAdminActionsSettings(new Map()).adminMergeReversalDays).toBeNull(); expect(adminActionsSettingProblem('adminMergeReversalDays', 0)).not.toBeNull(); expect(adminActionsSettingProblem('adminMergeReversalDays', 30)).toBeNull(); expect(resolveAdminActionsSettings(new Map([['adminMergeReversalDays', -2]])).adminMergeReversalDays).toBeNull();
  });
});

describe('A2: the business name', () => {
  it('changes the name, keeps the old one in the history, and re-runs the payee check on each UPI payee', async () => {
    const { svc, store, checks } = make(); store.payees.set('v1', ['Acme Stores Pvt', 'Acme Pay']);
    const r = await svc.changeBusinessName('v1', STAFF, { businessName: ' Acme   Traders ', reason: 'Owner asked in writing' });
    expect(r).toEqual({ vendorId: 'v1', oldName: 'Acme Stores', newName: 'Acme Traders', payeeChecksRun: 2 }); expect(store.vendors.get('v1')!.businessName).toBe('Acme Traders'); expect(checks).toEqual([['v1', 'Acme Stores Pvt'], ['v1', 'Acme Pay']]);
    expect((await svc.nameHistory('v1', 1, 10)).items).toMatchObject([{ oldName: 'Acme Stores', newName: 'Acme Traders', reason: 'Owner asked in writing', changedBy: 's1' }]);
  });
  it('needs a reason and a valid, different name for a business that exists; another business is untouched', async () => {
    const { svc, store } = make();
    expect(await code(svc.changeBusinessName('v1', STAFF, { businessName: 'New Name', reason: 'no' }))).toBe('ADMIN_INVALID'); expect(await code(svc.changeBusinessName('v1', STAFF, { businessName: 'x', reason: 'a good reason' }))).toBe('ADMIN_INVALID');
    expect(await code(svc.changeBusinessName('v1', STAFF, { businessName: 'Acme Stores', reason: 'a good reason' }))).toBe('ADMIN_NO_CHANGE'); expect(await code(svc.changeBusinessName('nope', STAFF, { businessName: 'New Name', reason: 'a good reason' }))).toBe('ADMIN_VENDOR_NOT_FOUND');
    expect(store.history).toHaveLength(0); expect(store.vendors.get('v2')!.businessName).toBe('Acme Store (dup)');
  });
  it('a payee check that fails never undoes the rename; with no check bound it simply runs none', async () => {
    const a = make(undefined, false); expect((await a.svc.changeBusinessName('v1', STAFF, { businessName: 'Acme Traders', reason: 'a good reason' })).payeeChecksRun).toBe(0);
    const b = make(); b.store.payees.set('v1', ['X']); (b.svc as unknown as { payee: { check: () => Promise<never> } }).payee = { check: async () => { throw new Error('down'); } };
    expect((await b.svc.changeBusinessName('v1', STAFF, { businessName: 'Acme Traders', reason: 'a good reason' })).newName).toBe('Acme Traders');
  });
});

describe('A1: a plan change with an effective date', () => {
  it('now: goes through the one plan assignment at once and is recorded as APPLIED', async () => {
    const { svc, assigned, store } = make(); const r = await svc.requestPlanChange('v1', STAFF, { planKey: 'pro_plan', termMonths: 12, reason: 'Paid by bank transfer' });
    expect(r).toMatchObject({ status: 'APPLIED', planKey: 'pro_plan', termMonths: 12 }); expect(assigned).toMatchObject([{ vendorId: 'v1', planKey: 'pro_plan', termMonths: 12, source: 'STAFF', reason: 'Paid by bank transfer' }]); expect(store.changes).toHaveLength(1);
  });
  it('a later date is stored PENDING and assigns nothing yet; the job applies it once its date has come, once', async () => {
    const { svc, assigned, store } = make(); const r = await svc.requestPlanChange('v1', STAFF, { planKey: 'free_plan', effectiveAt: '2026-12-01', reason: 'Plan ends then' });
    expect(r).toMatchObject({ status: 'PENDING', planKey: 'free_plan' }); expect(assigned).toHaveLength(0);
    expect(await svc.applyDuePlanChanges()).toEqual({ applied: 0, failed: 0 });
    svc.clock = () => new Date('2026-12-01T00:00:01Z'); expect(await svc.applyDuePlanChanges()).toEqual({ applied: 1, failed: 0 }); expect(assigned).toMatchObject([{ planKey: 'free_plan', actor: { type: 'SYSTEM' } }]);
    expect(await svc.applyDuePlanChanges()).toEqual({ applied: 0, failed: 0 }); expect(store.changes[0].status).toBe('APPLIED'); expect(assigned).toHaveLength(1);
  });
  it('two job runs at once apply it once', async () => {
    const { svc, assigned } = make(); await svc.requestPlanChange('v1', STAFF, { planKey: 'pro_plan', effectiveAt: '2026-12-01', reason: 'Scheduled upgrade' }); svc.clock = () => new Date('2026-12-02T00:00:00Z');
    const r = await Promise.all([svc.applyDuePlanChanges(), svc.applyDuePlanChanges()]); expect(r.reduce((n, x) => n + x.applied, 0)).toBe(1); expect(assigned).toHaveLength(1);
  });
  it('a change the plan engine refuses is recorded FAILED with the reason and does not stop the others', async () => {
    const { svc, store, assigned } = make(); store.plans.add('boom');
    await svc.requestPlanChange('v1', STAFF, { planKey: 'boom', effectiveAt: '2026-12-01', reason: 'This one will fail' }); await svc.requestPlanChange('v2', STAFF, { planKey: 'pro_plan', effectiveAt: '2026-12-01', reason: 'This one will work' });
    svc.clock = () => new Date('2026-12-02T00:00:00Z'); expect(await svc.applyDuePlanChanges()).toEqual({ applied: 1, failed: 1 });
    expect(store.changes.find((c) => c.planKey === 'boom')).toMatchObject({ status: 'FAILED', error: 'plan engine refused' }); expect(assigned).toHaveLength(1);
  });
  it('a waiting change can be cancelled and then never applies; an applied or cancelled one cannot be cancelled', async () => {
    const { svc, assigned, store } = make(); const c = await svc.requestPlanChange('v1', STAFF, { planKey: 'pro_plan', effectiveAt: '2026-12-01', reason: 'Scheduled upgrade' });
    expect((await svc.cancelPlanChange(c.id)).status).toBe('CANCELLED'); expect(await code(svc.cancelPlanChange(c.id))).toBe('ADMIN_PLAN_CHANGE_STATE'); svc.clock = () => new Date('2026-12-02T00:00:00Z'); await svc.applyDuePlanChanges(); expect(assigned).toHaveLength(0);
    expect(await code(svc.cancelPlanChange('nope'))).toBe('ADMIN_PLAN_CHANGE_NOT_FOUND'); const now = await svc.requestPlanChange('v1', STAFF, { planKey: 'pro_plan', reason: 'Paid by bank transfer' }); expect(await code(svc.cancelPlanChange(now.id))).toBe('ADMIN_PLAN_CHANGE_STATE'); expect(store.changes).toHaveLength(2);
  });
  it('validates: a reason, a real plan, a whole-month term, a real date, a business that exists', async () => {
    const { svc } = make(); const ok = { planKey: 'pro_plan', reason: 'a good reason' };
    expect(await code(svc.requestPlanChange('v1', STAFF, { ...ok, reason: 'no' }))).toBe('ADMIN_INVALID'); expect(await code(svc.requestPlanChange('v1', STAFF, { ...ok, planKey: 'No Such!' }))).toBe('ADMIN_INVALID');
    expect(await code(svc.requestPlanChange('v1', STAFF, { ...ok, planKey: 'ghost_plan' }))).toBe('ADMIN_PLAN_UNKNOWN'); expect(await code(svc.requestPlanChange('v1', STAFF, { ...ok, termMonths: 0 }))).toBe('ADMIN_INVALID');
    expect(await code(svc.requestPlanChange('v1', STAFF, { ...ok, effectiveAt: 'next week' }))).toBe('ADMIN_INVALID'); expect(await code(svc.requestPlanChange('nope', STAFF, ok))).toBe('ADMIN_VENDOR_NOT_FOUND');
  });
});

describe('A4: merging two listings (contacts only)', () => {
  const people = (s: MemoryAdminActionsStore) => { for (const [id, vendorId, phoneKey] of [['k1', 'v1', '91111'], ['m1', 'v2', '91111'], ['m2', 'v2', '92222'], ['m3', 'v2', '93333']] as const) s.customers.set(id, { id, vendorId, phoneKey, emailKey: null }); };
  it('is OFF until staff set the undo window: nothing moves, and the plan says it is off', async () => {
    const { svc, store } = make({ adminMergeReversalDays: null }); people(store);
    expect(await code(svc.merge(STAFF, { keepVendorId: 'v1', mergedVendorId: 'v2', reason: 'Same shop twice' }))).toBe('ADMIN_MERGE_NOT_ENABLED'); expect(store.customers.get('m2')!.vendorId).toBe('v2');
    expect(await svc.planMerge('v1', 'v2')).toMatchObject({ enabled: false, wouldMoveCustomers: 2, conflicts: [{ id: 'm1', because: 'PHONE' }] });
  });
  it('the plan changes nothing; the merge moves the contacts that are not already there, reports the rest, and records the window', async () => {
    const { svc, store } = make(); people(store);
    expect(await svc.planMerge('v1', 'v2')).toMatchObject({ enabled: true, wouldMoveCustomers: 2 }); expect([...store.customers.values()].filter((c) => c.vendorId === 'v1')).toHaveLength(1);
    const m = await svc.merge(STAFF, { keepVendorId: 'v1', mergedVendorId: 'v2', reason: 'Same shop twice' });
    expect(m).toMatchObject({ status: 'APPLIED', movedCustomers: 2, conflicts: [{ id: 'm1', because: 'PHONE' }], reversibleUntil: new Date('2026-12-14T10:00:00Z') });
    expect([...store.customers.values()].filter((c) => c.vendorId === 'v1').map((c) => c.id).sort()).toEqual(['k1', 'm2', 'm3']); expect(store.customers.get('m1')!.vendorId).toBe('v2');
  });
  it('a merge that cannot be completed moves nothing and says so', async () => {
    const { svc, store } = make(); people(store); store.failMerge = true;
    expect(await code(svc.merge(STAFF, { keepVendorId: 'v1', mergedVendorId: 'v2', reason: 'Same shop twice' }))).toBe('ADMIN_MERGE_STATE'); expect(store.merges).toHaveLength(0); expect(store.customers.get('m2')!.vendorId).toBe('v2');
  });
  it('validates: two different listings that exist, a reason', async () => {
    const { svc } = make();
    expect(await code(svc.merge(STAFF, { keepVendorId: 'v1', mergedVendorId: 'v1', reason: 'Same shop twice' }))).toBe('ADMIN_MERGE_INVALID'); expect(await code(svc.merge(STAFF, { keepVendorId: 'v1', mergedVendorId: 'nope', reason: 'Same shop twice' }))).toBe('ADMIN_VENDOR_NOT_FOUND');
    expect(await code(svc.merge(STAFF, { keepVendorId: 'v1', mergedVendorId: 'v2', reason: 'no' }))).toBe('ADMIN_INVALID'); expect(await code(svc.merge(STAFF, { keepVendorId: undefined, mergedVendorId: 'v2', reason: 'Same shop twice' }))).toBe('ADMIN_MERGE_INVALID');
  });
  it('undo within the window sends back the contacts that are still on the kept listing, and says how many were not; a second undo is refused', async () => {
    const { svc, store } = make(); people(store); const m = await svc.merge(STAFF, { keepVendorId: 'v1', mergedVendorId: 'v2', reason: 'Same shop twice' });
    store.customers.get('m3')!.vendorId = 'v9';   // changed hands since: not restored
    expect(await svc.reverseMerge(STAFF, m.id, 'Merged the wrong shops')).toEqual({ id: m.id, status: 'REVERSED', restoredCustomers: 1, notRestored: 1 }); expect(store.customers.get('m2')!.vendorId).toBe('v2');
    expect(await code(svc.reverseMerge(STAFF, m.id, 'Merged the wrong shops'))).toBe('ADMIN_MERGE_STATE');
  });
  it('after the window ends the merge cannot be undone; an unknown merge is not found; a reason is needed', async () => {
    const { svc, store } = make(); people(store); const m = await svc.merge(STAFF, { keepVendorId: 'v1', mergedVendorId: 'v2', reason: 'Same shop twice' });
    expect(await code(svc.reverseMerge(STAFF, m.id, 'no'))).toBe('ADMIN_INVALID'); expect(await code(svc.reverseMerge(STAFF, 'nope', 'Merged the wrong shops'))).toBe('ADMIN_MERGE_NOT_FOUND');
    svc.clock = () => new Date('2026-12-14T10:00:01Z'); expect(await code(svc.reverseMerge(STAFF, m.id, 'Merged the wrong shops'))).toBe('ADMIN_MERGE_WINDOW_ENDED'); expect((await svc.listMerges('v2', 1, 10)).total).toBe(1);
  });
  it('money history stays where it is: the merge touches contacts only (a static check of the store)', async () => {
    const fs = await import('fs'); const path = await import('path'); const t = fs.readFileSync(path.resolve(__dirname, '../src/v3-admin-actions/prisma-admin-actions.store.ts'), 'utf8');
    const merged = t.slice(t.indexOf('async applyMerge'), t.indexOf('async getMerge')); expect(merged).not.toMatch(/v3SaleRecord|v3Payment|v3Order|v3Wallet|v3Job|v3Quote|v3Item\b|v3Expense|ledger|payment/i);
  });
});

describe('per-host visit counts', () => {
  function visits(resolve: (h: string) => string | null = (h) => (h.endsWith('.get4domain.com') ? 'v1' : h === 'shop.example.com' ? 'v1' : null)) {
    const store = new MemoryAdminActionsStore(); store.vendors.set('v1', { id: 'v1', businessName: 'Acme', email: 'a@x.example' });
    const svc = new HostVisitService(store, { resolveHost: async (h: string) => { const v = resolve(h); return v ? ({ vendorId: v } as never) : null; } } as never); svc.clock = () => NOW; return { svc, store };
  }
  it('counts pages per host in memory and writes them per host and day, for the business that owns the host', async () => {
    const { svc, store } = visits(); for (let i = 0; i < 3; i++) svc.record('Acme.Get4Domain.com'); svc.record('shop.example.com'); svc.record('unknown.example.org');
    expect(svc.pending()).toBe(5); expect(await svc.flush()).toBe(4); expect(svc.pending()).toBe(0);
    expect(store.visits).toEqual([{ vendorId: 'v1', host: 'acme.get4domain.com', day: '2026-11-14', count: 3 }, { vendorId: 'v1', host: 'shop.example.com', day: '2026-11-14', count: 1 }]);
    svc.record('acme.get4domain.com'); await svc.flush(); expect(store.visits[0].count).toBe(4);
  });
  it('a bad host name is not counted; a failed write puts the counts back; nothing is lost across a flush that fails', async () => {
    const { svc, store } = visits(); svc.record('bad host!'); svc.record('<script>'); svc.record(''); expect(svc.pending()).toBe(0);
    svc.record('shop.example.com'); const real = store.addVisits.bind(store); store.addVisits = async () => { throw new Error('db down'); }; expect(await svc.flush()).toBe(0); expect(svc.pending()).toBe(1);
    store.addVisits = real; expect(await svc.flush()).toBe(1); expect(store.visits).toHaveLength(1);
  });
  it('the report is per host per day, counts only, defaults to 30 days, refuses bad dates and unknown businesses', async () => {
    const { svc, store } = visits(); store.visits.push({ vendorId: 'v1', host: 'a.get4domain.com', day: '2026-11-13', count: 5 }, { vendorId: 'v1', host: 'a.get4domain.com', day: '2026-11-14', count: 2 }, { vendorId: 'v1', host: 'shop.example.com', day: '2026-11-14', count: 9 }, { vendorId: 'v1', host: 'old.example.com', day: '2026-09-01', count: 99 });
    const r = await svc.report('v1', {}); expect(r.total).toBe(16); expect(r.hosts.map((h) => h.host)).toEqual(['shop.example.com', 'a.get4domain.com']); expect(r.hosts[1].days).toEqual([{ day: '2026-11-13', count: 5 }, { day: '2026-11-14', count: 2 }]);
    expect(Object.keys(r).sort()).toEqual(['from', 'hosts', 'note', 'to', 'total']); expect(Object.keys(r.hosts[0]).sort()).toEqual(['days', 'host', 'total']);   // counts and hosts only
    expect(await code(svc.report('v1', { from: '2026-11-14', to: '2026-11-01' }))).toBe('ADMIN_INVALID'); expect(await code(svc.report('v1', { from: 'x' }))).toBe('ADMIN_INVALID'); expect(await code(svc.report('nope', {}))).toBe('ADMIN_VENDOR_NOT_FOUND');
  });
});
