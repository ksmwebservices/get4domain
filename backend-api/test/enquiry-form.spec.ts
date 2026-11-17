import { consentGiven } from '../src/requests-orders/enquiry-form.service';
import { MailSettings } from '../src/v3-mail/settings/mail-settings';
import { enquiryWorld } from './support/enquiry-world';
import { HOST_A, HOST_B, requestsWorld, RW, T0 } from './support/requests-world';

/** The vendor site's own enquiry form post, through the real services with memory twins: what the theme form sends becomes ONE stored enquiry in the business inbox. */
jest.setTimeout(60_000);
const form = (over: Record<string, unknown> = {}) => ({ name: 'Meena R', phone: '98765 43210', message: 'Do you do geyser repairs?', consent: 'on', source: 'site', ...over });
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };

async function make(o: { mail?: Partial<MailSettings>; env?: Record<string, string> } = {}) {
  const w: RW = await requestsWorld();
  return { w, ...enquiryWorld(w, o) };
}

describe('the enquiry form post: what the theme form sends is enough', () => {
  it('name, phone, message, consent=on and source create ONE request, ONE inbox row the vendor reads, and the e-mail alert', async () => {
    const { w, svc, inboxStore, transport, events } = await make();
    const r = await svc.enquire(HOST_A, form(), '203.0.113.1');
    expect(r).toMatchObject({ received: true }); expect((r as { reference: string }).reference).toBeTruthy();
    const req = [...w.store.requests.values()]; expect(req).toHaveLength(1);
    expect(req[0]).toMatchObject({ vendorId: 'va', kind: 'ENQUIRY', status: 'DELIVERED', customerPhoneE164: '+919876543210', siteHost: HOST_A });
    expect(w.store.consents.get(req[0].id)).toMatchObject({ textVersion: 1 });
    expect(inboxStore.rows).toHaveLength(1);
    expect(inboxStore.rows[0]).toMatchObject({ vendorId: 'va', state: 'NEW', fromName: 'Meena R', forwardStatus: 'FORWARDED', messageIdHdr: `request:${req[0].id}` });
    expect(inboxStore.rows[0].bodyText).toContain('Do you do geyser repairs?'); expect(inboxStore.rows[0].bodyText).toContain('+919876543210');
    expect(transport.sent[0].m).toMatchObject({ kind: 'ENQUIRY_FORWARD', to: 'va@x.invalid' }); expect(transport.sent[0].m.replyTo).toBeUndefined();   // a phone is not an address to reply to
    expect(events).toEqual(expect.arrayContaining(['inbox.message_received', 'inbox.message_forwarded', 'request.received']));
    expect(w.store.outbox.map((m) => m.templateKey)).toEqual(['request_received_customer', 'request_received_vendor']);   // the alert rows exist
  });
  it('the e-mail flag stays the owner\'s: with it off the row still exists and says SKIPPED_FLAG_OFF', async () => {
    const { svc, inboxStore, transport } = await make({ env: { EMAIL_FORWARD_LIVE: 'false' } });
    await svc.enquire(HOST_A, form(), '1.1.1.1');
    expect(inboxStore.rows[0].forwardStatus).toBe('SKIPPED_FLAG_OFF'); expect(transport.sent).toHaveLength(0);
  });
  it('a double post (double click, retry) inside the duplicate window is one enquiry, one inbox row, one alert', async () => {
    const { w, svc, inboxStore, transport } = await make();
    const a = await svc.enquire(HOST_A, form(), '1.1.1.1'); const b = await svc.enquire(HOST_A, form(), '1.1.1.1');
    expect(b).toMatchObject({ received: true, reference: (a as { reference: string }).reference });
    expect(w.store.requests.size).toBe(1); expect(inboxStore.rows).toHaveLength(1); expect(transport.sent).toHaveLength(1); expect(w.store.outbox).toHaveLength(2);
    const parallel = await Promise.all(Array.from({ length: 6 }, () => svc.enquire(HOST_A, form({ message: 'Another question' }), '1.1.1.9')));
    expect(new Set(parallel.map((x) => (x as { reference: string }).reference)).size).toBe(1); expect(w.store.requests.size).toBe(2); expect(inboxStore.rows).toHaveLength(2);
  });
  it('the same words to a different site are a separate enquiry; the vendor never sees another vendor\'s', async () => {
    const { w, svc, inboxStore } = await make();
    await svc.enquire(HOST_A, form(), '1.1.1.1'); await svc.enquire(HOST_B, form(), '1.1.1.1');
    expect(w.store.requests.size).toBe(2); expect(inboxStore.rows.map((r) => r.vendorId).sort()).toEqual(['va', 'vb']);
  });
  it('the box ticked is the consent: no tick, no consent, nothing stored; every spelling of a ticked box counts', async () => {
    const { w, svc, inboxStore } = await make();
    for (const bad of [{ consent: undefined }, { consent: '' }, { consent: 'off' }, { consent: false }, { consent: 'no' }]) expect(await code(svc.enquire(HOST_A, form(bad), '1.1.1.1'))).toBe('REQUEST_INVALID');
    expect([true, 'on', 'true', 'yes', '1', ['on']].every(consentGiven)).toBe(true);
    expect(w.store.requests.size).toBe(0); expect(inboxStore.rows).toHaveLength(0);
  });
  it('the fields are checked: name, phone, e-mail, message length; an empty message is allowed and stored as "(no message written)"', async () => {
    const { w, svc } = await make();
    for (const bad of [{ name: 'x' }, { name: '' }, { phone: '12' }, { phone: undefined }, { email: 'nope' }, { message: 'x' }]) expect(await code(svc.enquire(HOST_A, form(bad), '1.1.1.1'))).toBe('REQUEST_INVALID');
    expect(w.store.requests.size).toBe(0);
    expect(await code(svc.enquire(HOST_A, form({ message: '' }), '1.1.1.1'))).toBe('OK');
    expect([...w.store.requests.values()][0].payload).toEqual({ message: '(no message written)' });
  });
  it('a product link (?item=) becomes a PRODUCT_ENQUIRY; unknown form fields are ignored, never stored', async () => {
    const { w, svc } = await make();
    await svc.enquire(HOST_A, form({ item: 'sku-1', hacker: '<script>', role: 'ADMIN' }), '1.1.1.1');
    const row = [...w.store.requests.values()][0]; expect(row.kind).toBe('PRODUCT_ENQUIRY'); expect(row.payload).toEqual({ productRef: 'sku-1', message: 'Do you do geyser repairs?' }); expect(JSON.stringify(row)).not.toContain('script');
  });
  it('the honeypot looks accepted but nothing reaches the vendor; a high score asks for a phone code (no inbox row until it is given)', async () => {
    const { w, svc, inboxStore } = await make();
    const honey = await svc.enquire(HOST_A, form({ website: 'http://spam.example' }), '1.1.1.1');
    expect(honey).toMatchObject({ received: true }); expect([...w.store.requests.values()].map((r) => r.status)).toEqual(['SPAM']); expect(inboxStore.rows).toHaveLength(0); expect(w.store.outbox).toHaveLength(0);
    const first = await svc.enquire(HOST_A, form({ phone: '9811111111', message: 'A real question here' }), '2.2.2.2'); expect(first).toMatchObject({ received: true }); expect(inboxStore.rows).toHaveLength(1);
    w.now.t = new Date(T0.getTime() + 11 * 60_000);   // a new duplicate window: the same words again score as a duplicate
    const dup = await svc.enquire(HOST_A, form({ phone: '9811111111', message: 'A real question here' }), '2.2.2.2'); expect(dup).toMatchObject({ otpRequired: true }); expect(inboxStore.rows).toHaveLength(1);
  });
  it('one plain 404 for a host that must reveal nothing: unknown, Free, suspended, removed; nothing stored, nothing held', async () => {
    const { w, svc, inboxStore } = await make();
    w.hostMap.set('free.get4domain.com', 'vfree'); w.lifecycle.vendors.get('vb')!.status = 'SUSPENDED';
    const answers: string[] = [];
    for (const h of ['nobody.get4domain.com', 'free.get4domain.com', HOST_B, '', 'bad host!']) answers.push(await code(svc.enquire(h, form(), '1.1.1.2')));
    expect(answers).toEqual(Array(5).fill('HTTP404')); expect(w.store.requests.size).toBe(0); expect(inboxStore.rows).toHaveLength(0);
  });
});

describe('held versus delivered: the existing switch and the consent text decide', () => {
  const ended = (w: RW) => { const e = w.ents.get('va')!; w.ents.set('va', { ...e, subscriptionStatus: 'EXPIRED', features: { ...e.features, 'site.cta': { ...e.features['site.cta'], state: 'LOCKED_PREVIEW' } } } as never); };
  it('plan ended, switch OFF: one plain 404 (nothing kept)', async () => {
    const { w, svc, inboxStore } = await make(); ended(w);
    expect(await code(svc.enquire(HOST_A, form(), '1.1.1.1'))).toBe('HTTP404'); expect(inboxStore.rows).toHaveLength(0);
  });
  it('plan ended, switch ON but counsel\'s text not published: still a 404', async () => {
    const { w, svc, inboxStore } = await make({ mail: { heldEnquiriesEnabled: true } }); ended(w);
    expect(await code(svc.enquire(HOST_A, form(), '1.1.1.1'))).toBe('HTTP404'); expect(inboxStore.rows).toHaveLength(0);
  });
  it('plan ended, switch ON and text published: kept as HELD, never forwarded, never a request row, and the visitor is not told', async () => {
    const { w, svc, inboxStore, transport, consent, events, inbox } = await make({ mail: { heldEnquiriesEnabled: true } }); ended(w); consent.published = true;
    const r = await svc.enquire(HOST_A, form(), '1.1.1.1');
    expect(r).toEqual({ received: true, reference: null });
    expect(inboxStore.rows).toHaveLength(1); expect(inboxStore.rows[0]).toMatchObject({ state: 'HELD', forwardStatus: 'SKIPPED_PLAN_ENDED' });
    expect(transport.sent).toHaveLength(0); expect(w.store.requests.size).toBe(0); expect(events).toContain('inbox.message_held');
    await svc.enquire(HOST_A, form(), '1.1.1.1'); expect(inboxStore.rows).toHaveLength(1);   // a double post is still one
    expect(await inbox.waiting('va')).toEqual({ count: 1, text: '1 enquiry waiting' });   // the vendor sees a count only
    await svc.enquire(HOST_A, form({ website: 'x' }), '1.1.1.1'); expect(inboxStore.rows).toHaveLength(1);   // the honeypot keeps nothing
  });
  it('held rows are counted against the hourly limit when the settings set one; a suspended business is never held', async () => {
    const { w, svc, inboxStore, consent } = await make({ mail: { heldEnquiriesEnabled: true, inboxRatePerHour: 2 } }); ended(w); consent.published = true;
    await svc.enquire(HOST_A, form({ message: 'First held question' }), '1.1.1.1'); await svc.enquire(HOST_A, form({ message: 'Second held question' }), '1.1.1.1');
    expect(await code(svc.enquire(HOST_A, form({ message: 'Third held question' }), '1.1.1.1'))).toBe('INBOX_RATE_LIMITED'); expect(inboxStore.rows).toHaveLength(2);
    w.lifecycle.vendors.get('va')!.status = 'SUSPENDED'; expect(await code(svc.enquire(HOST_A, form({ message: 'After suspension' }), '1.1.1.1'))).toBe('HTTP404');
  });
  it('a Free site whose plan is ACTIVE is never held: the refusal is a missing feature, so one plain 404', async () => {
    const { w, svc, inboxStore, consent } = await make({ mail: { heldEnquiriesEnabled: true } }); consent.published = true;
    w.hostMap.set('free.get4domain.com', 'vfree'); w.ents.set('vfree', { ...w.ents.get('va')!, subscriptionStatus: 'ACTIVE', features: { ...w.ents.get('va')!.features, 'site.cta': { ...w.ents.get('va')!.features['site.cta'], state: 'LOCKED_PREVIEW' } } } as never);
    expect(await code(svc.enquire('free.get4domain.com', form(), '1.1.1.1'))).toBe('HTTP404'); expect(inboxStore.rows).toHaveLength(0);
  });
});

describe('the inbox the vendor reads is the same one', () => {
  it('the written copy is listed by the vendor\'s inbox read, counts on the tab badge, and a plan that is active reads it at once', async () => {
    const { svc, inbox } = await make();
    await svc.enquire(HOST_A, form(), '1.1.1.1');
    const list = await inbox.list('va', undefined, 1, 20);
    expect(list.total).toBe(1); expect(list.items[0]).toMatchObject({ fromName: 'Meena R', state: 'NEW', subject: 'Enquiry from the website' });
    expect(await inbox.badge('va')).toEqual({ waiting: 0, unread: 1 });
    expect(((await inbox.get('va', list.items[0].id)) as { body: string }).body).toContain('Do you do geyser repairs?');
    await inbox.setState('va', list.items[0].id, 'READ'); expect(await inbox.badge('va')).toEqual({ waiting: 0, unread: 0 });
    expect((await inbox.list('vb', undefined, 1, 20)).total).toBe(0);   // another vendor reads nothing of it
  });
});
