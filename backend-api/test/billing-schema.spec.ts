import { describeSchemaSlice, missingColumns, modelBlock } from './support/schema-checks';

/** B2 slice 5.1b: plan orders, the payment event inbox, plan invoices with a gap-free counter, renewal reminder log. */
describeSchemaSlice('slice 5.1b', {
  suffix: '_v3_plan_billing', tables: ['g4d_plan_orders', 'g4d_payment_events', 'g4d_plan_invoices', 'g4d_invoice_counters', 'g4d_reminder_log'],
  noCuid: ['g4d_invoice_counters'], enums: ['V3PlanOrderStatus', 'V3PlanOrderKind'], fkTargets: ['Vendor', 'g4d_plans', 'g4d_plan_subscriptions'],
});

describe('slice 5.1b columns and rules', () => {
  it('orders: a quote snapshot, integer paise, a unique provider order id, an idempotency key unique per vendor, a status, refund fields (a record only)', () => {
    const b = modelBlock('g4d_plan_orders');
    expect(missingColumns(b, ['vendorId', 'planId', 'termMonths', 'quoteJson', 'amountPaise', 'currency', 'status', 'kind', 'providerOrderId', 'idempotencyKey', 'expiresAt', 'createdByType', 'createdById', 'paidAt', 'paymentId', 'paidAmountPaise', 'subscriptionId', 'refundRecordedPaise', 'refundNote'])).toEqual([]);
    expect(b).toMatch(/amountPaise\s+Int\b/); expect(b).toMatch(/providerOrderId\s+String\?\s+@unique/); expect(b).toMatch(/@@unique\(\[vendorId, idempotencyKey\]\)/);
  });
  it('payment events: the provider event id is unique (the replay rule), the payload is stored REDACTED, and the signature result is kept', () => {
    const b = modelBlock('g4d_payment_events');
    expect(missingColumns(b, ['provider', 'providerEventId', 'type', 'payloadRedactedJson', 'signatureValid', 'orderId', 'processedAt', 'result'])).toEqual([]);
    expect(b).toMatch(/providerEventId\s+String\s+@unique/); expect(missingColumns(b, ['payloadJson', 'payload', 'card', 'pan', 'vpa'])).toEqual(['payloadJson', 'payload', 'card', 'pan', 'vpa']);
  });
  it('invoices: one per order, a unique number, issuedAt, snapshot and tax breakdown (no pdf)', () => {
    const b = modelBlock('g4d_plan_invoices');
    expect(missingColumns(b, ['vendorId', 'orderId', 'invoiceNumber', 'issuedAt', 'snapshotJson', 'taxBreakdownJson', 'financialYear'])).toEqual([]);
    expect(b).toMatch(/orderId\s+String\s+@unique/); expect(b).toMatch(/invoiceNumber\s+String\s+@unique/); expect(missingColumns(b, ['pdf', 'pdfUrl'])).toEqual(['pdf', 'pdfUrl']);
  });
  it('the invoice counter is one row per financial year', () => { const b = modelBlock('g4d_invoice_counters'); expect(b).toMatch(/financialYear\s+String\s+@id/); expect(missingColumns(b, ['lastNumber'])).toEqual([]); });
  it('the reminder log is unique per subscription, day offset and end date, so a reminder never repeats', () => {
    const b = modelBlock('g4d_reminder_log');
    expect(b).toMatch(/@@unique\(\[subscriptionId, daysBefore, endsAt\]\)/); expect(missingColumns(b, ['subscriptionId', 'daysBefore', 'endsAt', 'sentAt', 'kind'])).toEqual([]);
  });
});
