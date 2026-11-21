import { HttpException } from '@nestjs/common';
import { ActivityBus } from '../src/common/activity-bus';
import { DomainLogService, DomainLogStore } from '../src/v3-domain-automation/domain-log';
import { signatureHeader } from '../src/v3-mail/core/mail-core';
import { FakeConsent } from '../src/v3-mail/consent.port';
import { FakeEmailTransport, GuardedEmailPort } from '../src/v3-mail/email.port';
import { InboxService } from '../src/v3-mail/inbox.service';
import { DEFAULT_MAIL_SETTINGS } from '../src/v3-mail/settings/mail-settings';
import { billingWorld, OTHER, paid, VENDOR } from './support/billing-world';
import { MemoryInboxStore } from './support/memory-inbox-store';
import { themeWorld } from './support/theme-switch-world';

/** Wave 2 Part B, the routes that live in an existing module: the theme fee (B1), the domain log (B2), the plan invoice download (B6) and the HANDLED enquiry state (B7). */
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) return { status: e.getStatus(), code: (e.getResponse() as { code?: string }).code }; throw e; }
  throw new Error('expected a refusal');
};

describe('B1: the theme fee, for the vendor', () => {
  it('while the price is not set the answer carries no number at all', async () => {
    const w = themeWorld(); await w.seed();
    const fee = await w.themes.fee();
    expect(fee).toEqual({ pricePaise: null, priceStatus: 'PENDING', taxNote: 'Before GST', priceNote: 'Price not set' });
  });
  it('once the owner has approved a price the amount is in paise, before GST', async () => {
    const w = themeWorld(); await w.seed(); await w.ensureFee();
    const fee = await w.themes.fee();
    expect(fee).toMatchObject({ priceStatus: 'SET', taxNote: 'Before GST' }); expect(typeof fee.pricePaise).toBe('number'); expect(fee.pricePaise).toBeGreaterThan(0);
  });
});

describe('B6: the plan invoice download, and the total on the list', () => {
  it('the owner gets their invoice as a page; the list carries totalPaise; the stored snapshot is untouched', async () => {
    const w = billingWorld(); const o = await w.buy(); await paid(w, o);
    const list = await w.orders.invoicesMine('v1', 1, 25); const inv = list.items[0];
    expect(typeof (inv.snapshot as { totalPaise?: unknown }).totalPaise).toBe('number'); expect((inv.snapshot as { totalPaise: number }).totalPaise).toBe(o.amountPaise);
    expect('totalPaise' in (w.repo.invoices[0].snapshot as object)).toBe(false);
    const page = await w.orders.invoicePage('v1', inv.id);
    expect(page.fileName).toMatch(/^invoice-[A-Za-z0-9._-]+\.html$/); expect(page.html).toContain(`Invoice ${inv.invoiceNumber}`); expect(page.html.startsWith('<!doctype html>')).toBe(true);
  });
  it('another vendor, or an id that does not exist, gets the same plain refusal', async () => {
    const w = billingWorld(); const o = await w.buy(); await paid(w, o);
    const id = (await w.orders.invoicesMine('v1', 1, 25)).items[0].id;
    const other = await codeOf(w.orders.invoicePage('v2', id)); const none = await codeOf(w.orders.invoicePage('v2', 'nope'));
    expect(other).toEqual({ status: 404, code: 'PLAN_INVOICE_NOT_FOUND' }); expect(other).toEqual(none);
    expect(VENDOR.id).not.toBe(OTHER.id);
  });
});

describe('B7: a HANDLED state for enquiries', () => {
  const SECRET = 's3cret'; const NOW = new Date('2026-11-14T10:00:00Z');
  function make() {
    const store = new MemoryInboxStore(); store.vendors.set('acme', { id: 'v1', email: 'owner@acme.example', status: 'ACTIVE' }); store.vendors.set('other', { id: 'v2', email: 'o2@other.example', status: 'ACTIVE' });
    const settings = { get: async () => ({ ...DEFAULT_MAIL_SETTINGS, mailSystemFromAddress: 'no-reply@send.example.com', mailSystemFromName: 'Get4Domain', inboxMaxBytes: 10_000, inboxRatePerHour: 30, inboxSpamThreshold: 5 }) } as never;
    const env = { INBOUND_EMAIL_SECRET: SECRET, EMAIL_LIVE_SEND: 'true', EMAIL_FORWARD_LIVE: 'true' };
    const email = new GuardedEmailPort(new FakeEmailTransport(), settings, () => env);
    const ent = { resolve: async () => ({ mode: 'V3', suspended: false, subscriptionStatus: 'ACTIVE' }) };
    const svc = new InboxService(store, email, settings, ent as never, new FakeConsent(), new ActivityBus(), () => env); svc.clock = () => NOW;
    const post = (n: number) => { const b = { to: 'info@acme.get4domain.com', from: 'c@example.com', fromName: 'Meena', subject: `Price ${n}?`, text: 'How much?', messageId: `<m${n}@e.example>`, sizeBytes: 200 }; const raw = JSON.stringify(b); return svc.receive(raw, signatureHeader(SECRET, raw, Math.floor(NOW.getTime() / 1000)), b); };
    return { svc, store, post };
  }
  it('a message can be marked handled, is listed under handled, leaves the unread count, and ARCHIVED still works', async () => {
    const { svc, store, post } = make(); await post(1); await post(2);
    const [a, b] = store.rows.map((r) => r.id);
    expect((await svc.setState('v1', a, 'HANDLED')).state).toBe('HANDLED');
    expect((await svc.list('v1', 'HANDLED', 1, 25)).items.map((x: { id: string }) => x.id)).toEqual([a]);
    expect((await svc.list('v1', 'NEW', 1, 25)).items.map((x: { id: string }) => x.id)).toEqual([b]);
    expect((await svc.setState('v1', b, 'ARCHIVED')).state).toBe('ARCHIVED');
    expect((await svc.setState('v1', a, 'NEW')).state).toBe('NEW');   // a handled message can be opened again
  });
  it('an unknown state is refused with INBOX_INVALID and says what is allowed', async () => {
    const { svc, store, post } = make(); await post(1);
    const r = await svc.setState('v1', store.rows[0].id, 'DONE').catch((e: HttpException) => e);
    expect((r as HttpException).getResponse()).toMatchObject({ code: 'INBOX_INVALID', message: 'Choose new, read, handled or archived.' });
  });
  it('another vendor cannot change the state of this vendor\'s message', async () => {
    const { svc, store, post } = make(); await post(1);
    await expect(svc.setState('v2', store.rows[0].id, 'HANDLED')).rejects.toMatchObject({ response: { code: 'INBOX_NOT_FOUND' } });
    expect(store.rows[0].state).not.toBe('HANDLED');
  });
});

describe('B2 and C8: the domain log', () => {
  const rows = [
    { id: 'l1', at: new Date('2026-11-10T10:00:00Z'), actionKey: 'domain.custom_added', actorType: 'VENDOR', actorId: 'v1', entityId: 'd1', summary: { result: 'PENDING', attempts: 0 } },
    { id: 'l2', at: new Date('2026-11-11T10:00:00Z'), actionKey: 'domain.state_changed', actorType: 'STAFF', actorId: 'staff-secret-id', entityId: 'd1', summary: { status: 'ACTIVE' } },
    { id: 'l3', at: new Date('2026-11-12T10:00:00Z'), actionKey: 'domain.subdomain_changed', actorType: 'SYSTEM', actorId: null, entityId: 'd2', summary: {} },
    { id: 'l4', at: new Date('2026-11-12T11:00:00Z'), actionKey: 'domain.custom_added', actorType: 'VENDOR', actorId: 'v2', entityId: 'd9', summary: {} },
  ].map((r, i) => ({ ...r, vendorId: i === 3 ? 'v2' : 'v1' }));
  const store: DomainLogStore = {
    forVendor: async (vendorId, skip, take, opts = {}) => {
      const all = rows.filter((r) => r.vendorId === vendorId && r.actionKey.startsWith(opts.actionPrefix ?? 'domain.') && (!opts.entityId || r.entityId === opts.entityId));
      return { items: all.slice(skip, skip + take), total: all.length };
    },
  };
  const log = new DomainLogService(store);
  it('the vendor sees one domain\'s events as when, what was found, how many tries and who; never a staff id', async () => {
    const r = await log.forDomainMine('v1', 'd1', 1, 25);
    expect(r.total).toBe(2); expect(r.items.map((x) => x.by)).toEqual(['YOU', 'GET4DOMAIN']); expect(r.items[0]).toMatchObject({ result: 'PENDING', attempts: 0, action: 'domain.custom_added' }); expect(r.items[1]).toMatchObject({ result: 'ACTIVE', attempts: null });
    expect(JSON.stringify(r)).not.toContain('staff-secret-id');
  });
  it('another vendor\'s domain log is empty for this vendor', async () => { expect((await log.forDomainMine('v1', 'd9', 1, 25)).total).toBe(0); });
  it('the subdomain log holds only subdomain events', async () => {
    const r = await log.subdomainsForVendor('v1', 1, 25);
    expect(r.items.map((x) => x.actionKey)).toEqual(['domain.subdomain_changed']);
    expect((await log.forVendor('v1', 1, 25)).total).toBe(3);
  });
});
