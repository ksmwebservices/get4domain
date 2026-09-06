import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import Razorpay from 'razorpay';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VendorPaymentsService } from '../vendor-payments/vendor-payments.service';
import { CrmService } from '../crm/crm.service';
import { CheckoutOrderInput, CheckoutConfirmInput } from './engine.dto';

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
 * (their keys), so Get4Domain never holds funds. The cart total is always recomputed
 * server-side from the line items — the client total is never trusted. On a verified
 * payment the order is recorded as a PosSale (type 'web') and stocked CatalogItems are
 * decremented, in one transaction — reusing the existing sales/stock tables, no parallel
 * order system. Works for any industry (a "line" can be a product, a booking fee, etc.).
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

  private total(input: CheckoutOrderInput): number {
    return input.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  /** Create a Razorpay order using the VENDOR's keys. */
  async createOrder(vendorId: string, input: CheckoutOrderInput): Promise<{ razorpayOrderId: string; keyId: string; amount: number; currency: string }> {
    const keys = await this.vendorPayments.getKeys(vendorId);
    if (!keys) throw new BadRequestException('This business has not enabled online payments yet.');
    const rupees = this.total(input);
    if (rupees <= 0) throw new BadRequestException('Order total must be greater than zero.');

    const rzp = new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
    const order = await rzp.orders.create({
      amount: Math.round(rupees * 100), // paise
      currency: 'INR',
      receipt: `web_${vendorId}_${Date.now()}`.slice(0, 40),
    });
    return { razorpayOrderId: order.id, keyId: keys.keyId, amount: Number(order.amount), currency: order.currency };
  }

  /** Verify the payment with the vendor's secret, then record the sale + decrement stock. */
  async confirm(vendorId: string, input: CheckoutConfirmInput): Promise<{ ok: true; saleId: string; amount: number }> {
    const keys = await this.vendorPayments.getKeys(vendorId);
    if (!keys) throw new BadRequestException('This business has not enabled online payments yet.');

    const expected = createHmac('sha256', keys.keySecret)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
      .digest('hex');
    if (expected !== input.razorpaySignature) throw new BadRequestException('Payment verification failed');

    const rupees = this.total(input);
    const lines = input.items.map((i) => ({ catalogItemId: i.catalogItemId ?? null, name: i.name, qty: i.qty, price: i.price }));

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.posSale.create({
        data: {
          vendorId,
          type: 'web',
          items: lines as unknown as Prisma.InputJsonValue,
          subtotal: rupees,
          taxAmount: 0,
          total: rupees,
          paymentMethod: 'razorpay',
          status: 'completed',
        },
      });
      for (const line of input.items) {
        if (line.catalogItemId) {
          // Only decrement items that actually track stock; best-effort per line.
          await tx.catalogItem.updateMany({
            where: { id: line.catalogItemId, vendorId, stock: { not: null } },
            data: { stock: { decrement: line.qty } },
          });
        }
      }
      return created;
    });

    // Capture the buyer in the vendor's CRM too (contact + what they bought) — so the
    // vendor has the customer's details, not just the sale. Best-effort; never fails the order.
    try {
      const summary = input.items.map((l) => `${l.qty}× ${l.name}`).join(', ');
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
}
