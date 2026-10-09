import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Razorpay from 'razorpay';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VendorPaymentsService } from '../vendor-payments/vendor-payments.service';
import { assertCapturedPayment } from '../payments/payment-verification';
import { BosSettingsService, PostingService, validGstin } from './core.services';
import { BosDocumentsService } from './documents.service';
import { BosPaymentsService } from './payments.service';
import { BosStockService } from './bos-stock.service';
import { EntitlementsService } from './entitlements.service';
import { ACC } from './chart';
import { openingLines, stockAdjustmentLines } from './posting-rules';
import { toPaise } from './gst';
import { addMonths } from '../commercial/pricing-math';

// ── Customers and suppliers (one Contact table) ──────────────────────────────────────────────────────

export interface PartyInput { name: string; phone: string; email?: string; type?: 'customer' | 'supplier' | 'both'; address?: string; shippingAddress?: string; gstin?: string; state?: string; openingBalance?: number }

@Injectable()
export class BosPartiesService {
  constructor(private readonly prisma: PrismaService, private readonly posting: PostingService) {}

  private cleanGstin(g?: string): string | null {
    const v = (g ?? '').trim().toUpperCase();
    if (!v) return null;
    if (!validGstin(v)) throw new BadRequestException('That GSTIN does not look right. It has 15 characters, for example 33ABCDE1234F1Z5.');
    return v;
  }

  async create(vendorId: string, input: PartyInput): Promise<{ id: string; name: string }> {
    const phone = input.phone.replace(/\s+/g, '');
    const dup = await this.prisma.contact.findFirst({ where: { vendorId, phone }, select: { id: true, name: true } });
    if (dup) throw new ConflictException(`${dup.name} already has this phone number. Open their record instead of adding a second one.`);
    const opening = input.openingBalance ? toPaise(input.openingBalance) : 0;
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.contact.create({ data: { vendorId, name: input.name.trim(), phone, email: input.email?.trim() || null, type: input.type ?? 'customer', address: input.address?.trim() || null, shippingAddress: input.shippingAddress?.trim() || null, gstin: this.cleanGstin(input.gstin), state: input.state?.trim() || null, openingBalancePaise: opening } });
      if (opening > 0) {
        const supplier = input.type === 'supplier';
        await this.posting.post(tx, { vendorId, sourceType: 'OPENING', sourceId: `party:${c.id}`, date: new Date(), memo: `Opening balance: ${c.name}`, lines: openingLines({ stockPaise: 0, receivables: supplier ? [] : [{ partyId: c.id, amountPaise: opening }], payables: supplier ? [{ partyId: c.id, amountPaise: opening }] : [] }) });
      }
      return { id: c.id, name: c.name };
    });
  }

  async update(vendorId: string, id: string, input: Partial<PartyInput>) {
    const c = await this.prisma.contact.findFirst({ where: { id, vendorId } });
    if (!c) throw new NotFoundException('Customer or supplier not found.');
    const data: Prisma.ContactUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.phone !== undefined) data.phone = input.phone.replace(/\s+/g, '');
    if (input.email !== undefined) data.email = input.email.trim() || null;
    if (input.type !== undefined) data.type = input.type;
    if (input.address !== undefined) data.address = input.address.trim() || null;
    if (input.shippingAddress !== undefined) data.shippingAddress = input.shippingAddress.trim() || null;
    if (input.gstin !== undefined) data.gstin = this.cleanGstin(input.gstin);
    if (input.state !== undefined) data.state = input.state.trim() || null;
    return this.prisma.contact.update({ where: { id }, data });
  }

  /** Customers / suppliers with what they owe you or you owe them, straight from the books. */
  async list(vendorId: string, q: { kind?: 'customer' | 'supplier'; search?: string; take?: number }) {
    const where: Prisma.ContactWhereInput = { vendorId };
    if (q.kind === 'supplier') where.type = { in: ['supplier', 'both'] };
    else if (q.kind === 'customer') where.type = { notIn: ['supplier'] };
    if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { phone: { contains: q.search } }];
    const rows = await this.prisma.contact.findMany({ where, orderBy: { name: 'asc' }, take: Math.min(q.take ?? 200, 500) });
    const ids = rows.map((r) => r.id);
    const g = ids.length ? await this.prisma.bosJournalLine.groupBy({ by: ['partyId', 'accountCode'], where: { vendorId, partyId: { in: ids }, accountCode: { in: [ACC.RECEIVABLES, ACC.CUSTOMER_ADVANCES, ACC.PAYABLES, ACC.SUPPLIER_ADVANCES] } }, _sum: { debitPaise: true, creditPaise: true } }) : [];
    const bal = new Map<string, { owes: number; owed: number }>();
    for (const x of g) {
      const b = bal.get(x.partyId as string) ?? { owes: 0, owed: 0 };
      const dr = x._sum.debitPaise ?? 0; const cr = x._sum.creditPaise ?? 0;
      if (x.accountCode === ACC.RECEIVABLES || x.accountCode === ACC.CUSTOMER_ADVANCES) b.owes += dr - cr; else b.owed += cr - dr;
      bal.set(x.partyId as string, b);
    }
    return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, type: r.type, gstin: r.gstin, state: r.state, address: r.address, shippingAddress: r.shippingAddress, owesYouPaise: bal.get(r.id)?.owes ?? 0, youOwePaise: bal.get(r.id)?.owed ?? 0 }));
  }
}

// ── Stock screens: items, variants, locations, transfers ─────────────────────────────────────────────

@Injectable()
export class BosStockViewsService {
  constructor(private readonly prisma: PrismaService, private readonly stock: BosStockService, private readonly ent: EntitlementsService, private readonly posting: PostingService) {}

  async overview(vendorId: string, q: { search?: string; lowOnly?: boolean } = {}) {
    const items = await this.prisma.vendorProduct.findMany({ where: { vendorId, status: { not: 'archived' }, ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}) }, select: { id: true, name: true, sku: true, unit: true, image: true, trackStock: true, stockQty: true, reorderLevel: true, purchasePriceAmount: true, hsn: true, gstRate: true, priceAmount: true, price: true }, orderBy: { name: 'asc' }, take: 1000 });
    const last = await this.prisma.stockMovement.groupBy({ by: ['productId'], where: { vendorId }, _max: { createdAt: true } });
    const lastBy = new Map(last.map((l) => [l.productId, l._max.createdAt]));
    const vsum = await this.prisma.stockMovement.groupBy({ by: ['productId', 'variantKey'], where: { vendorId, variantKey: { not: null } }, _sum: { delta: true } });
    const variantsBy = new Map<string, { variantKey: string; onHand: number }[]>();
    for (const v of vsum) variantsBy.set(v.productId, [...(variantsBy.get(v.productId) ?? []), { variantKey: v.variantKey as string, onHand: v._sum.delta ?? 0 }]);
    const rows = items.map((i) => {
      const cost = i.purchasePriceAmount == null ? null : Math.round(i.purchasePriceAmount * 100);
      const qty = i.trackStock ? (i.stockQty ?? 0) : null;
      return { id: i.id, name: i.name, sku: i.sku, unit: i.unit, image: i.image, tracked: i.trackStock, onHand: qty, reorderLevel: i.reorderLevel, low: i.trackStock && i.reorderLevel != null && (qty ?? 0) <= i.reorderLevel, unitCostPaise: cost, valuePaise: i.trackStock && cost != null ? Math.round((qty ?? 0) * cost) : null, hsn: i.hsn, gstRate: i.gstRate, ratePaise: i.priceAmount != null ? Math.round(i.priceAmount * 100) : null, variants: variantsBy.get(i.id) ?? [], lastMovementAt: lastBy.get(i.id) ?? null };
    }).filter((r) => !q.lowOnly || r.low);
    return { rows, totalValuePaise: rows.reduce((s, r) => s + (r.valuePaise ?? 0), 0), trackedCount: rows.filter((r) => r.tracked).length };
  }

  async detail(vendorId: string, productId: string) {
    const p = await this.prisma.vendorProduct.findFirst({ where: { id: productId, vendorId } });
    if (!p) throw new NotFoundException('Item not found.');
    const [byVariant, byLocation, history, locations] = await Promise.all([
      this.prisma.stockMovement.groupBy({ by: ['variantKey'], where: { vendorId, productId }, _sum: { delta: true } }),
      this.prisma.stockMovement.groupBy({ by: ['locationId'], where: { vendorId, productId }, _sum: { delta: true } }),
      this.prisma.stockMovement.findMany({ where: { vendorId, productId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.bosStockLocation.findMany({ where: { vendorId, active: true }, orderBy: { name: 'asc' } }),
    ]);
    const def = await this.stock.defaultLocationId(this.prisma, vendorId);
    const locSum = new Map<string, number>();
    for (const l of byLocation) locSum.set(l.locationId ?? def, (locSum.get(l.locationId ?? def) ?? 0) + (l._sum.delta ?? 0));
    return {
      item: { id: p.id, name: p.name, tracked: p.trackStock, onHand: p.trackStock ? p.stockQty ?? 0 : null, reorderLevel: p.reorderLevel, unitCostPaise: p.purchasePriceAmount == null ? null : Math.round(p.purchasePriceAmount * 100), hsn: p.hsn, gstRate: p.gstRate },
      variants: byVariant.filter((v) => v.variantKey).map((v) => ({ variantKey: v.variantKey as string, onHand: v._sum.delta ?? 0 })),
      locations: locations.map((l) => ({ id: l.id, name: l.name, isDefault: l.isDefault, onHand: locSum.get(l.id) ?? 0 })),
      history,
    };
  }

  /**
   * Add or remove stock of one variant (size / colour). The movement carries the variant; the books get the entry at cost in the same transaction.
   * `reason`: add = OPENING | ADJUSTMENT | RETURN, remove = DAMAGE | ADJUSTMENT. A removal can never take a variant below what it has.
   */
  async adjustVariant(vendorId: string, productId: string, input: { variantKey: string; mode: 'add' | 'remove'; quantity: number; reason: 'OPENING' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE'; note?: string; idempotencyKey?: string }, actor?: string) {
    const variantKey = input.variantKey.trim();
    if (!variantKey) throw new BadRequestException('Type the size or colour, for example "M" or "Blue / L".');
    if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new BadRequestException('Enter a whole number of 1 or more.');
    if (input.mode === 'add' ? input.reason === 'DAMAGE' : (input.reason === 'OPENING' || input.reason === 'RETURN')) throw new BadRequestException('That reason does not go with adding or removing stock. Choose another.');
    const idem = `varadj:${input.idempotencyKey ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const ref = { type: 'VARIANT_ADJ', id: idem };
    return this.prisma.$transaction(async (tx) => {
      const prod = await tx.vendorProduct.findFirst({ where: { id: productId, vendorId }, select: { id: true, trackStock: true } });
      if (!prod) throw new NotFoundException('Item not found.');
      if (!prod.trackStock) throw new BadRequestException('Turn on "track stock" for this item first.');
      const line = { productId, qty: input.quantity, variantKey };
      const res = input.mode === 'add'
        ? await this.stock.add(tx, vendorId, [line], ref, idem, input.reason, actor)
        : await this.stock.sale(tx, vendorId, [line], ref, idem, 'BLOCK', actor, input.reason);
      const unit = res.unitCostPaise.get(productId);
      if (unit && unit > 0) {
        const value = Math.round(input.quantity * unit) * (input.mode === 'add' ? 1 : -1);
        const lines = input.mode === 'add' && input.reason === 'OPENING' ? openingLines({ stockPaise: value, receivables: [], payables: [] }) : stockAdjustmentLines(value);
        await this.posting.post(tx, { vendorId, sourceType: 'STOCK', sourceId: idem, date: new Date(), memo: `Stock ${input.reason.toLowerCase()} (${variantKey})`, lines });
      }
      return { ok: true, onHand: await this.stock.onHand(tx, vendorId, productId, { variantKey }) };
    });
  }

  async setItemFields(vendorId: string, productId: string, f: { hsn?: string; gstRate?: number; purchasePrice?: number }) {
    const done = await this.prisma.vendorProduct.updateMany({ where: { id: productId, vendorId }, data: { ...(f.hsn !== undefined ? { hsn: f.hsn.trim() || null } : {}), ...(f.gstRate !== undefined ? { gstRate: f.gstRate } : {}), ...(f.purchasePrice !== undefined ? { purchasePriceAmount: f.purchasePrice } : {}) } });
    if (done.count === 0) throw new NotFoundException('Item not found.');
    return { ok: true };
  }

  async locations(vendorId: string) {
    await this.stock.defaultLocationId(this.prisma, vendorId);
    return this.prisma.bosStockLocation.findMany({ where: { vendorId, active: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  }

  async addLocation(vendorId: string, name: string) {
    await this.stock.defaultLocationId(this.prisma, vendorId);
    const limit = await this.ent.limit(vendorId, 'bos.multi-location', 'locations');
    const have = await this.prisma.bosStockLocation.count({ where: { vendorId, active: true } });
    if (limit != null && have >= limit) throw new ConflictException({ message: `Your plan includes ${limit} stock location${limit === 1 ? '' : 's'}. Upgrade to add more.`, code: 'PLAN_LIMIT', feature: 'bos.multi-location', requiredPlan: 'Pro' });
    try { return await this.prisma.bosStockLocation.create({ data: { vendorId, name: name.trim() } }); } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('You already have a location with that name.');
      throw e;
    }
  }

  async transfer(vendorId: string, input: { productId: string; qty: number; fromLocationId: string; toLocationId: string; variantKey?: string; idempotencyKey?: string }, actor?: string) {
    const locs = await this.prisma.bosStockLocation.findMany({ where: { vendorId, id: { in: [input.fromLocationId, input.toLocationId] } } });
    if (locs.length !== 2) throw new BadRequestException('Choose two of your own locations.');
    const key = `xfer:${input.idempotencyKey ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    await this.prisma.$transaction((tx) => this.stock.transfer(tx, vendorId, input, { type: 'TRANSFER', id: key }, key, actor));
    return { ok: true };
  }

  async dailyAlert(vendorId: string) {
    const row = await this.prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId, addonKey: 'bos_lowstock_daily' } } });
    return { daily: !(row && row.enabled === false) };
  }

  async setDailyAlert(vendorId: string, daily: boolean) {
    await this.prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId, addonKey: 'bos_lowstock_daily' } }, create: { vendorId, addonKey: 'bos_lowstock_daily', enabled: daily }, update: { enabled: daily } });
    return { daily };
  }

  /** Low-stock items for the Today panel and the optional daily message. */
  async low(vendorId: string) {
    const o = await this.overview(vendorId, { lowOnly: true });
    return o.rows.map((r) => ({ id: r.id, name: r.name, onHand: r.onHand, reorderLevel: r.reorderLevel }));
  }
}

// ── "Pay now" with the VENDOR's own Razorpay (never Get4Domain's) ────────────────────────────────────

@Injectable()
export class BosPayNowService {
  constructor(private readonly prisma: PrismaService, private readonly vendorPayments: VendorPaymentsService, private readonly payments: BosPaymentsService) {}

  private rzp(keys: { keyId: string; keySecret: string }): Razorpay { return new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret }); }

  private async docByToken(token: string) {
    if (!token || token.length < 20) throw new NotFoundException('This link is not valid.');
    const doc = await this.prisma.bosDocument.findUnique({ where: { publicToken: token } });
    if (!doc || doc.docType !== 'SALES_INVOICE') throw new NotFoundException('This link is not valid.');
    return doc;
  }

  /** Is online payment available on this document's public page? (only when the vendor has set up their own keys) */
  async available(vendorId: string): Promise<boolean> {
    return Boolean(await this.vendorPayments.getKeys(vendorId).catch(() => null));
  }

  async createOrder(token: string): Promise<{ razorpayOrderId: string; keyId: string; amount: number; currency: string }> {
    const doc = await this.docByToken(token);
    if (!['ISSUED', 'PART_PAID'].includes(doc.status)) throw new ConflictException('This invoice is already paid or cancelled.');
    const out = doc.totalPaise - doc.paidPaise;
    if (out <= 0) throw new ConflictException('Nothing is due on this invoice.');
    const keys = await this.vendorPayments.getKeys(doc.vendorId);
    if (!keys) throw new BadRequestException('This business has not set up online payment. Please pay them directly.');
    const order = await this.rzp(keys).orders.create({ amount: out, currency: 'INR', receipt: `inv_${doc.id.slice(-10)}`, notes: { purpose: 'bos_invoice', vendorId: doc.vendorId, docId: doc.id, amount: String(out) } });
    return { razorpayOrderId: order.id, keyId: keys.keyId, amount: Number(order.amount), currency: order.currency };
  }

  async confirm(token: string, input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    const doc = await this.docByToken(token);
    const keys = await this.vendorPayments.getKeys(doc.vendorId);
    if (!keys) throw new BadRequestException('Online payment is not set up for this business.');
    const confirmed = await assertCapturedPayment(this.rzp(keys), { secret: keys.keySecret, orderId: input.razorpayOrderId, paymentId: input.razorpayPaymentId, signature: input.razorpaySignature, expectedNotes: { purpose: 'bos_invoice', vendorId: doc.vendorId, docId: doc.id } });
    const out = Math.max(0, doc.totalPaise - doc.paidPaise);
    const r = await this.payments.record(doc.vendorId, 'RECEIPT', {
      partyId: doc.partyId ?? undefined, partyName: doc.partyName ?? undefined, mode: 'GATEWAY', amount: confirmed.amountPaise / 100, reference: confirmed.paymentId,
      allocations: out > 0 ? [{ documentId: doc.id, amount: Math.min(out, confirmed.amountPaise) / 100 }] : [], source: 'GATEWAY', sourceId: doc.id, idempotencyKey: `gw:${confirmed.paymentId}`,
    });
    return { ok: true, receipt: r.payment.number, paidPaise: r.allocatedPaise };
  }
}

// ── Daily jobs: recurring invoices and overdue reminders (Pro) ───────────────────────────────────────

@Injectable()
export class BosJobsService {
  private readonly logger = new Logger(BosJobsService.name);
  constructor(private readonly prisma: PrismaService, private readonly docs: BosDocumentsService, private readonly ent: EntitlementsService, private readonly notifications: NotificationsService, private readonly settings: BosSettingsService) {}

  async createRecurring(vendorId: string, input: { templateId: string; frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'; nextRunOn: string; endsOn?: string }) {
    const t = await this.prisma.bosDocument.findFirst({ where: { id: input.templateId, vendorId, docType: 'SALES_INVOICE', status: { in: ['ISSUED', 'PART_PAID', 'PAID'] } } });
    if (!t) throw new BadRequestException('Choose an issued invoice to repeat.');
    if (!t.partyId) throw new BadRequestException('A repeating invoice needs a named customer.');
    const next = new Date(input.nextRunOn);
    if (Number.isNaN(next.getTime()) || next.getTime() < Date.now() - 86_400_000) throw new BadRequestException('Choose a start date in the future.');
    return this.prisma.bosRecurring.create({ data: { vendorId, templateId: t.id, frequency: input.frequency, nextRunOn: next, endsOn: input.endsOn ? new Date(input.endsOn) : null } });
  }

  list(vendorId: string) { return this.prisma.bosRecurring.findMany({ where: { vendorId }, orderBy: { nextRunOn: 'asc' } }); }

  async stopRecurring(vendorId: string, id: string) {
    const done = await this.prisma.bosRecurring.updateMany({ where: { id, vendorId }, data: { active: false } });
    if (!done.count) throw new NotFoundException('Not found.');
    return { ok: true };
  }

  private step(d: Date, f: string): Date { return addMonths(d, f === 'YEARLY' ? 12 : f === 'QUARTERLY' ? 3 : 1); }

  /** Issue every recurring invoice that is due. Idempotent per template and run date, so a second server or a rerun creates nothing twice. */
  async runRecurring(now = new Date()): Promise<{ created: number }> {
    const due = await this.prisma.bosRecurring.findMany({ where: { active: true, nextRunOn: { lte: now } }, take: 500 });
    let created = 0;
    for (const r of due) {
      try {
        if (r.endsOn && r.endsOn < now) { await this.prisma.bosRecurring.update({ where: { id: r.id }, data: { active: false } }); continue; }
        const allowed = await this.ent.resolve(r.vendorId);
        if (!allowed.capabilities['bos.recurring']?.allowed) continue; // downgraded: kept, paused (never deleted)
        const t = await this.prisma.bosDocument.findFirst({ where: { id: r.templateId, vendorId: r.vendorId }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
        if (!t) continue;
        const runKey = r.nextRunOn.toISOString().slice(0, 10);
        const res = await this.docs.createAndIssue(r.vendorId, {
          docType: 'SALES_INVOICE', partyId: t.partyId ?? undefined, partyName: t.partyName ?? undefined, taxKind: t.taxKind as 'GST' | 'NONE', priceMode: t.priceMode as 'EXCLUSIVE' | 'INCLUSIVE',
          discount: t.discountPaise / 100, shipping: t.shippingPaise / 100, notes: t.notes ?? undefined, terms: t.terms ?? undefined, docDate: r.nextRunOn, dueDate: t.dueDate ? new Date(r.nextRunOn.getTime() + (t.dueDate.getTime() - t.docDate.getTime())) : undefined,
          source: 'RECURRING', idempotencyKey: `rec:${r.id}:${runKey}`,
          lines: t.lines.map((l) => ({ itemId: l.itemId ?? undefined, name: l.name, description: l.description ?? undefined, variantKey: l.variantKey ?? undefined, hsn: l.hsn ?? undefined, unit: l.unit ?? undefined, qty: l.qty, rate: l.ratePaise / 100, discount: l.discountPaise / 100, gstRate: l.gstRate })),
        });
        if (!res.replayed) created += 1;
        await this.prisma.bosRecurring.update({ where: { id: r.id }, data: { lastRunOn: r.nextRunOn, nextRunOn: this.step(r.nextRunOn, r.frequency) } });
      } catch (e) { this.logger.warn(`Recurring ${r.id} failed: ${e instanceof Error ? e.message : 'error'}`); }
    }
    return { created };
  }

  /** One notification a day per vendor listing who is overdue (Pro). The vendor sends the reminder from the outstanding screen (WhatsApp link). */
  async runReminders(now = new Date()): Promise<{ notified: number }> {
    const rows = await this.prisma.bosDocument.groupBy({ by: ['vendorId'], where: { docType: 'SALES_INVOICE', status: { in: ['ISSUED', 'PART_PAID'] }, dueDate: { lt: now } }, _count: true, _sum: { totalPaise: true, paidPaise: true } });
    let notified = 0;
    for (const g of rows) {
      try {
        const e = await this.ent.resolve(g.vendorId);
        if (!e.capabilities['bos.recurring']?.allowed) continue;
        const since = new Date(now.getTime() - 20 * 3_600_000);
        const recent = await this.prisma.notification.findFirst({ where: { recipientId: g.vendorId, type: 'PAYMENT_REMINDERS', createdAt: { gte: since } }, select: { id: true } });
        if (recent) continue;
        const owed = (g._sum.totalPaise ?? 0) - (g._sum.paidPaise ?? 0);
        if (owed <= 0) continue;
        await this.notifications.notifyVendor(g.vendorId, 'PAYMENT_REMINDERS', `${g._count} overdue invoice${g._count === 1 ? '' : 's'}`, `₹${(owed / 100).toLocaleString('en-IN')} is overdue. Open Customer invoices > Outstanding to send reminders.`, { priority: 'INFO' });
        notified += 1;
      } catch (e) { this.logger.warn(`Reminder for ${g.vendorId} failed: ${e instanceof Error ? e.message : 'error'}`); }
    }
    return { notified };
  }

  /** The optional daily low-stock message (an in-app notification, once a day, only when something is low). A vendor can switch it off on the Stock screen. */
  async runLowStock(now = new Date()): Promise<{ notified: number }> {
    const vendors = await this.prisma.vendorProduct.groupBy({ by: ['vendorId'], where: { trackStock: true, reorderLevel: { not: null }, active: true } });
    let notified = 0;
    for (const g of vendors) {
      try {
        const off = await this.prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId: g.vendorId, addonKey: 'bos_lowstock_daily' } } });
        if (off && off.enabled === false) continue;
        const items = await this.prisma.vendorProduct.findMany({ where: { vendorId: g.vendorId, trackStock: true, reorderLevel: { not: null }, active: true }, select: { name: true, stockQty: true, reorderLevel: true } });
        const low = items.filter((i) => (i.stockQty ?? 0) <= (i.reorderLevel ?? 0));
        if (!low.length) continue;
        const since = new Date(now.getTime() - 20 * 3_600_000);
        const recent = await this.prisma.notification.findFirst({ where: { recipientId: g.vendorId, type: 'LOW_STOCK_DAILY', createdAt: { gte: since } }, select: { id: true } });
        if (recent) continue;
        await this.notifications.notifyVendor(g.vendorId, 'LOW_STOCK_DAILY', `${low.length} item${low.length === 1 ? ' is' : 's are'} low on stock`, `${low.slice(0, 5).map((i) => `${i.name} (${i.stockQty ?? 0} left)`).join(', ')}${low.length > 5 ? ` and ${low.length - 5} more` : ''}. Open Stock to reorder.`, { priority: 'INFO' });
        notified += 1;
      } catch (e) { this.logger.warn(`Low-stock message for ${g.vendorId} failed: ${e instanceof Error ? e.message : 'error'}`); }
    }
    return { notified };
  }

  @Cron('30 6 * * *', { timeZone: 'Asia/Kolkata' })
  async daily(): Promise<void> {
    try { this.logger.log(`BOS daily: recurring ${JSON.stringify(await this.runRecurring())}, reminders ${JSON.stringify(await this.runReminders())}, low stock ${JSON.stringify(await this.runLowStock())}`); }
    catch (e) { this.logger.error(`BOS daily job failed: ${e instanceof Error ? e.message : 'error'}`); }
  }
}
