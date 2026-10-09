import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Invoice, LeadPurseEntry, LeadRefillPack } from '@prisma/client';
import Razorpay from 'razorpay';
import { InvoicesService } from '../invoices/invoices.service';
import { WhatsappGatewayService } from '../messaging/whatsapp/whatsapp-gateway.service';
import { RazorpayFetchClient, assertCapturedPayment, lockPayment } from '../payments/payment-verification';
import { PrismaService } from '../prisma/prisma.service';
import { LeadCaptureService } from './capture.service';
import { normalizePhone, rupeesText } from './leadspace.types';
import { LeadPurseService } from './purse.service';
import { LeadspaceSettingsService } from './settings.service';

export type GstMode = 'INCLUSIVE' | 'EXCLUSIVE';
export interface RefillQuote { packId: string | null; label: string; payPaise: number; creditPaise: number; gstMode: GstMode; gstPercent: number; gstPaise: number; chargePaise: number }

/** The Razorpay calls this service makes, so a test can stand in for the gateway. */
export interface RazorpayLike extends RazorpayFetchClient {
  orders: RazorpayFetchClient['orders'] & { create(o: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<{ id: string; amount: number | string; currency: string }> };
}

export const DEFAULT_PACKS: { label: string; payPaise: number; creditPaise: number; sort: number }[] = [
  { label: 'Starter', payPaise: 199900, creditPaise: 199900, sort: 1 },
  { label: 'Growth', payPaise: 299900, creditPaise: 299900, sort: 2 },
];

/** Pure: what a customer is asked to pay and what lands in the wallet. EXCLUSIVE means `pay` is before GST and GST is added on top. */
export function quote(payPaise: number, gstMode: GstMode, gstPercent: number): { gstPaise: number; chargePaise: number } {
  if (gstMode === 'EXCLUSIVE') {
    const gst = Math.round((payPaise * gstPercent) / 100);
    return { gstPaise: gst, chargePaise: payPaise + gst };
  }
  const taxable = Math.round(payPaise / (1 + gstPercent / 100));
  return { gstPaise: payPaise - taxable, chargePaise: payPaise };
}

/**
 * Wallet refill through Get4Domain's own Razorpay (this is money the vendor pays Get4Domain, so the platform keys are right; a vendor's own gateway
 * is for what their customers pay them). On a captured payment: credit the LEADS purse once, issue a GST tax invoice from the existing invoice engine
 * with the line "LeadSpace wallet refill", e-mail it, release any held customers oldest first.
 */
@Injectable()
export class LeadRefillService {
  private readonly logger = new Logger(LeadRefillService.name);
  private rzp: RazorpayLike | null = null;

  constructor(
    private readonly prisma: PrismaService, private readonly purse: LeadPurseService, private readonly settings: LeadspaceSettingsService,
    private readonly invoices: InvoicesService, private readonly capture: LeadCaptureService, private readonly gateway: WhatsappGatewayService,
  ) {}

  setGateway(client: RazorpayLike): void { this.rzp = client; }
  private client(): RazorpayLike {
    if (!this.rzp) this.rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID as string, key_secret: process.env.RAZORPAY_KEY_SECRET as string }) as unknown as RazorpayLike;
    return this.rzp;
  }

  async ensurePacks(): Promise<void> {
    if ((await this.prisma.leadRefillPack.count()) > 0) return;
    await this.prisma.leadRefillPack.createMany({ data: DEFAULT_PACKS.map((p) => ({ ...p, gstMode: 'INCLUSIVE' })) });
  }

  async packs(activeOnly = true): Promise<(LeadRefillPack & { quote: { gstPaise: number; chargePaise: number } })[]> {
    await this.ensurePacks();
    const s = await this.settings.get();
    const rows = await this.prisma.leadRefillPack.findMany({ where: activeOnly ? { active: true } : {}, orderBy: [{ sort: 'asc' }, { payPaise: 'asc' }] });
    return rows.map((p) => ({ ...p, quote: quote(p.payPaise, p.gstMode as GstMode, s.gstPercent) }));
  }

  async customLimits(): Promise<{ minPaise: number; maxPaise: number; creditPercent: number; gstMode: GstMode }> {
    const s = await this.settings.get();
    return { minPaise: s.refillCustomMinPaise, maxPaise: s.refillCustomMaxPaise, creditPercent: s.customCreditPercent, gstMode: s.customGstMode };
  }

  async savePack(input: { id?: string; label: string; payPaise: number; creditPaise: number; gstMode: GstMode; active?: boolean; sort?: number }): Promise<LeadRefillPack> {
    if (input.creditPaise < input.payPaise * 0.5) throw new BadRequestException('The credited amount looks too low for the price. Check the pack.');
    const data = { label: input.label, payPaise: input.payPaise, creditPaise: input.creditPaise, gstMode: input.gstMode, active: input.active ?? true, sort: input.sort ?? 0 };
    if (input.id) {
      if (!(await this.prisma.leadRefillPack.findUnique({ where: { id: input.id } }))) throw new NotFoundException('We could not find that pack.');
      return this.prisma.leadRefillPack.update({ where: { id: input.id }, data });
    }
    return this.prisma.leadRefillPack.create({ data });
  }

  private async resolve(pick: { packId?: string; customPaise?: number }): Promise<RefillQuote> {
    const s = await this.settings.get();
    if (pick.packId) {
      await this.ensurePacks();
      const p = await this.prisma.leadRefillPack.findUnique({ where: { id: pick.packId } });
      if (!p || !p.active) throw new BadRequestException('That pack is not available. Choose another one.');
      const q = quote(p.payPaise, p.gstMode as GstMode, s.gstPercent);
      return { packId: p.id, label: p.label, payPaise: p.payPaise, creditPaise: p.creditPaise, gstMode: p.gstMode as GstMode, gstPercent: s.gstPercent, ...q };
    }
    const amount = pick.customPaise ?? 0;
    if (!Number.isInteger(amount) || amount < s.refillCustomMinPaise || amount > s.refillCustomMaxPaise) {
      throw new BadRequestException(`Enter an amount between ${rupeesText(s.refillCustomMinPaise)} and ${rupeesText(s.refillCustomMaxPaise)}.`);
    }
    const credit = Math.round((amount * s.customCreditPercent) / 100);
    const q = quote(amount, s.customGstMode, s.gstPercent);
    return { packId: null, label: 'Custom amount', payPaise: amount, creditPaise: credit, gstMode: s.customGstMode, gstPercent: s.gstPercent, ...q };
  }

  /** Step one: the exact amounts and a Razorpay order the vendor can pay. */
  async createOrder(vendorId: string, pick: { packId?: string; customPaise?: number }): Promise<{ orderId: string; keyId: string | null; quote: RefillQuote }> {
    const q = await this.resolve(pick);
    const order = await this.client().orders.create({
      amount: q.chargePaise, currency: 'INR', receipt: `ls_${vendorId.slice(-8)}_${Date.now()}`.slice(0, 40),
      notes: { purpose: 'leadspace_refill', vendorId, packId: q.packId ?? 'custom', creditPaise: String(q.creditPaise), payPaise: String(q.payPaise), gstMode: q.gstMode, gstPercent: String(q.gstPercent) },
    });
    return { orderId: order.id, keyId: process.env.RAZORPAY_KEY_ID ?? null, quote: q };
  }

  /**
   * Step two: credit a refill ONLY when Razorpay confirms a captured payment on an order our server made for THIS vendor for this purpose.
   * The credited amount is read from the order's notes (written by our server), never from the browser. Idempotent per payment id.
   */
  async verify(vendorId: string, p: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }): Promise<{ credited: boolean; balancePaise: number; released: number; invoiceNumber: string | null }> {
    const client = this.client();
    const order = await client.orders.fetch(p.razorpayOrderId).catch(() => null);
    const notes = (order?.notes && !Array.isArray(order.notes) ? order.notes : {}) as Record<string, string>;
    if (!order || notes.purpose !== 'leadspace_refill' || notes.vendorId !== vendorId) throw new BadRequestException('Payment could not be verified for this purchase');
    const credit = Number(notes.creditPaise);
    const gstPercent = Number(notes.gstPercent);
    if (!Number.isInteger(credit) || credit <= 0) throw new BadRequestException('Payment could not be verified for this purchase');
    const confirmed = await assertCapturedPayment(client, {
      secret: process.env.RAZORPAY_KEY_SECRET, orderId: p.razorpayOrderId, paymentId: p.razorpayPaymentId, signature: p.razorpaySignature,
      expectedNotes: { purpose: 'leadspace_refill', vendorId },
    });
    return this.credit(vendorId, confirmed.paymentId, confirmed.amountPaise, credit, Number.isFinite(gstPercent) ? gstPercent : 18, `${notes.packId === 'custom' ? 'Custom' : 'Pack'} refill`);
  }

  private async credit(vendorId: string, paymentId: string, paidPaise: number, creditPaise: number, gstPercent: number, label: string): Promise<{ credited: boolean; balancePaise: number; released: number; invoiceNumber: string | null }> {
    const s = await this.settings.get();
    const expiresAt = new Date(); expiresAt.setMonth(expiresAt.getMonth() + s.expiryMonths);
    const outcome = await this.prisma.$transaction(async (tx) => {
      await lockPayment(tx, paymentId);
      const r = await this.purse.credit(tx, { vendorId, amountPaise: creditPaise, reason: 'REFILL', idempotencyKey: `refill:${paymentId}`, razorpayId: paymentId, refType: 'Razorpay', refId: paymentId, note: `${label}: ${rupeesText(paidPaise)} paid, ${rupeesText(creditPaise)} credited`, expiresAt });
      return r;
    });
    if (outcome.replayed) return { credited: false, balancePaise: outcome.balancePaise, released: 0, invoiceNumber: (await this.invoiceFor(paymentId))?.invoiceNumber ?? null };

    const invoice = await this.invoices.createPaidInvoice({
      vendorId, paidPaise, description: `LeadSpace wallet refill - ${rupeesText(creditPaise)} credited to the LeadSpace wallet`, paymentMode: 'LeadSpace wallet refill (Razorpay)', source: 'leadspace_refill', paymentId, gstRate: gstPercent / 100,
    }).catch(() => null);
    const released = await this.capture.releaseHeld(vendorId).catch((e: unknown) => { this.logger.warn(`Release after refill failed: ${e instanceof Error ? e.message : 'unknown'}`); return null; });
    void this.notifyReceipt(vendorId, creditPaise, invoice).catch(() => undefined);
    return { credited: true, balancePaise: released?.balancePaise ?? outcome.balancePaise, released: released?.released ?? 0, invoiceNumber: invoice?.invoiceNumber ?? null };
  }

  private async notifyReceipt(vendorId: string, creditPaise: number, invoice: Invoice | null): Promise<void> {
    const [p, v] = await Promise.all([this.prisma.leadspaceProfile.findUnique({ where: { vendorId } }), this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { phone: true, businessName: true } })]);
    const to = normalizePhone(p?.alertWhatsapp) ?? normalizePhone(p?.phone) ?? normalizePhone(v?.phone);
    if (to) await this.gateway.send({ template: 'leadspace_refill_receipt', phone: to, variables: [rupeesText(creditPaise), p?.businessName ?? v?.businessName ?? 'your business', invoice?.invoiceNumber ?? 'on its way'], vendorId });
  }

  private invoiceFor(paymentId: string): Promise<Invoice | null> { return this.prisma.invoice.findFirst({ where: { razorpayPaymentId: paymentId } }); }

  /** Webhook / admin safety net: the vendor paid but closed the browser before the verify call. Credits once, exactly like verify. */
  async reconcile(paymentId: string): Promise<{ credited: boolean; vendorId: string | null; reason?: string }> {
    const client = this.client();
    let payment: { id: string; order_id: string; amount: number | string; currency: string; status: string };
    try { payment = await client.payments.fetch(paymentId); } catch { return { credited: false, vendorId: null, reason: 'Razorpay could not find that payment.' }; }
    const order = await client.orders.fetch(payment.order_id).catch(() => null);
    const notes = (order?.notes && !Array.isArray(order.notes) ? order.notes : {}) as Record<string, string>;
    if (!order || notes.purpose !== 'leadspace_refill' || !notes.vendorId) return { credited: false, vendorId: null, reason: 'This payment is not a LeadSpace refill.' };
    if (payment.status !== 'captured' || Number(payment.amount) !== Number(order.amount) || payment.currency !== 'INR') return { credited: false, vendorId: notes.vendorId, reason: 'The payment is not captured for the full amount yet.' };
    const credit = Number(notes.creditPaise);
    if (!Number.isInteger(credit) || credit <= 0) return { credited: false, vendorId: notes.vendorId, reason: 'The order has no credit amount.' };
    const r = await this.credit(notes.vendorId, payment.id, Number(payment.amount), credit, Number(notes.gstPercent) || 18, 'Reconciled refill');
    return { credited: r.credited, vendorId: notes.vendorId };
  }

  /** Receipts under the Wallet tab: every refill with its tax invoice. */
  async receipts(vendorId: string): Promise<{ at: Date; creditPaise: number; paidRef: string | null; invoiceId: string | null; invoiceNumber: string | null; totalPaise: number | null; balanceAfter: number }[]> {
    const entries: LeadPurseEntry[] = await this.prisma.leadPurseEntry.findMany({ where: { vendorId, reason: 'REFILL' }, orderBy: { createdAt: 'desc' }, take: 100 });
    const ids = entries.map((e) => e.razorpayId).filter((x): x is string => Boolean(x));
    const invs = ids.length ? await this.prisma.invoice.findMany({ where: { vendorId, razorpayPaymentId: { in: ids } } }) : [];
    return entries.map((e) => {
      const inv = invs.find((i) => i.razorpayPaymentId === e.razorpayId);
      return { at: e.createdAt, creditPaise: e.amountPaise, paidRef: e.razorpayId, invoiceId: inv?.id ?? null, invoiceNumber: inv?.invoiceNumber ?? null, totalPaise: inv?.totalAmount ?? null, balanceAfter: e.balanceAfter };
    });
  }

  adminRefills(take = 100): Promise<LeadPurseEntry[]> { return this.prisma.leadPurseEntry.findMany({ where: { reason: 'REFILL' }, orderBy: { createdAt: 'desc' }, take: Math.min(take, 300) }); }
}
