import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import Razorpay from 'razorpay';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VendorPaymentsService } from '../vendor-payments/vendor-payments.service';
import { CrmService } from '../crm/crm.service';
import { CheckoutLine, CheckoutOrderInput, CheckoutConfirmInput, OrderRequestInput } from './engine.dto';
import { StockService } from '../stock/stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { normaliseStatus } from '../stock/stock-rules';
import type { StockChange } from '../stock/stock.service';
import { assertCapturedPayment, checkoutSignatureValid, lockPayment } from '../payments/payment-verification';
import { BosOrderBridge } from '../bos/flows.service';
import { PricedLine, baseProductName, cartHash, cartTotalPaise, parseListedPrice } from './checkout-pricing';

export interface WebOrder {
  id: string;
  items: unknown;
  total: number;
  paymentMethod: string;
  /** completed (paid) | PENDING_PAYMENT (order request awaiting the shop) | CANCELLED | refunded */
  status: string;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  deliveryAddress: string | null;
  orderNote: string | null;
  orderSource: string | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
}

export type CheckoutMode = 'ONLINE' | 'ORDER_REQUEST' | 'NONE';

/** The line shape stored in PosSale.items so a cancel can restore exactly what was reserved. */
interface RecordedLine { productId: string | null; catalogItemId: string | null; name: string; qty: number; price: number; tracked: boolean }

/**
 * Public-website checkout. Payments go DIRECTLY into the vendor's own Razorpay account
 * (their keys), so Get4Domain never holds funds. Every cart line is priced server-side from the
 * vendor's catalogue — no client price or total is ever trusted. On a verified payment the order
 * is recorded as a PosSale (type 'web') and stocked CatalogItems are decremented, in one
 * transaction — reusing the existing sales/stock tables, no parallel order system. Works for any
 * industry (a "line" can be a product, a booking fee, etc.).
 */
@Injectable()
export class PublicCheckoutService {
  private readonly logger = new Logger(PublicCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorPayments: VendorPaymentsService,
    private readonly crm: CrmService,
    // Handover 2026-10-08 (optional so older manual constructions in tests keep working):
    @Optional() private readonly stock?: StockService,
    @Optional() private readonly notifications?: NotificationsService,
    // Full BOS (optional so older manual constructions in tests keep working): a website order creates its customer and its invoice.
    @Optional() private readonly bos?: BosOrderBridge,
  ) {}

  /** How this vendor takes orders: online (own Razorpay keys), as a request the shop confirms, or not at all. */
  async getMode(vendorId: string): Promise<CheckoutMode> {
    const row = await this.prisma.vendorPaymentConfig.findUnique({ where: { vendorId } });
    if (row?.checkoutMode === 'ORDER_REQUEST') return 'ORDER_REQUEST';
    return row?.enabled && row.razorpayKeyId && row.razorpayKeySecret ? 'ONLINE' : 'NONE';
  }

  /** The vendor's public web orders (recorded as PosSale type 'web'), newest first. */
  async listWebOrders(vendorId: string): Promise<WebOrder[]> {
    const rows = await this.prisma.posSale.findMany({
      where: { vendorId, type: 'web' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id, items: r.items, total: r.total, paymentMethod: r.paymentMethod, status: r.status, createdAt: r.createdAt,
      customerName: r.customerName, customerPhone: r.customerPhone, customerEmail: r.customerEmail, deliveryAddress: r.deliveryAddress,
      orderNote: r.orderNote, orderSource: r.orderSource, paidAt: r.paidAt, cancelledAt: r.cancelledAt,
    }));
  }

  /**
   * Resolve every cart line to one of THIS vendor's active products and price it from the database.
   * The client's `price` is never read. Unknown / inactive / non-purchasable lines reject the cart.
   */
  async priceCart(vendorId: string, items: CheckoutLine[]): Promise<PricedLine[]> {
    const [products, catalog] = await Promise.all([
      this.prisma.vendorProduct.findMany({ where: { vendorId, active: true }, select: { id: true, name: true, price: true, active: true, status: true, trackStock: true, stockQty: true } }),
      this.prisma.catalogItem.findMany({ where: { vendorId, active: true }, select: { id: true, name: true, price: true, stock: true } }),
    ]);
    const unavailable = () => new BadRequestException('One or more items are no longer available for online purchase.');

    type Hit = { id: string; name: string; priceValue: number | null; stock?: number | null; tracked?: boolean; blocked?: 'hidden' | 'out' };
    const asProduct = (p: (typeof products)[number]): Hit => {
      const status = normaliseStatus(p.status, p.active !== false); // the query already filters active rows
      return {
        id: p.id, name: p.name, priceValue: parseListedPrice(p.price), tracked: p.trackStock,
        stock: p.trackStock ? (p.stockQty ?? 0) : undefined, // preflight only — the authoritative check is the conditional UPDATE in StockService.reserve
        blocked: status === 'HIDDEN' ? 'hidden' : status === 'OUT_OF_STOCK' ? 'out' : undefined,
      };
    };
    const asCatalog = (c: (typeof catalog)[number]): Hit => ({ id: c.id, name: c.name, priceValue: c.price > 0 ? c.price : null, stock: c.stock });

    return items.map((line): PricedLine => {
      const id = line.productId ?? line.catalogItemId;
      let source: PricedLine['source'];
      let hit: Hit;

      if (id) {
        const p = products.find((x) => x.id === id);
        const c = p ? undefined : catalog.find((x) => x.id === id);
        if (p) { source = 'product'; hit = asProduct(p); }
        else if (c) { source = 'catalog'; hit = asCatalog(c); }
        else throw unavailable();
      } else {
        const wanted = baseProductName(line.name);
        const ps = products.filter((x) => x.name.trim().toLowerCase() === wanted);
        const cs = catalog.filter((x) => x.name.trim().toLowerCase() === wanted);
        if (ps.length + cs.length !== 1) throw unavailable(); // unknown, or ambiguous → never guess
        if (ps.length === 1) { source = 'product'; hit = asProduct(ps[0]); }
        else { source = 'catalog'; hit = asCatalog(cs[0]); }
      }

      if (hit.priceValue === null) throw unavailable();
      if (hit.blocked === 'hidden') throw unavailable();
      if (hit.blocked === 'out') throw new BadRequestException(`"${hit.name}" is out of stock.`);
      if (hit.stock != null && hit.stock < line.qty) {
        throw new BadRequestException(hit.stock > 0 ? `"${hit.name}" is out of stock for that quantity — only ${hit.stock} left.` : `"${hit.name}" is out of stock.`);
      }
      const label = line.name.trim().toLowerCase().startsWith(hit.name.trim().toLowerCase()) ? line.name.trim() : hit.name;
      return {
        itemId: hit.id,
        source,
        catalogItemId: source === 'catalog' ? hit.id : null,
        name: label,
        qty: line.qty,
        unitPaise: Math.round(hit.priceValue * 100),
        tracked: source === 'product' ? Boolean(hit.tracked) : undefined,
      };
    });
  }

  /**
   * Create a Razorpay order using the VENDOR's keys. The amount is computed here from the
   * database — the request carries no usable price. The order is stamped with the cart's
   * identity so a payment can only ever be confirmed for the cart it was created for.
   */
  async createOrder(vendorId: string, input: CheckoutOrderInput): Promise<{ razorpayOrderId: string; keyId: string; amount: number; currency: string }> {
    const keys = await this.vendorPayments.getKeys(vendorId);
    if (!keys) throw new BadRequestException('This business has not enabled online payments yet.');
    const lines = await this.priceCart(vendorId, input.items);
    const paise = cartTotalPaise(lines);
    if (paise <= 0) throw new BadRequestException('Order total must be greater than zero.');

    const rzp = this.razorpayFor(keys);
    const order = await rzp.orders.create({
      amount: paise,
      currency: 'INR',
      receipt: `web_${Date.now()}`,
      notes: { purpose: 'web_checkout', vendorId, cart: cartHash(lines) },
    });
    return { razorpayOrderId: order.id, keyId: keys.keyId, amount: Number(order.amount), currency: order.currency };
  }

  /**
   * Confirm a web order. Razorpay itself is asked whether a CAPTURED payment exists on an order our
   * server created for THIS vendor and THIS cart; the recorded total is the amount actually paid
   * (the order amount), never a client figure. Idempotent per payment id: replaying the same
   * confirmation returns the original sale and has no further effect (no second sale, stock
   * decrement or CRM lead).
   */
  async confirm(vendorId: string, input: CheckoutConfirmInput): Promise<{ ok: true; saleId: string; amount: number }> {
    const keys = await this.vendorPayments.getKeys(vendorId);
    if (!keys) throw new BadRequestException('This business has not enabled online payments yet.');

    // Replay of an already-recorded payment: answer from the stored sale BEFORE pricing, because the first confirmation
    // legitimately reduced stock and re-pricing the same cart against it would wrongly fail. Only after the signature
    // proves the caller really holds this payment.
    const holdsPayment = checkoutSignatureValid(keys.keySecret, input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature);
    if (holdsPayment) {
      const prior = await this.prisma.posSale.findUnique({ where: { razorpayPaymentId: input.razorpayPaymentId } });
      if (prior && prior.vendorId === vendorId) return { ok: true, saleId: prior.id, amount: prior.total };
    }

    let lines: PricedLine[];
    try {
      lines = await this.priceCart(vendorId, input.items);
    } catch (e) {
      // The shopper has genuinely paid (signature is valid) but the cart can no longer be fulfilled — say so loudly.
      if (holdsPayment && e instanceof BadRequestException) throw await this.paidShortfall(vendorId, input.razorpayPaymentId, input.name, e.message);
      throw e;
    }
    const confirmed = await assertCapturedPayment(this.razorpayFor(keys), {
      secret: keys.keySecret,
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
      expectedNotes: { purpose: 'web_checkout', vendorId, cart: cartHash(lines) },
    });
    const rupees = confirmed.amountPaise / 100;
    if (confirmed.amountPaise !== cartTotalPaise(lines)) {
      this.logger.warn(`Web order ${input.razorpayOrderId}: paid ₹${rupees} differs from the current catalogue total (prices changed since checkout started)`);
    }
    const recorded = this.recordLines(lines);

    let stockChanges: StockChange[] = [];
    let shortfall: string | null = null;
    const result = await this.prisma.$transaction(async (tx) => {
      await lockPayment(tx, confirmed.paymentId);
      const existing = await tx.posSale.findUnique({ where: { razorpayPaymentId: confirmed.paymentId } });
      if (existing) return { sale: existing, created: false };

      const sale = await tx.posSale.create({
        data: {
          vendorId,
          type: 'web',
          items: recorded as unknown as Prisma.InputJsonValue,
          subtotal: rupees,
          taxAmount: 0,
          total: rupees,
          paymentMethod: 'razorpay',
          status: 'completed',
          razorpayOrderId: confirmed.orderId,
          razorpayPaymentId: confirmed.paymentId,
        },
      });
      // Stock: all-or-nothing in THIS transaction. A shortage after the customer paid rolls the whole order back and is
      // reported loudly (the vendor is notified with the payment id so the money can be refunded) instead of vanishing.
      try {
        stockChanges = await this.reserveLines(tx, vendorId, lines, sale.id, `pay:${confirmed.paymentId}`);
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof ConflictException) shortfall = e.message;
        throw e;
      }
      return { sale, created: true };
    }).catch(async (e: unknown) => {
      if (shortfall) throw await this.paidShortfall(vendorId, confirmed.paymentId, input.name, shortfall);
      throw e;
    });

    if (!result.created) {
      return { ok: true, saleId: result.sale.id, amount: result.sale.total }; // replay — nothing else happens
    }
    const sale = result.sale;
    await this.stock?.notifyLow(vendorId, stockChanges);

    // Capture the buyer in the vendor's CRM too (contact + what they bought) — so the
    // vendor has the customer's details, not just the sale. Best-effort; never fails the order.
    try {
      const summary = lines.map((l) => `${l.qty}× ${l.name}`).join(', ');
      await this.crm.createLead(vendorId, {
        name: input.name,
        phone: input.phone,
        message: `Web order ₹${rupees}: ${summary}${input.note ? ` — ${input.note}` : ''}`,
        source: 'web-order',
        customFields: { saleId: sale.id, ...(input.email ? { email: input.email } : {}) },
      });
    } catch (e) {
      this.logger.warn(`Web order ${sale.id} recorded but CRM lead failed: ${e instanceof Error ? e.message : 'error'}`);
    }

    await this.bos?.onOrder(vendorId, sale.id, 'PAID');
    this.logger.log(`Web order ${sale.id} recorded for vendor ${vendorId} (₹${rupees})`);
    return { ok: true, saleId: sale.id, amount: rupees };
  }

  // ── Shared helpers ────────────────────────────────────────────────────────────────────────────

  /** The shopper paid but the goods are gone: tell the shopper clearly AND tell the vendor (with the payment id) so the money can be refunded. */
  private async paidShortfall(vendorId: string, paymentId: string, buyerName: string, reason: string): Promise<ConflictException> {
    const what = reason.replace(/\.$/, '');
    try {
      await this.notifications?.notifyVendor(vendorId, 'PAID_SHORTFALL', `Paid order could not be fulfilled — ${buyerName}`, `${what}. Payment ${paymentId} was captured but no order was created. Refund or contact the customer.`, { priority: 'URGENT', data: { paymentId } });
    } catch (e) { this.logger.warn(`Paid shortfall for ${paymentId} but notification failed: ${e instanceof Error ? e.message : 'error'}`); }
    this.logger.error(`Paid shortfall: payment ${paymentId} captured for vendor ${vendorId} but ${what}`);
    return new ConflictException(`Your payment was received, but ${what} just now. The shop will contact you to refund or substitute — please quote payment ${paymentId}.`);
  }

  private recordLines(lines: PricedLine[]): RecordedLine[] {
    return lines.map((l) => ({
      productId: l.source === 'product' ? l.itemId : null, catalogItemId: l.catalogItemId, name: l.name, qty: l.qty, price: l.unitPaise / 100,
      tracked: l.source === 'product' ? Boolean(l.tracked) : false,
    }));
  }

  /** Reserve stock for every line inside the caller's transaction (VendorProduct via StockService, CatalogItem via a guarded UPDATE). */
  private async reserveLines(tx: Prisma.TransactionClient, vendorId: string, lines: PricedLine[], saleId: string, prefix: string): Promise<StockChange[]> {
    let changes: StockChange[] = [];
    const productLines = lines.filter((l) => l.source === 'product').map((l) => ({ productId: l.itemId, qty: l.qty }));
    if (productLines.length && this.stock) changes = await this.stock.reserve(tx, vendorId, productLines, { type: 'ORDER', id: saleId }, prefix, 'ONLINE_ORDER');
    for (const line of lines) {
      if (!line.catalogItemId) continue;
      // Tracked CatalogItems only; the `stock >= qty` guard means it can never go negative.
      const done = await tx.catalogItem.updateMany({ where: { id: line.catalogItemId, vendorId, stock: { gte: line.qty } }, data: { stock: { decrement: line.qty } } });
      if (done.count === 0) {
        const tracked = await tx.catalogItem.findMany({ where: { id: line.catalogItemId, vendorId, stock: { not: null } }, select: { id: true } });
        if (tracked.length > 0) throw new BadRequestException(`"${line.name}" is out of stock.`);
      }
    }
    return changes;
  }

  // ── ORDER_REQUEST checkout (no online payment) ────────────────────────────────────────────────

  /**
   * Public: the shopper sends an order REQUEST. Stock is reserved in the same transaction that saves the order
   * (PENDING_PAYMENT); the shop contacts the customer, then marks it Paid or Cancelled (cancel restores stock).
   * Idempotent per (vendor, idempotencyKey): a double submit returns the same order.
   */
  async placeOrderRequest(vendorId: string, input: OrderRequestInput): Promise<{ ok: true; orderId: string; status: string; amount: number; replayed: boolean }> {
    if ((await this.getMode(vendorId)) !== 'ORDER_REQUEST') throw new BadRequestException('This shop is not taking order requests.');
    const phone = (input.phone ?? '').replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) throw new BadRequestException('Enter a 10-digit mobile number.');
    const found = await this.prisma.posSale.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } } });
    if (found) return { ok: true, orderId: found.id, status: found.status, amount: found.total, replayed: true };

    const lines = await this.priceCart(vendorId, input.items);
    const paise = cartTotalPaise(lines);
    if (paise <= 0) throw new BadRequestException('Order total must be greater than zero.');
    const rupees = paise / 100;

    let changes: StockChange[] = [];
    let sale;
    try {
      sale = await this.prisma.$transaction(async (tx) => {
        const created = await tx.posSale.create({
          data: {
            vendorId, type: 'web', items: this.recordLines(lines) as unknown as Prisma.InputJsonValue, subtotal: rupees, taxAmount: 0, total: rupees,
            paymentMethod: 'order_request', status: 'PENDING_PAYMENT', orderSource: 'storefront', idempotencyKey: input.idempotencyKey,
            customerName: input.name.trim(), customerPhone: phone, customerEmail: input.email?.trim() || null,
            deliveryAddress: input.address.trim(), orderNote: input.note?.trim() || null,
          },
        });
        changes = await this.reserveLines(tx, vendorId, lines, created.id, `order:${created.id}`);
        return created;
      });
    } catch (e) {
      // a racing duplicate submit: the loser rolled back entirely — hand back the winner's order
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await this.prisma.posSale.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } } });
        if (again) return { ok: true, orderId: again.id, status: again.status, amount: again.total, replayed: true };
      }
      throw e;
    }

    // After commit, best effort: CRM lead, vendor notification, low-stock alerts.
    const summary = lines.map((l) => `${l.qty}× ${l.name}`).join(', ');
    try {
      await this.crm.createLead(vendorId, { name: input.name, phone, message: `Order request ₹${rupees}: ${summary} — deliver to: ${input.address}${input.note ? ` — ${input.note}` : ''}`, source: 'web-order', customFields: { saleId: sale.id, ...(input.email ? { email: input.email } : {}) } });
    } catch (e) { this.logger.warn(`Order ${sale.id} saved but CRM lead failed: ${e instanceof Error ? e.message : 'error'}`); }
    try {
      await this.notifications?.notifyVendor(vendorId, 'NEW_ORDER', `New order: ${input.name} — ₹${rupees}`, `${summary}. Phone ${phone}. Open Orders to confirm.`, { priority: 'INFO', data: { orderId: sale.id }, actionRequired: true, actionType: 'OPEN_ORDER', actionData: { orderId: sale.id } });
    } catch (e) { this.logger.warn(`Order ${sale.id} saved but notification failed: ${e instanceof Error ? e.message : 'error'}`); }
    await this.stock?.notifyLow(vendorId, changes);
    await this.bos?.onOrder(vendorId, sale.id, 'PLACED');
    this.logger.log(`Order request ${sale.id} for vendor ${vendorId} (₹${rupees})`);
    return { ok: true, orderId: sale.id, status: sale.status, amount: rupees, replayed: false };
  }

  /** Vendor: the customer paid the shop directly. Only an order that is awaiting payment can be marked paid. */
  async markOrderPaid(vendorId: string, orderId: string): Promise<WebOrder> {
    const done = await this.prisma.posSale.updateMany({ where: { id: orderId, vendorId, type: 'web', status: 'PENDING_PAYMENT' }, data: { status: 'completed', paidAt: new Date() } });
    if (done.count === 0) {
      const exists = await this.prisma.posSale.findFirst({ where: { id: orderId, vendorId, type: 'web' } });
      if (!exists) throw new NotFoundException('Order not found');
      throw new ConflictException('This order is not waiting for payment.');
    }
    await this.bos?.onOrder(vendorId, orderId, 'PAID');
    return (await this.listWebOrders(vendorId)).find((o) => o.id === orderId) as WebOrder;
  }

  /** Vendor: cancel an order. The status change and the stock restore happen in ONE transaction; a second cancel is refused. */
  async cancelOrder(vendorId: string, orderId: string, actor?: string): Promise<WebOrder> {
    await this.prisma.$transaction(async (tx) => {
      const sale = await tx.posSale.findFirst({ where: { id: orderId, vendorId, type: 'web' } });
      if (!sale) throw new NotFoundException('Order not found');
      const claim = await tx.posSale.updateMany({ where: { id: orderId, vendorId, status: { in: ['PENDING_PAYMENT', 'completed'] } }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      if (claim.count === 0) throw new ConflictException('This order is already cancelled.');
      const recorded = (Array.isArray(sale.items) ? (sale.items as unknown as RecordedLine[]) : []);
      const tracked = recorded.filter((l) => l.productId && l.tracked).map((l) => ({ productId: l.productId as string, qty: l.qty }));
      if (tracked.length && this.stock) await this.stock.restore(tx, vendorId, tracked, { type: 'ORDER', id: orderId }, `cancel:${orderId}`, 'CANCEL', actor);
      for (const l of recorded) {
        if (l.catalogItemId) await tx.catalogItem.updateMany({ where: { id: l.catalogItemId, vendorId, stock: { not: null } }, data: { stock: { increment: l.qty } } });
      }
    });
    await this.bos?.onOrder(vendorId, orderId, 'CANCELLED');
    return (await this.listWebOrders(vendorId)).find((o) => o.id === orderId) as WebOrder;
  }

  /** Razorpay client for the vendor's own account. Overridable for tests. */
  protected razorpayFor(keys: { keyId: string; keySecret: string }): Razorpay {
    return new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
  }
}
