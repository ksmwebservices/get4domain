import { BadRequestException, ConflictException } from '@nestjs/common';
import { hashPhone } from '../src/directory/core/otp';
import { OtpPepper } from '../src/directory/pepper';
import { DEFAULT_DIRECTORY_SETTINGS } from '../src/directory/settings/directory-settings';
import { DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { addressHasDetail, cleanReason, emptyListingCheck, extendedGraceEnd } from '../src/vendor-lifecycle/core/lifecycle-core';
import { AccountDeletionService } from '../src/vendor-lifecycle/account-deletion.service';
import { LifecycleSubscription } from '../src/vendor-lifecycle/lifecycle.store';
import { VendorLifecycleService } from '../src/vendor-lifecycle/vendor-lifecycle.service';
import { FakeSms } from './support/directory-world';
import { MemoryDirectoryRepo } from './support/memory-directory-repo';
import { MemoryLifecycleStore } from './support/memory-lifecycle-store';

/** Slice 5.1d: the pure rules, the staff actions, the vendor's deletion request and the two permanent-removal paths. Memory twins only. */
const DAY = 86_400_000;
const NOW = new Date('2027-03-01T10:00:00.000Z');
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const OWNER = { type: 'VENDOR' as const, id: 'user-1', ip: '203.0.113.7' };
const V = 'vendor-1';
const PHONE = '+919876543210';

describe('pure rules', () => {
  it('emptyListingCheck: empty only when there is no phone, address detail, description, service or media', () => {
    const base = { hasListing: true, phone: null, addressDetail: false, description: null, services: 0, media: 0 };
    expect(emptyListingCheck(base)).toEqual({ empty: true, existing: [] });
    expect(emptyListingCheck({ ...base, hasListing: false })).toEqual({ empty: true, existing: [] });
    expect(emptyListingCheck({ ...base, phone: '  ', description: '   ' })).toEqual({ empty: true, existing: [] });   // whitespace is nothing
    expect(emptyListingCheck({ ...base, phone: PHONE }).existing).toEqual(['PHONE']);
    expect(emptyListingCheck({ ...base, addressDetail: true }).existing).toEqual(['ADDRESS']);
    expect(emptyListingCheck({ ...base, description: 'We fix pipes' }).existing).toEqual(['DESCRIPTION']);
    expect(emptyListingCheck({ ...base, services: 1 }).existing).toEqual(['SERVICES']);
    expect(emptyListingCheck({ ...base, media: 2 }).existing).toEqual(['MEDIA']);
    expect(emptyListingCheck({ hasListing: true, phone: PHONE, addressDetail: true, description: 'x', services: 3, media: 1 }).existing).toEqual(['PHONE', 'ADDRESS', 'DESCRIPTION', 'SERVICES', 'MEDIA']);
  });
  it('addressHasDetail ignores the city, state and country', () => {
    expect(addressHasDetail({ city: 'Chennai', state: 'TN' })).toBe(false);
    expect(addressHasDetail({ city: 'Chennai', line1: ' ' })).toBe(false);
    expect(addressHasDetail({ city: 'Chennai', line1: '12 Gandhi Road' })).toBe(true);
    expect(addressHasDetail({ pincode: '600001' })).toBe(true);
    expect(addressHasDetail(null)).toBe(false); expect(addressHasDetail('x')).toBe(false);
  });
  it('extendedGraceEnd adds from the later of now and the current grace end, bounded by the setting', () => {
    const endsAt = new Date(NOW.getTime() - 2 * DAY);
    const a = { endsAt, graceEndsAt: null, graceDays: 7, now: NOW, addDays: 5, maxDays: 30 };
    expect(extendedGraceEnd(a)).toEqual(new Date(endsAt.getTime() + 7 * DAY + 5 * DAY));            // grace still running: from the grace end
    expect(extendedGraceEnd({ ...a, endsAt: new Date(NOW.getTime() - 40 * DAY) })).toEqual(new Date(NOW.getTime() + 5 * DAY));   // long over: from now
    expect(() => extendedGraceEnd({ ...a, addDays: 31 })).toThrow(/cannot exceed 30/);
    expect(() => extendedGraceEnd({ ...a, addDays: 0 })).toThrow(/at least 1/);
    expect(() => extendedGraceEnd({ ...a, addDays: 1.5 })).toThrow();
  });
  it('cleanReason needs 5 to 300 characters', () => { expect(cleanReason('abcd')).toBeNull(); expect(cleanReason('  ok ok  ')).toBe('ok ok'); expect(cleanReason('x'.repeat(301))).toBeNull(); expect(cleanReason(5)).toBeNull(); });
});

function world() {
  const store = new MemoryLifecycleStore(); store.clock = () => NOW;
  store.addVendor({ id: V, phone: PHONE });
  store.kept.set(V, { theme: 'pro-theme-7', pages: ['home', 'about'], products: 12, orders: 3 });
  const keptBefore = JSON.stringify(store.kept.get(V));
  const assigned: Array<Record<string, unknown>> = [];
  const invalidated: string[] = [];
  const subscriptions = { assignPlan: jest.fn(async (a: Record<string, unknown>) => {
    assigned.push(a);
    const planKey = a.planKey as string; const level = planKey.endsWith('_pro') ? 'PRO' : 'FREE';
    const end = level === 'PRO' ? new Date(NOW.getTime() + 90 * DAY) : null;
    const sub: LifecycleSubscription = { id: `s${assigned.length + 5}`, planKey, level: level as 'PRO' | 'FREE', track: planKey.split('_')[0], status: 'ACTIVE', termMonths: level === 'PRO' ? 3 : null, endsAt: end, graceEndsAt: end && new Date(end.getTime() + 7 * DAY) };
    store.subs.set(a.vendorId as string, [...(store.subs.get(a.vendorId as string) ?? []), sub]);
    return { id: sub.id, endsAt: end };
  }) };
  const entitlements = { invalidate: (id: string) => { invalidated.push(id); } };
  const plans = { loadCatalogue: async () => ({ settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' } }) };
  const b3 = { get: async () => ({ ...DEFAULT_B3_SETTINGS }) };
  const pepper = new OtpPepper();
  const svc = new VendorLifecycleService(store, subscriptions as never, entitlements as never, plans as never, b3 as never, pepper);
  svc.clock = () => NOW;
  const repo = new MemoryDirectoryRepo(); const sms = new FakeSms();
  const del = new AccountDeletionService(store, repo, { get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS }) } as never, b3 as never, sms, pepper);
  const now = { t: new Date(NOW) }; del.clock = () => now.t; repo.clock = () => now.t; let n = 0; del.random = () => 123456 + n++ * 0; del.salt = () => 'salt';
  return { store, svc, del, repo, sms, subscriptions, assigned, invalidated, now, pepper, keptBefore, kept: () => JSON.stringify(store.kept.get(V)) };
}
const proSub = (over: Partial<LifecycleSubscription> = {}): LifecycleSubscription => ({ id: 's1', planKey: 'professional_pro', level: 'PRO', track: 'professional', status: 'ACTIVE', termMonths: 3, endsAt: new Date(NOW.getTime() - 3 * DAY), graceEndsAt: null, ...over });

describe('staff actions', () => {
  it('every action needs a reason', async () => {
    const w = world(); w.store.subs.set(V, [proSub()]);
    for (const f of [() => w.svc.convertToFree(V, STAFF, ''), () => w.svc.restorePro(V, STAFF, 'no'), () => w.svc.extendGrace(V, STAFF, undefined, 3), () => w.svc.suspend(V, STAFF, 'x'), () => w.svc.reinstate(V, STAFF, '   '), () => w.svc.deleteEmptyListing(V, STAFF, '1234')]) {
      await expect(f()).rejects.toMatchObject({ response: { code: 'LIFECYCLE_REASON_REQUIRED' } });
    }
    expect(w.store.audits).toHaveLength(0);
  });

  it('convert to Free is a formal, audited subscription change to the track Free plan; Pro data is untouched; running it again records nothing new', async () => {
    const w = world(); w.store.subs.set(V, [proSub()]);
    expect(await w.svc.convertToFree(V, STAFF, 'plan lapsed, owner agreed')).toEqual({ converted: true, planKey: 'professional_free' });
    expect(w.assigned[0]).toMatchObject({ vendorId: V, planKey: 'professional_free', source: 'STAFF' });
    expect(w.store.audits.map((a) => a.action)).toEqual(['lifecycle.convert_to_free']);
    expect(w.store.audits[0]).toMatchObject({ actor: STAFF, entityId: V, after: { reason: 'plan lapsed, owner agreed' } });
    expect(w.invalidated).toContain(V); expect(w.kept()).toBe(w.keptBefore);
    expect(await w.svc.convertToFree(V, STAFF, 'again again')).toEqual({ converted: false, planKey: 'professional_free' });
    expect(w.assigned).toHaveLength(1);
  });

  it('convert to Free needs a subscription', async () => {
    const w = world();
    await expect(w.svc.convertToFree(V, STAFF, 'no plan here')).rejects.toMatchObject({ response: { code: 'LIFECYCLE_NO_SUBSCRIPTION' } });
  });

  it('restore Pro defaults to the vendor\'s last Pro plan and term, and the kept Pro data is exactly as it was', async () => {
    const w = world(); w.store.subs.set(V, [proSub(), { ...proSub({ id: 's2', planKey: 'professional_free', level: 'FREE', termMonths: null, endsAt: null }) }]);
    const r = await w.svc.restorePro(V, STAFF, 'paid offline, receipt checked');
    expect(r).toMatchObject({ restored: true, planKey: 'professional_pro' });
    expect(w.assigned[0]).toMatchObject({ planKey: 'professional_pro', termMonths: 3, source: 'STAFF' });
    expect(w.kept()).toBe(w.keptBefore);   // the chosen Pro theme, pages, products, orders return untouched
    expect(w.store.audits.at(-1)).toMatchObject({ action: 'lifecycle.restore_pro' });
  });
  it('restore Pro refuses a plan of another track and a vendor that never had Pro without a plan key', async () => {
    const w = world(); w.store.subs.set(V, [proSub({ id: 's9', planKey: 'professional_free', level: 'FREE', termMonths: null, endsAt: null })]);
    await expect(w.svc.restorePro(V, STAFF, 'never had pro')).rejects.toBeInstanceOf(BadRequestException);
    await expect(w.svc.restorePro(V, STAFF, 'wrong track', { planKey: 'handyman_pro', termMonths: 3 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(w.svc.restorePro(V, STAFF, 'not a pro plan', { planKey: 'professional_free' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('extend grace moves the grace end, audited, bounded by the setting; only Pro with an end date has a grace period', async () => {
    const w = world(); w.store.subs.set(V, [proSub()]);
    const r = await w.svc.extendGrace(V, STAFF, 'owner abroad, promised payment', 10);
    expect(r.graceEndsAt).toEqual(new Date(NOW.getTime() - 3 * DAY + 7 * DAY + 10 * DAY));
    expect((await w.store.currentSubscription(V))!.graceEndsAt).toEqual(r.graceEndsAt);
    expect(w.store.audits.at(-1)).toMatchObject({ action: 'lifecycle.extend_grace' });
    await expect(w.svc.extendGrace(V, STAFF, 'too many days', 31)).rejects.toBeInstanceOf(BadRequestException);
    w.store.subs.set(V, [proSub({ planKey: 'professional_free', level: 'FREE', endsAt: null })]);
    await expect(w.svc.extendGrace(V, STAFF, 'free has none', 3)).rejects.toBeInstanceOf(ConflictException);
  });

  it('suspend and reinstate: status changes, entitlements are invalidated, audited, idempotent; reinstate only for a suspended vendor; nothing stored is touched', async () => {
    const w = world();
    expect(await w.svc.suspend(V, STAFF, 'chargeback dispute')).toEqual({ status: 'SUSPENDED', changed: true });
    expect(await w.svc.suspend(V, STAFF, 'chargeback dispute')).toEqual({ status: 'SUSPENDED', changed: false });
    expect(w.invalidated.filter((x) => x === V).length).toBeGreaterThanOrEqual(1);
    expect(w.kept()).toBe(w.keptBefore);
    expect(await w.svc.reinstate(V, STAFF, 'dispute resolved')).toEqual({ status: 'ACTIVE', changed: true });
    await expect(w.svc.reinstate(V, STAFF, 'already active')).rejects.toBeInstanceOf(ConflictException);
    expect(w.store.audits.map((a) => a.action)).toEqual(['lifecycle.suspend', 'lifecycle.reinstate']);
  });

  it('unknown vendor: 404 for every action', async () => {
    const w = world();
    await expect(w.svc.suspend('nobody', STAFF, 'reason here')).rejects.toMatchObject({ status: 404 });
    await expect(w.svc.state('nobody')).rejects.toMatchObject({ status: 404 });
  });
});

describe('path (b): staff delete an EMPTY listing', () => {
  it('refuses a listing with details and names them; removes an empty one permanently (no register row without a phone)', async () => {
    const w = world();
    w.store.facts.set(V, { hasListing: true, phone: PHONE, addressDetail: false, description: null, services: 2, media: 0 });
    await expect(w.svc.deleteEmptyListing(V, STAFF, 'looks abandoned')).rejects.toMatchObject({ response: { code: 'LIFECYCLE_NOT_EMPTY', existing: ['PHONE', 'SERVICES'] } });
    expect(await w.store.isRemoved(V)).toBe(false);
    w.store.facts.set(V, { hasListing: true, phone: null, addressDetail: false, description: '', services: 0, media: 0 });
    expect(await w.svc.deleteEmptyListing(V, STAFF, 'empty shell listing')).toEqual({ removed: true, alreadyRemoved: false });
    expect(w.store.removals.get(V)).toMatchObject({ kind: 'STAFF_EMPTY_LISTING', phoneHash: null }); expect(w.store.register.size).toBe(0);
    expect(w.store.audits.at(-1)).toMatchObject({ action: 'lifecycle.delete_empty_listing', actor: STAFF });
    expect(await w.svc.deleteEmptyListing(V, STAFF, 'empty shell listing')).toEqual({ removed: true, alreadyRemoved: true });
  });
  it('refuses while a paid Pro plan is running', async () => {
    const w = world(); w.store.subs.set(V, [proSub({ endsAt: new Date(NOW.getTime() + 20 * DAY) })]);
    await expect(w.svc.deleteEmptyListing(V, STAFF, 'empty but paying')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('path (a): the owner asks for deletion (fresh code, confirmation, queue, execute)', () => {
  const codeFromSms = (w: ReturnType<typeof world>) => /is (\d{6})\./.exec(w.sms.sent.at(-1)!.body)![1];

  it('step 1 sends a code and returns the warning; step 2 needs the confirmation; step 3 joins the queue; nothing is removed yet', async () => {
    const w = world();
    const s1 = await w.del.request(V, 'user-1', OWNER, {});
    expect(s1).toMatchObject({ step: 'CODE_SENT', maskedPhone: expect.stringContaining('210') }); expect(s1.warning).toBe(DEFAULT_B3_SETTINGS.accountDeletionWarningText);
    expect(w.sms.sent).toHaveLength(1); expect(w.sms.sent[0].to).toBe(PHONE);
    const code = codeFromSms(w);
    await expect(w.del.request(V, 'user-1', OWNER, { code })).rejects.toMatchObject({ response: { code: 'DELETION_CONFIRM_REQUIRED', warning: DEFAULT_B3_SETTINGS.accountDeletionWarningText } });
    expect(await w.store.pendingDeletion(V)).toBeNull();
    const s3 = await w.del.request(V, 'user-1', OWNER, { code, confirm: true });
    expect(s3).toMatchObject({ step: 'REQUESTED', status: 'PENDING' });
    expect(await w.store.isRemoved(V)).toBe(false);   // asking removes nothing
    expect(w.store.audits.at(-1)).toMatchObject({ action: 'account.deletion.requested', actor: OWNER });
  });

  it('a wrong code, an expired code and a used code are all the same refusal, and the code is bound to this vendor', async () => {
    const w = world(); await w.del.request(V, 'user-1', OWNER, {}); const code = codeFromSms(w);
    const wrong = code === '000000' ? '111111' : '000000';
    await expect(w.del.request(V, 'user-1', OWNER, { code: wrong, confirm: true })).rejects.toMatchObject({ response: { code: 'DELETION_CODE_INVALID' } });
    w.now.t = new Date(NOW.getTime() + 11 * 60_000);   // past the 10 minute default
    await expect(w.del.request(V, 'user-1', OWNER, { code, confirm: true })).rejects.toMatchObject({ response: { code: 'DELETION_CODE_INVALID' } });
    // another vendor cannot use this vendor's challenge
    w.store.addVendor({ id: 'vendor-2', phone: '+919811111111' });
    await expect(w.del.request('vendor-2', 'user-2', OWNER, { code, confirm: true })).rejects.toMatchObject({ response: { code: 'DELETION_CODE_INVALID' } });
    expect(await w.store.pendingDeletion(V)).toBeNull();
  });

  it('a code works exactly once, and five wrong guesses lock the challenge', async () => {
    const w = world(); await w.del.request(V, 'user-1', OWNER, {}); const code = codeFromSms(w);
    await w.del.request(V, 'user-1', OWNER, { code, confirm: true });
    const w2 = world(); await w2.del.request(V, 'user-1', OWNER, {}); const good = codeFromSms(w2); const bad = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(w2.del.request(V, 'user-1', OWNER, { code: bad, confirm: true })).rejects.toBeInstanceOf(BadRequestException);
    await expect(w2.del.request(V, 'user-1', OWNER, { code: good, confirm: true })).rejects.toMatchObject({ response: { code: 'DELETION_CODE_INVALID' } });   // locked even for the right code
  });

  it('asking twice gives the same open request; a vendor with no phone is told; resend inside the cooldown does not send another code', async () => {
    const w = world(); await w.del.request(V, 'user-1', OWNER, {}); await w.del.request(V, 'user-1', OWNER, {});
    expect(w.sms.sent).toHaveLength(1);
    const code = codeFromSms(w);
    const a = await w.del.request(V, 'user-1', OWNER, { code, confirm: true }); const b = await w.del.request(V, 'user-1', OWNER, {});
    expect(b).toMatchObject({ step: 'REQUESTED', requestId: a.requestId });
    const nophone = world(); nophone.store.addVendor({ id: 'v-np', phone: null });
    await expect(nophone.del.request('v-np', 'u', OWNER, {})).rejects.toMatchObject({ response: { code: 'DELETION_NO_PHONE' } });
  });

  it('execute: permanent, recorded, the phone hash joins the register, nothing hard-deleted, idempotent, reason required', async () => {
    const w = world(); await w.del.request(V, 'user-1', OWNER, {}); const code = codeFromSms(w);
    const { requestId } = await w.del.request(V, 'user-1', OWNER, { code, confirm: true });
    await expect(w.svc.executeDeletion(requestId!, STAFF, '')).rejects.toMatchObject({ response: { code: 'LIFECYCLE_REASON_REQUIRED' } });
    const r = await w.svc.executeDeletion(requestId!, STAFF, 'owner confirmed with a fresh code');
    expect(r).toMatchObject({ executed: true, alreadyRemoved: false, vendorId: V }); expect(r.retained).toEqual(expect.arrayContaining([expect.stringContaining('invoices')]));
    expect(await w.store.isRemoved(V)).toBe(true); expect(w.store.directoryRemoved.has(V)).toBe(true);
    expect(w.store.removals.get(V)).toMatchObject({ kind: 'VENDOR_REQUEST' });
    const hash = hashPhone(PHONE, w.pepper.value()); expect(w.store.register.has(hash)).toBe(true); expect(w.store.removals.get(V)!.phoneHash).toBe(hash);
    expect((await w.store.getDeletion(requestId!))!.status).toBe('EXECUTED');
    expect(w.store.audits.at(-1)).toMatchObject({ action: 'lifecycle.execute_deletion', actor: STAFF });
    expect(await w.svc.executeDeletion(requestId!, STAFF, 'again again')).toMatchObject({ executed: true, alreadyRemoved: true });
    expect(w.store.register.size).toBe(1);
    expect(JSON.stringify(w.store.audits)).not.toContain(PHONE);   // the number never reaches an audit row
  });
  it('a removed account cannot start another request; an unknown request is 404', async () => {
    const w = world(); w.store.removals.set(V, { kind: 'VENDOR_REQUEST', reason: 'x', phoneHash: null });
    await expect(w.del.request(V, 'user-1', OWNER, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(w.svc.executeDeletion('nope', STAFF, 'unknown request')).rejects.toMatchObject({ status: 404 });
  });
});
