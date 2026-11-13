import { ActivityBus } from '../src/common/activity-bus';
import { signatureHeader } from '../src/v3-mail/core/mail-core';
import { FakeConsent } from '../src/v3-mail/consent.port';
import { FakeEmailTransport, GuardedEmailPort } from '../src/v3-mail/email.port';
import { InboxService } from '../src/v3-mail/inbox.service';
import { DEFAULT_MAIL_SETTINGS, MailSettings, MailSettingsService } from '../src/v3-mail/settings/mail-settings';
import { MemoryInboxStore } from './support/memory-inbox-store';

const SECRET = 's3cret'; const NOW = new Date('2026-11-14T10:00:00Z');
const body = (over: Record<string, unknown> = {}) => ({ to: 'info@acme.get4domain.com', from: 'customer@example.com', fromName: 'Meena', subject: 'Price?', text: 'How much for two?', messageId: '<m1@example.com>', spamScore: 1, sizeBytes: 500, ...over });

function make(o: { settings?: Partial<MailSettings>; env?: Record<string, string>; status?: string | null; mode?: string; suspended?: boolean } = {}) {
  const store = new MemoryInboxStore(); store.vendors.set('acme', { id: 'v1', email: 'owner@acme.example', status: 'ACTIVE' }); store.vendors.set('other', { id: 'v2', email: 'o2@other.example', status: 'ACTIVE' });
  const settings = { get: async () => ({ ...DEFAULT_MAIL_SETTINGS, mailSystemFromAddress: 'no-reply@send.example.com', mailSystemFromName: 'Get4Domain', inboxMaxBytes: 10_000, inboxRatePerHour: 3, inboxSpamThreshold: 5, ...o.settings }) } as unknown as MailSettingsService;
  const env = { INBOUND_EMAIL_SECRET: SECRET, EMAIL_LIVE_SEND: 'true', EMAIL_FORWARD_LIVE: 'true', ...o.env };
  const transport = new FakeEmailTransport(); const email = new GuardedEmailPort(transport, settings, () => env);
  const state = { status: o.status === undefined ? 'ACTIVE' : o.status, mode: o.mode ?? 'V3', suspended: o.suspended ?? false };
  const ent = { resolve: async () => ({ mode: state.mode, suspended: state.suspended, subscriptionStatus: state.status }) };
  const bus = new ActivityBus(); const events: string[] = []; bus.on('*', (e) => { events.push(e.type); });
  const consent = new FakeConsent();
  const svc = new InboxService(store, email, settings, ent as never, consent, bus, () => env); svc.clock = () => NOW;
  const post = (b: Record<string, unknown>, sig?: string) => { const raw = JSON.stringify(b); return svc.receive(raw, sig ?? signatureHeader(SECRET, raw, Math.floor(NOW.getTime() / 1000)), b); };
  return { svc, store, transport, post, state, events, consent };
}

describe('enquiry inbox: receiving', () => {
  it('a signed message for a business with a standing plan is stored text-only and forwarded with Reply-To set to the sender', async () => {
    const { post, store, transport, events } = make(); const r = await post(body());
    expect(r).toMatchObject({ accepted: true, duplicate: false, forwardStatus: 'FORWARDED' });
    expect(store.rows).toHaveLength(1); expect(store.rows[0]).toMatchObject({ vendorId: 'v1', fromAddress: 'customer@example.com', state: 'NEW', spamVerdict: 'CLEAN', forwardStatus: 'FORWARDED' });
    expect(transport.sent[0].m).toMatchObject({ kind: 'ENQUIRY_FORWARD', to: 'owner@acme.example', replyTo: 'customer@example.com' }); expect(transport.sent[0].m.text).toContain('How much for two?');
    expect(events).toEqual(['inbox.message_received', 'inbox.message_forwarded']);
  });
  it('a bad, missing, old or foreign signature is refused and nothing is stored', async () => {
    const { svc, store } = make(); const b = body(); const raw = JSON.stringify(b);
    for (const sig of [undefined, 't=1,v1=' + '0'.repeat(64), signatureHeader('wrong', raw, Math.floor(NOW.getTime() / 1000)), signatureHeader(SECRET, raw, 5)]) await expect(svc.receive(raw, sig, b)).rejects.toMatchObject({ response: { code: 'INBOX_SIGNATURE_INVALID' } });
    await expect(svc.receive(raw + ' ', signatureHeader(SECRET, raw, Math.floor(NOW.getTime() / 1000)), b)).rejects.toMatchObject({ response: { code: 'INBOX_SIGNATURE_INVALID' } });
    expect(store.rows).toHaveLength(0);
  });
  it('refuses while any limit is unset; too large; unknown address', async () => {
    await expect(make({ settings: { inboxRatePerHour: null } }).post(body())).rejects.toMatchObject({ response: { code: 'INBOX_NOT_CONFIGURED' } });
    await expect(make().post(body({ sizeBytes: 10_001 }))).rejects.toMatchObject({ response: { code: 'INBOX_TOO_LARGE' } });
    await expect(make().post(body({ to: 'x@nobody.get4domain.com' }))).rejects.toMatchObject({ response: { code: 'INBOX_VENDOR_UNKNOWN' } });
    await expect(make().post(body({ to: 'x@acme.example.com' }))).rejects.toMatchObject({ response: { code: 'INBOX_VENDOR_UNKNOWN' } });
  });
  it('a business whose plan has ended stores nothing and forwards nothing', async () => {
    for (const status of ['EXPIRED', 'CANCELLED', null]) { const { post, store, transport } = make({ status }); await expect(post(body())).rejects.toMatchObject({ response: { code: 'INBOX_PLAN_INACTIVE' } }); expect(store.rows).toHaveLength(0); expect(transport.sent).toHaveLength(0); }
    const m = make({ suspended: true }); await expect(m.post(body())).rejects.toMatchObject({ response: { code: 'INBOX_PLAN_INACTIVE' } });
  });
  it('forwarding stops the moment the plan ends: the next message is refused', async () => {
    const { post, state, transport } = make(); await post(body()); state.status = 'EXPIRED';
    await expect(post(body({ messageId: '<m2@example.com>' }))).rejects.toMatchObject({ response: { code: 'INBOX_PLAN_INACTIVE' } }); expect(transport.sent).toHaveLength(1);
  });
  it('spam is kept but never forwarded', async () => {
    const { post, store, transport } = make(); const r = await post(body({ spamScore: 9 }));
    expect(r.forwardStatus).toBe('SKIPPED_SPAM'); expect(store.rows[0].spamVerdict).toBe('SPAM'); expect(transport.sent).toHaveLength(0);
  });
  it('with the forward flag OFF the message is stored and marked as not forwarded', async () => {
    const { post, store, transport } = make({ env: { EMAIL_FORWARD_LIVE: 'false' } }); const r = await post(body());
    expect(r.forwardStatus).toBe('SKIPPED_FLAG_OFF'); expect(store.rows).toHaveLength(1); expect(transport.sent).toHaveLength(0);
  });
  it('a provider failure is recorded as FAILED and the message is still stored', async () => {
    const { post, store, transport } = make(); transport.failNext = true; const r = await post(body()); expect(r.forwardStatus).toBe('FAILED'); expect(store.rows).toHaveLength(1);
  });
  it('the same message id twice is stored and sent once', async () => {
    const { post, store, transport } = make(); await post(body()); const again = await post(body());
    expect(again).toMatchObject({ duplicate: true }); expect(store.rows).toHaveLength(1); expect(transport.sent).toHaveLength(1);
  });
  it('each business has its own hourly limit: the 4th message for one is refused, the other business is unaffected', async () => {
    const { post, store } = make();
    for (let i = 1; i <= 3; i++) await post(body({ messageId: `<a${i}@x>` }));
    await expect(post(body({ messageId: '<a4@x>' }))).rejects.toMatchObject({ response: { code: 'INBOX_RATE_LIMITED' } });
    await expect(post(body({ to: 'info@other.get4domain.com', messageId: '<b1@x>' }))).resolves.toMatchObject({ accepted: true }); expect(store.rows.filter((r) => r.vendorId === 'v1')).toHaveLength(3);
  });
  it('twenty parallel messages for one business never pass the limit', async () => {
    const { post, store } = make(); const r = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => post(body({ messageId: `<p${i}@x>` }))));
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(3); expect(store.rows).toHaveLength(3);
  });
});

describe('enquiry inbox: reading', () => {
  it('lists and reads only the business\'s own messages; reading needs the plan', async () => {
    const { post, svc, state } = make(); await post(body()); await post(body({ to: 'info@other.get4domain.com', messageId: '<o1@x>' }));
    const l = await svc.list('v1', undefined, 1, 20); expect(l.total).toBe(1); expect(l.items[0]).toMatchObject({ from: 'customer@example.com' }); expect(l.items[0]).not.toHaveProperty('body');
    const one = await svc.get('v1', l.items[0].id); expect(one).toMatchObject({ body: 'How much for two?', to: 'info@acme.get4domain.com' });
    await expect(svc.get('v2', l.items[0].id)).rejects.toMatchObject({ response: { code: 'INBOX_NOT_FOUND' } });
    state.status = 'EXPIRED'; await expect(svc.list('v1', undefined, 1, 20)).rejects.toMatchObject({ response: { code: 'INBOX_PLAN_INACTIVE' } });
  });
  it('state changes: read stamps the time; another business cannot change it; HELD is not a state a business can set', async () => {
    const { post, svc, store } = make(); await post(body()); const id = store.rows[0].id;
    expect((await svc.setState('v1', id, 'READ')).state).toBe('READ'); expect(store.rows[0].readAt).toEqual(NOW);
    await expect(svc.setState('v2', id, 'ARCHIVED')).rejects.toMatchObject({ response: { code: 'INBOX_NOT_FOUND' } });
    await expect(svc.setState('v1', id, 'HELD')).rejects.toMatchObject({ response: { code: 'INBOX_INVALID' } });
    expect(store.rows[0].state).toBe('READ');   // (a held message while the plan is not active is covered under held enquiries below)
  });
});

describe('held enquiries (Amendment 10 Part L)', () => {
  const held = { heldEnquiriesEnabled: true };
  it('stays OFF by default: with the switch off, or on without the published consent text, a business whose plan ended has nothing stored', async () => {
    const a = make({ status: 'EXPIRED' }); await expect(a.post(body())).rejects.toMatchObject({ response: { code: 'INBOX_PLAN_INACTIVE' } }); expect(a.store.rows).toHaveLength(0);
    const b = make({ status: 'EXPIRED', settings: held }); await expect(b.post(body())).rejects.toMatchObject({ response: { code: 'INBOX_PLAN_INACTIVE' } }); expect(b.store.rows).toHaveLength(0);
    const c = make({ status: 'EXPIRED' }); c.consent.published = true; await expect(c.post(body())).rejects.toMatchObject({ response: { code: 'INBOX_PLAN_INACTIVE' } }); expect(c.store.rows).toHaveLength(0);
  });
  it('with the switch on AND the consent text published, the message is HELD: stored, never forwarded, and the sender is accepted', async () => {
    const { post, store, transport, consent, events } = make({ status: 'EXPIRED', settings: held }); consent.published = true;
    const r = await post(body()); expect(r).toMatchObject({ accepted: true, held: true, forwardStatus: 'SKIPPED_PLAN_ENDED' });
    expect(store.rows[0]).toMatchObject({ vendorId: 'v1', state: 'HELD', forwardStatus: 'SKIPPED_PLAN_ENDED' }); expect(transport.sent).toHaveLength(0); expect(events).toEqual(['inbox.message_held']);
  });
  it('the business sees only "N enquiries waiting": no sender, subject or text, in the count or in the list', async () => {
    const { post, svc, consent } = make({ status: 'EXPIRED', settings: held }); consent.published = true;
    await post(body({ messageId: '<h1@x>' })); await post(body({ messageId: '<h2@x>' }));
    expect(await svc.waiting('v1')).toEqual({ count: 2, text: '2 enquiries waiting' }); expect(JSON.stringify(await svc.waiting('v1'))).not.toMatch(/customer|Price|two/);
    await expect(svc.list('v1', undefined, 1, 20)).rejects.toMatchObject({ response: { code: 'INBOX_PLAN_INACTIVE' } });
    await expect(svc.get('v1', 'm1')).rejects.toMatchObject({ response: { code: 'INBOX_PLAN_INACTIVE' } });
    expect((await svc.waiting('v2')).count).toBe(0);
  });
  it('one waiting reads "1 enquiry waiting"; none says nothing', async () => {
    const { post, svc, consent } = make({ status: 'EXPIRED', settings: held }); expect(await svc.waiting('v1')).toEqual({ count: 0, text: null }); consent.published = true; await post(body());
    expect((await svc.waiting('v1')).text).toBe('1 enquiry waiting');
  });
  it('details unlock when the plan is active again: the held messages become NEW, readable, and are not forwarded after the fact', async () => {
    const { post, svc, state, store, transport, consent, events } = make({ status: 'EXPIRED', settings: held }); consent.published = true; await post(body());
    state.status = 'ACTIVE'; expect((await svc.waiting('v1')).count).toBe(0);
    const l = await svc.list('v1', undefined, 1, 20); expect(l.total).toBe(1); expect(l.items[0]).toMatchObject({ from: 'customer@example.com', state: 'NEW', forwardStatus: 'SKIPPED_PLAN_ENDED' });
    expect(store.rows[0].state).toBe('NEW'); expect(transport.sent).toHaveLength(0); expect(events).toEqual(['inbox.message_held', 'inbox.held_released']);
  });
  it('spam is not held for an unpaid business, and the limits still apply', async () => {
    const a = make({ status: 'EXPIRED', settings: held }); a.consent.published = true; expect(await a.post(body({ spamScore: 9 }))).toMatchObject({ accepted: true, held: false, forwardStatus: 'SKIPPED_SPAM' }); expect(a.store.rows).toHaveLength(0);
    const b = make({ status: 'EXPIRED', settings: { ...held, inboxRatePerHour: 1 } }); b.consent.published = true; await b.post(body({ messageId: '<r1@x>' }));
    await expect(b.post(body({ messageId: '<r2@x>' }))).rejects.toMatchObject({ response: { code: 'INBOX_RATE_LIMITED' } });
  });
  it('another business never sees these: held counts are per business', async () => {
    const { post, svc, consent } = make({ status: 'EXPIRED', settings: held }); consent.published = true; await post(body()); expect((await svc.waiting('v2')).count).toBe(0);
  });
  it('nothing in the module shares, sells or forwards a held enquiry to another business', async () => {
    const fs = await import('fs'); const path = await import('path'); const t = fs.readFileSync(path.resolve(__dirname, '../src/v3-mail/inbox.service.ts'), 'utf8');
    const heldBlock = t.slice(t.indexOf('const holding'), t.indexOf('const verdict')); expect(heldBlock).not.toMatch(/email\.send|forward\(|share|sell|export/i);
  });
});
