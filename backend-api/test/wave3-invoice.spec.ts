import { GatewayName } from '../src/plan-billing/gateway/gateway-core';
import { invoiceLines } from '../src/plan-billing/core/invoice-lines';
import { PlanInvoiceDeliveryService } from '../src/plan-billing/invoice-delivery.service';
import { BillingSettingsService } from '../src/plan-billing/settings/billing-settings.service';
import { renderInvoiceHtml } from '../src/v3-vendor-gaps/core/gaps-core';
import { VENDOR } from './support/billing-world';
import { deliver, flow, Flow } from './support/wave3-world';

/** Wave 3 Part D: the invoice is made once, on payment, with the gateway payment id or the cash reference, and its mail is recorded as pending while the mail switch is off. */

const payOnline = async (f: Flow, name: GatewayName, termMonths = 3, vendorId = 'v1') => {
  const o = await f.buy({ termMonths }, vendorId);
  const paymentId = name === 'razorpay' ? `pay_inv${termMonths}${vendorId}` : `55${termMonths}${vendorId === 'v1' ? '1' : '2'}`;
  f.gw.addPayment({ paymentId, providerOrderId: o.providerOrderId!, amountMinor: o.amountPaise, currency: 'INR', status: 'SUCCESS' });
  const input = name === 'razorpay' ? { paymentId, signature: f.gw.returnSignature(o.providerOrderId!, paymentId) } : {};
  await f.orders.confirm(vendorId, o.id, input, VENDOR);
  return { o, paymentId };
};

describe.each<GatewayName>(['razorpay', 'cashfree'])('the automatic invoice on %s', (name) => {
  it('is made exactly once on a successful payment, whichever way the payment is reported', async () => {
    const f = flow(name);
    const { o, paymentId } = await payOnline(f, name);
    expect(f.invoices()).toBe(1);
    // the webhook for the same payment, then the confirm again: still one
    const d = deliver(f, name, o, { amountMinor: o.amountPaise, paymentId, eventId: 'evt_inv_000001' });
    await f.settlement.handleGatewayWebhook(name, d.raw, d.headers);
    await f.orders.confirm('v1', o.id, name === 'razorpay' ? { paymentId, signature: f.gw.returnSignature(o.providerOrderId!, paymentId) } : {}, VENDOR);
    expect(f.invoices()).toBe(1);
    expect(f.w.repo.invoices[0].orderId).toBe(o.id);
  });

  it('numbers invoices one after another with no gap, per financial year, with the prefix from the settings', async () => {
    const f = flow(name);
    await payOnline(f, name, 3, 'v1'); await payOnline(f, name, 3, 'v2');
    expect(f.w.repo.invoices.map((i) => i.invoiceNumber)).toEqual(['INV/2026-27/000001', 'INV/2026-27/000002']);
    f.set({ invoiceNumberPrefix: 'KSM' });
    await payOnline(f, name, 6, 'v1');
    expect(f.w.repo.invoices[2].invoiceNumber).toBe('KSM/2026-27/000003');
    f.w.now.t = new Date('2027-04-02T00:00:00Z');   // the next financial year starts the counter again
    await payOnline(f, name, 12, 'v2');
    expect(f.w.repo.invoices[3].invoiceNumber).toBe('KSM/2027-28/000001');
  });

  it('holds the lines (plan and term, GST, total) and the gateway payment id, all in minor units from the order', async () => {
    const f = flow(name);
    const { paymentId } = await payOnline(f, name);
    const inv = f.w.repo.invoices[0];
    expect(inv.snapshot.lines).toEqual([
      { key: 'PLAN', description: 'handyman pro plan, 3 months', amountMinor: 300000 },
      { key: 'TAX', description: 'GST at 18%', amountMinor: 54000 },
      { key: 'TOTAL', description: 'Total paid', amountMinor: 354000 },
    ]);
    expect(inv.snapshot.amountPaise).toBe(354000);
    expect(inv.snapshot.payment).toEqual({ method: 'GATEWAY', gateway: name, reference: paymentId });
    expect(inv.snapshot.order).toMatchObject({ gateway: name, paymentId });
    const lines = inv.snapshot.lines as Array<{ amountMinor: number }>;
    expect(lines[0].amountMinor + lines[1].amountMinor).toBe(lines[2].amountMinor);
    expect(lines.every((l) => Number.isInteger(l.amountMinor))).toBe(true);
  });

  it('the page prints how it was paid and keeps the same heading as before', async () => {
    const f = flow(name);
    const { paymentId } = await payOnline(f, name);
    const html = renderInvoiceHtml(f.w.repo.invoices[0]);
    expect(html).toContain('<h1>Invoice INV/2026-27/000001</h1>');
    expect(html).toContain(`Paid through ${name === 'cashfree' ? 'Cashfree' : 'Razorpay'}. Payment reference ${paymentId}`);
    expect(html).toContain('Total paid');
  });

  it('the vendor sees their own invoice and can download it; another vendor sees none; staff list it', async () => {
    const f = flow(name);
    await payOnline(f, name);
    const mine = await f.orders.invoicesMine('v1', 1, 25);
    expect(mine.total).toBe(1);
    expect((await f.orders.invoicesMine('v2', 1, 25)).total).toBe(0);
    const page = await f.orders.invoicePage('v1', mine.items[0].id);
    expect(page.fileName).toBe('invoice-INV-2026-27-000001.html');
    expect(page.html).toContain('Invoice INV/2026-27/000001');
    await expect(f.orders.invoicePage('v2', mine.items[0].id)).rejects.toMatchObject({ response: { code: 'PLAN_INVOICE_NOT_FOUND' } });
    const staff = await f.w.repo.listInvoicesForStaff({ skip: 0, take: 25 });
    expect(staff.total).toBe(1); expect(staff.items[0].invoiceNumber).toBe('INV/2026-27/000001');
  });

  it('a held payment (wrong amount) makes no invoice', async () => {
    const f = flow(name); const o = await f.buy();
    const d = deliver(f, name, o, { amountMinor: 1, paymentId: name === 'razorpay' ? 'pay_hold1' : '555901', eventId: 'evt_hold_00001' });
    await f.settlement.handleGatewayWebhook(name, d.raw, d.headers);
    expect(f.invoices()).toBe(0); expect(f.queued).toHaveLength(0);
  });

  it('asks for the invoice mail after the commit, with the invoice number and plan name, and a mail problem never fails the payment', async () => {
    const f = flow(name);
    await payOnline(f, name);
    await new Promise((r) => setImmediate(r));
    expect(f.queued).toEqual([{ invoiceId: f.w.repo.invoices[0].id, invoiceNumber: 'INV/2026-27/000001', planName: 'handyman pro', vendorId: 'v1', to: 'v1@x.invalid' }]);
    const g = flow(name);
    (g.settlement as unknown as { delivery: { queue: () => Promise<never> } }).delivery = { queue: () => Promise.reject(new Error('mail down')) };
    const { o } = await payOnline(g, name);
    expect(g.w.repo.orders.get(o.id)!.status).toBe('PAID'); expect(g.invoices()).toBe(1);
  });
});

describe('the invoice of a cash payment', () => {
  it('shows the receipt reference and the day it was received', () => {
    const html = renderInvoiceHtml({ invoiceNumber: 'INV/2026-27/000007', financialYear: '2026-27', issuedAt: '2026-11-20T00:00:00Z', taxBreakdown: { taxableMinor: 100000, taxMinor: 18000, name: 'GST', ratePercent: 18 }, snapshot: { seller: { name: 'KSM QUANTUM TECHNOLOGIES', address: 'Chennai' }, buyer: { businessName: 'A', email: 'a@b.c' }, plan: { name: 'Pro' }, termMonths: 3, amountPaise: 118000, period: { from: '2026-11-20', to: '2027-02-20' }, payment: { method: 'CASH', reference: 'RCPT-42', receivedOn: '2026-11-19' } } });
    expect(html).toContain('Paid in cash. Receipt reference RCPT-42. Received 2026-11-19');
    expect(html).not.toContain('Paid through');
  });
  it('an invoice made before Wave 3 has no payment block and prints exactly as it did', () => {
    const base = { invoiceNumber: 'INV/2026-27/000001', financialYear: '2026-27', issuedAt: '2026-11-20T00:00:00Z', taxBreakdown: { taxableMinor: 1000, taxMinor: 180 }, snapshot: { seller: { name: 'S', address: 'A' }, buyer: { email: 'e@x.y' }, plan: { name: 'P' }, termMonths: 3, amountPaise: 1180 } };
    const html = renderInvoiceHtml(base);
    expect(html).not.toMatch(/Paid through|Paid in cash|reference/);
    expect(html.endsWith('</table></body></html>')).toBe(true);
  });
  it('escapes a reference so it can never inject markup', () => {
    const html = renderInvoiceHtml({ invoiceNumber: 'N', financialYear: 'F', issuedAt: '2026-11-20T00:00:00Z', taxBreakdown: {}, snapshot: { seller: {}, buyer: {}, plan: {}, amountPaise: 1, payment: { method: 'CASH', reference: '<script>alert(1)</script>' } } });
    expect(html).not.toContain('<script>alert'); expect(html).toContain('&lt;script&gt;');
  });
});

describe('the seller on the invoice is the firm profile', () => {
  const make = (seller: { name: string; address: string; gstin: string }) => new BillingSettingsService({ v3PlanSetting: { findMany: async () => [] } } as never, { seller: async () => seller } as never);
  it('takes name, address and GSTIN from the firm profile, not from billing settings', async () => {
    const s = await make({ name: 'KSM QUANTUM TECHNOLOGIES', address: 'Tidel Park, D Block, Tharamani, Chennai 600113', gstin: '' }).get();
    expect([s.invoiceSellerName, s.invoiceSellerAddress, s.invoiceSellerGstin]).toEqual(['KSM QUANTUM TECHNOLOGIES', 'Tidel Park, D Block, Tharamani, Chennai 600113', '']);
  });
  it('prints no GSTIN line while it is unset, and prints it once it is set', () => {
    const inv = (gstin: string) => renderInvoiceHtml({ invoiceNumber: 'N', financialYear: 'F', issuedAt: '2026-11-20T00:00:00Z', taxBreakdown: {}, snapshot: { seller: { name: 'KSM QUANTUM TECHNOLOGIES', address: 'Chennai', gstin }, buyer: {}, plan: {}, amountPaise: 1 } });
    expect(inv('')).not.toMatch(/GSTIN|pending/i);
    expect(inv('33ABCDE1234F1Z5')).toContain('GSTIN 33ABCDE1234F1Z5');
  });
});

describe('invoice lines (pure)', () => {
  it('plan, tax and total from the order quote; no tax line when there is no tax', () => {
    expect(invoiceLines('Pro', 6, { taxableMinor: 540000, taxMinor: 97200, taxName: 'GST', taxRatePercent: 18 }, 637200)).toEqual([
      { key: 'PLAN', description: 'Pro plan, 6 months', amountMinor: 540000 }, { key: 'TAX', description: 'GST at 18%', amountMinor: 97200 }, { key: 'TOTAL', description: 'Total paid', amountMinor: 637200 }]);
    expect(invoiceLines('Pro', 3, { base: 1000 }, 1000)).toEqual([{ key: 'PLAN', description: 'Pro plan, 3 months', amountMinor: 1000 }, { key: 'TOTAL', description: 'Total paid', amountMinor: 1000 }]);
    expect(invoiceLines('Pro', 3, {}, 1180)[0].amountMinor).toBe(1180);
  });
});

describe('PlanInvoiceDeliveryService', () => {
  const notLive = (code = 'EMAIL_NOT_LIVE') => Object.assign(new Error('x'), { response: { code } });
  const make = (send: (m: Record<string, unknown>) => Promise<void> | void) => {
    const f = flow(); const sent: Array<Record<string, unknown>> = [];
    const svc = new PlanInvoiceDeliveryService(f.w.repo, { send: async (m: never) => { sent.push(m); await send(m); } } as never, { value: () => 'test-pepper' } as never);
    return { svc, f, sent };
  };
  const input = { invoiceId: 'inv-1', invoiceNumber: 'INV/2026-27/000001', planName: 'handyman pro', vendorId: 'v1', to: 'owner@example.com' };

  it('with the mail switch OFF the port refuses and the delivery is recorded as PENDING, nothing sent', async () => {
    const m = make(() => { throw notLive(); });
    expect(await m.svc.queue(input)).toBe('PENDING');
    expect(m.f.w.repo.deliveries).toHaveLength(1);
    expect(m.f.w.repo.deliveries[0]).toMatchObject({ invoiceId: 'inv-1', vendorId: 'v1', status: 'QUEUED' });
    expect(await m.svc.queue({ ...input })).toBe('ALREADY_RECORDED');   // one row per invoice
    expect(m.f.w.repo.deliveries).toHaveLength(1);
  });
  it('NOT_CONFIGURED is also pending; a transport failure is FAILED; a delivered mail is SENT', async () => {
    expect(await make(() => { throw notLive('EMAIL_NOT_CONFIGURED'); }).svc.queue(input)).toBe('PENDING');
    const bad = make(() => { throw notLive('EMAIL_FAILED'); });
    expect(await bad.svc.queue(input)).toBe('FAILED'); expect(bad.f.w.repo.deliveries[0].status).toBe('FAILED');
    const ok = make(() => undefined);
    expect(await ok.svc.queue(input)).toBe('SENT'); expect(ok.f.w.repo.deliveries[0].status).toBe('DELIVERED');
  });
  it('asks the port for lane 1, kind RECEIPT, to the one address, with no price and no personal data in the text', async () => {
    const m = make(() => undefined);
    await m.svc.queue(input);
    expect(m.sent[0]).toMatchObject({ lane: 'SYSTEM', kind: 'RECEIPT', to: 'owner@example.com', subject: 'Your invoice INV/2026-27/000001' });
    expect(String(m.sent[0].text)).not.toMatch(/₹|rs\.|inr|\d{3,}\.\d{2}|owner@/i);
  });
  it('stores only a keyed hash and a masked form of the address', async () => {
    const m = make(() => { throw notLive(); });
    await m.svc.queue(input);
    const row = m.f.w.repo.deliveries[0];
    expect(row.toHash).toMatch(/^[0-9a-f]{64}$/); expect(row.toMasked).not.toContain('owner@example.com'); expect(row.toMasked).toContain('@example.com');
    expect(JSON.stringify(row)).not.toContain('owner@example.com');
  });
  it('records nothing when there is no address, and never throws', async () => {
    const m = make(() => undefined);
    expect(await m.svc.queue({ ...input, to: null })).toBe('NO_ADDRESS'); expect(m.f.w.repo.deliveries).toHaveLength(0);
    const broken = new PlanInvoiceDeliveryService({ findInvoiceDelivery: async () => { throw new Error('db down'); } } as never, undefined, { value: () => 'p' } as never);
    expect(await broken.queue(input)).toBe('FAILED');
  });
  it('with no mail port at all, the delivery stays PENDING', async () => {
    const f = flow(); const svc = new PlanInvoiceDeliveryService(f.w.repo, undefined, { value: () => 'p' } as never);
    expect(await svc.queue(input)).toBe('PENDING'); expect(f.w.repo.deliveries[0].status).toBe('QUEUED');
  });
});
