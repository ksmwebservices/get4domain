import { ALERT_RULE_KEYS, AlertRuleRow, DEFAULT_RULE_LEVEL, evaluateAlerts, maskSummary } from '../src/v3-activity/core/activity-core';

/** Slice 5.20: the pure alert engine and the summary masking. Synthetic events are used where the real event does not exist yet. */
const rule = (key: string, o: Partial<AlertRuleRow> = {}): AlertRuleRow => ({ key, level: 'HIGH', thresholdJson: null, notifyRoles: ['SUPER_ADMIN'], enabled: true, ...o });
const fact = (actionKey: string, summary: Record<string, unknown> = {}, vendorId: string | null = 'v1') => ({ activityId: 'a1', vendorId, actionKey, summary });
const keys = (f: ReturnType<typeof fact>, rules: AlertRuleRow[]): string[] => evaluateAlerts(f, rules).map((d) => d.ruleKey);
const all = (o: Partial<AlertRuleRow> = {}): AlertRuleRow[] => ALERT_RULE_KEYS.map((k) => rule(k, { level: DEFAULT_RULE_LEVEL[k], ...o }));

describe('alert engine: which rules exist', () => {
  it('there are exactly the ten rules of the dispatch', () => {
    expect([...ALERT_RULE_KEYS].sort()).toEqual(['BUSINESS_IDENTITY_CHANGED', 'CAMPAIGN_SPIKE', 'DOMAIN_CHANGED', 'LARGE_IMPORT', 'LISTING_DELETION_REQUESTED', 'PAYMENT_FAILURES', 'PAYMENT_METHOD_CHANGED', 'PLAN_STATE_CHANGED', 'PROHIBITED_TEXT', 'THEME_SWITCHED']);
  });
  it('a disabled rule never fires, whatever the event', () => {
    for (const a of ['payment_method.created', 'domain.custom_added', 'theme.switched', 'plan.state_changed', 'prohibited_text.matched']) expect(evaluateAlerts(fact(a), all({ enabled: false }))).toEqual([]);
  });
  it('an event with no vendor never raises an alert (an alert belongs to a vendor)', () => { expect(evaluateAlerts(fact('payment_method.created', {}, null), all())).toEqual([]); });
});

describe('alert engine: every rule fires and does not fire', () => {
  it('PAYMENT_METHOD_CHANGED (High) on any payment method change, not on other events', () => {
    for (const a of ['payment_method.created', 'payment_method.updated', 'payment_method.deleted']) expect(keys(fact(a), all())).toEqual(['PAYMENT_METHOD_CHANGED']);
    expect(keys(fact('payment_method_test.run'), all())).toEqual([]);
    expect(evaluateAlerts(fact('payment_method.updated'), all())[0].level).toBe('HIGH');
  });
  it('BUSINESS_IDENTITY_CHANGED (High) only when the name or the GST number is among the changed fields', () => {
    expect(keys(fact('business.identity_changed', { changed: ['name'] }), all())).toEqual(['BUSINESS_IDENTITY_CHANGED']);
    expect(keys(fact('business.identity_changed', { changed: ['phone', 'gstNumber'] }), all())).toEqual(['BUSINESS_IDENTITY_CHANGED']);
    expect(keys(fact('business.identity_changed', { changed: ['phone', 'about'] }), all())).toEqual([]);
    expect(keys(fact('business.identity_changed', {}), all())).toEqual([]);
  });
  it('CAMPAIGN_SPIKE (High) needs a staff threshold; with none it never fires; it fires above a set one and not at or below it', () => {
    const spike = fact('campaign.metrics', { dailyCap: 500, complaints: 3, stops: 10 });
    expect(keys(spike, [rule('CAMPAIGN_SPIKE')])).toEqual([]);
    expect(keys(spike, [rule('CAMPAIGN_SPIKE', { thresholdJson: {} })])).toEqual([]);
    expect(keys(spike, [rule('CAMPAIGN_SPIKE', { thresholdJson: { dailyCap: 400 } })])).toEqual(['CAMPAIGN_SPIKE']);
    expect(keys(spike, [rule('CAMPAIGN_SPIKE', { thresholdJson: { complaints: 2 } })])).toEqual(['CAMPAIGN_SPIKE']);
    expect(keys(spike, [rule('CAMPAIGN_SPIKE', { thresholdJson: { stops: 9 } })])).toEqual(['CAMPAIGN_SPIKE']);
    expect(keys(spike, [rule('CAMPAIGN_SPIKE', { thresholdJson: { dailyCap: 500, complaints: 3, stops: 10 } })])).toEqual([]);
    expect(keys(fact('campaign.other', { dailyCap: 9999 }), [rule('CAMPAIGN_SPIKE', { thresholdJson: { dailyCap: 1 } })])).toEqual([]);
  });
  it('PAYMENT_FAILURES (High) needs a count threshold and fires when recent failures reach it', () => {
    const f = fact('payment.failed', { recentFailures: 3 });
    expect(keys(f, [rule('PAYMENT_FAILURES')])).toEqual([]);
    expect(keys(f, [rule('PAYMENT_FAILURES', { thresholdJson: { count: 3 } })])).toEqual(['PAYMENT_FAILURES']);
    expect(keys(f, [rule('PAYMENT_FAILURES', { thresholdJson: { count: 4 } })])).toEqual([]);
    expect(keys(fact('payment.failed', {}), [rule('PAYMENT_FAILURES', { thresholdJson: { count: 1 } })])).toEqual([]);
  });
  it('PROHIBITED_TEXT (High) on a scan match and nothing else', () => {
    expect(keys(fact('prohibited_text.matched', { category: 'x' }), all())).toEqual(['PROHIBITED_TEXT']);
    expect(keys(fact('prohibited_text.clean'), all())).toEqual([]);
  });
  it('DOMAIN_CHANGED (Medium) on any domain action', () => {
    expect(keys(fact('domain.custom_added'), all({ level: 'MEDIUM' }))).toEqual(['DOMAIN_CHANGED']);
    expect(keys(fact('domain.removed'), all())).toEqual(['DOMAIN_CHANGED']);
    expect(keys(fact('domains.listed'), all())).toEqual([]);
  });
  it('LARGE_IMPORT (Medium) needs a row threshold and fires when the import reaches it', () => {
    const f = fact('import.completed', { rows: 1000 });
    expect(keys(f, [rule('LARGE_IMPORT')])).toEqual([]);
    expect(keys(f, [rule('LARGE_IMPORT', { thresholdJson: { rows: 1000 } })])).toEqual(['LARGE_IMPORT']);
    expect(keys(f, [rule('LARGE_IMPORT', { thresholdJson: { rows: 1001 } })])).toEqual([]);
  });
  it('PLAN_STATE_CHANGED (Medium) on a plan state change or a plan assignment', () => {
    expect(keys(fact('plan.state_changed', { to: 'GRACE' }), all())).toEqual(['PLAN_STATE_CHANGED']);
    expect(keys(fact('subscription.assigned'), all())).toEqual(['PLAN_STATE_CHANGED']);
    expect(keys(fact('plan.viewed'), all())).toEqual([]);
  });
  it('LISTING_DELETION_REQUESTED (Medium) when the vendor asks for the listing or the account to be removed', () => {
    expect(keys(fact('listing.deletion_requested'), all())).toEqual(['LISTING_DELETION_REQUESTED']);
    expect(keys(fact('account.deletion_requested'), all())).toEqual(['LISTING_DELETION_REQUESTED']);
    expect(keys(fact('listing.updated'), all())).toEqual([]);
  });
  it('THEME_SWITCHED (Low) is log only: it is reported as a draft that must not become an alert row', () => {
    const d = evaluateAlerts(fact('theme.switched'), all());
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ ruleKey: 'THEME_SWITCHED', level: 'LOW', logOnly: true });
    expect(evaluateAlerts(fact('payment_method.created'), all()).every((x) => x.logOnly === false)).toBe(true);
  });
  it('the draft carries the activity id and the vendor and the rule level, and several rules may fire on one event', () => {
    const d = evaluateAlerts(fact('domain.custom_added'), [rule('DOMAIN_CHANGED', { level: 'MEDIUM' }), rule('PAYMENT_METHOD_CHANGED')]);
    expect(d).toEqual([{ ruleKey: 'DOMAIN_CHANGED', level: 'MEDIUM', vendorId: 'v1', activityIds: ['a1'], logOnly: false }]);
  });
});

describe('summary masking: secrets excluded, personal data masked', () => {
  it('removes secret fields at any depth', () => {
    const out = maskSummary({ ok: 1, password: 'x', nested: { apiKey: 'k', keySecret: 's', razorpayKeySecret: 'r', list: [{ webhookSecret: 'w', fine: 2 }] }, accountNumber: '123456789012', ifsc: 'HDFC0000001', otp: '123456', token: 't' });
    expect(JSON.stringify(out)).not.toMatch(/"x"|"k"|"s"|"r"|"w"|123456789012|HDFC0000001|"123456"|"t"/);
    expect(out).toMatchObject({ ok: 1, nested: { list: [{ fine: 2 }] } });
  });
  it('masks phone numbers and e-mail addresses by key and by the look of the value', () => {
    const out = maskSummary({ phone: '+91 98765 43210', contactEmail: 'priya.sharma@example.com', note: 'call 9876543210 or mail a.b@x.in', amountPaise: 99900 }) as Record<string, unknown>;
    expect(String(out.phone)).toMatch(/^\*{10}10$/);
    expect(out.contactEmail).toBe('p***@example.com');
    expect(String(out.note)).not.toMatch(/9876543210|a\.b@x\.in/);
    expect(out.amountPaise).toBe(99900);
  });
  it('masks customer names and addresses, keeps ids and keys, and does not change the input', () => {
    const input = { customerName: 'Priya Sharma', address: '12 MG Road', requestId: 'r1', serviceKey: 'LOGO' };
    const out = maskSummary(input) as Record<string, unknown>;
    expect(out.customerName).toBe('P***');
    expect(out.address).toBe('[masked]');
    expect(out).toMatchObject({ requestId: 'r1', serviceKey: 'LOGO' });
    expect(input.customerName).toBe('Priya Sharma');
  });
  it('is safe on null, scalars, cycles and very long text', () => {
    expect(maskSummary(null)).toEqual({});
    expect(maskSummary('text' as unknown as object)).toEqual({});
    const c: Record<string, unknown> = { a: 1 }; c.self = c;
    expect(() => maskSummary(c)).not.toThrow();
    expect(String((maskSummary({ text: 'y'.repeat(5000) }) as Record<string, unknown>).text).length).toBeLessThanOrEqual(500);
  });
});
