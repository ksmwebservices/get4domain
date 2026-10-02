import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import Razorpay from 'razorpay';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VendorPaymentsService } from '../vendor-payments/vendor-payments.service';
import { CrmService } from '../crm/crm.service';
import { CheckoutLine, CheckoutOrderInput, CheckoutConfirmInput } from './engine.dto';
import { assertCapturedPayment, lockPayment } from '../payments/payment-verification';
import { PricedLine, baseProductName, cartHash, cartTotalPaise, parseListedPrice } from './checkout-pricing';

export interface WebOrder {
  id: string;
  items: unknown;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: Date;
}

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
  ) {}

  /** The vendor's public web orders (recorded as PosSale type 'web'), newest first. */
  async listWebOrders(vendorId: string): Promise<WebOrder[]> {
    const rows = await this.prisma.posSale.findMany({
      where: { vendorId, type: 'web' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({ id: r.id, items: r.items, total: r.total, paymentMethod: r.paymentMethod, status: r.status, createdAt: r.createdAt }));
  }

  /**
   * Resolve every cart line to one of THIS vendor's active products and price it from the database.
   * The client's `price` is never read. Unknown / inactive / non-purchasable lines reject the cart.
   */
  async priceCart(vendorId: string, items: CheckoutLine[]): Promise<PricedLine[]> {
    const [products, catalog] = await Promise.all([
      this.prisma.vendorProduct.findMany({ where: { vendorId, active: true }, select: { id: true, name: true, price: true } }),
      this.prisma.catalogItem.findMany({ where: { vendorId, active: true }, select: { id: true, name: true, price: true, stock: true } }),
    ]);
    const unavailable = () => new BadRequestException('One or more items are no longer available for online purchase.');

    type Hit = { id: string; name: string; priceValue: number | null; stock?: number | null };
    const asProduct = (p: (typeof products)[number]): Hit => ({ id: p.id, name: p.name, priceValue: parseListedPrice(p.price) });
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
      if (hit.stock != null && hit.stock < line.qty) throw new BadRequestException(`"${hit.name}" is out of stock.`);
      const label = line.name.trim().toLowerCase().startsWith(hit.name.trim().toLowerCase()) ? line.name.trim() : hit.name;
      return {
        itemId: hit.id,
        source,
        catalogItemId: source === 'catalog' ? hit.id : null,
        name: label,
        qty: line.qty,
        unitPaise: Math.round(hit.priceValue * 100),
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

    const lines = await this.priceCart(vendorId, input.items);
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
    const recorded = lines.map((l) => ({ catalogItemId: l.catalogItemId, name: l.name, qty: l.qty, price: l.unitPaise / 100 }));

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
      for (const line of lines) {
        if (line.catalogItemId) {
          // Only decrement items that actually track stock; best-effort per line.
          await tx.catalogItem.updateMany({
            where: { id: line.catalogItemId, vendorId, stock: { not: null } },
            data: { stock: { decrement: line.qty } },
          });
        }
      }
      return { sale, created: true };
    });

    if (!result.created) {
      return { ok: true, saleId: result.sale.id, amount: result.sale.total }; // replay — nothing else happens
    }
    const sale = result.sale;

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

    this.logger.log(`Web order ${sale.id} recorded for vendor ${vendorId} (₹${rupees})`);
    return { ok: true, saleId: sale.id, amount: rupees };
  }

  /** Razorpay client for the vendor's own account. Overridable for tests. */
  protected razorpayFor(keys: { keyId: string; keySecret: string }): Razorpay {
    return new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
  }
}
