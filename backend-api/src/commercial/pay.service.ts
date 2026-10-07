import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException, ServiceUnavailableException, HttpException } from '@nestjs/common';
import { Invoice, Prisma, Vendor } from '@prisma/client';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { InvoiceBuilderService, balanceDue, isPayable, ChannelT } from './invoice-builder.service';
import { SettlementService } from './settlement.service';
import { PayeeService, CommercialAuditService, CommercialMessenger } from './foundation.services';
import { hashPayToken, hashIp, isPlausiblePayToken } from './pay-token';
import { buildUpiLink, upiQrDataUrl, normalizeUtr, sniffImage, MAX_PROOF_BYTES } from './upi';
import { evaluatePromo, normalizePromoCode } from './promo-rules';
import { Line, discountFromPercent, rupees } from './pricing-math';

export const PRIVATE_PROOF_DIR = (): string => join(process.cwd(), 'private-uploads', 'payment-proofs');

/** Who is paying and how we found the invoice. */
export interface PayCtx { invoice: Invoice; vendor: Vendor; via: 'token' | 'vendor' }

export interface ProofInput {
  utr: string;
  claimedAmountRupees?: number;
  paidAt: string;
  payerNote?: string;
  file?: { buffer: Buffer; mimetype: string; size: number } | null;
  ip?: string;
}

/** Sliding-window attempt limiter (in memory, per API instance) — brute-force / probing guard for promo and token lookups. */
export class AttemptLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly max: number, private readonly windowMs: number) {}
  /** Returns false (blocked) when `key` already made `max` failed attempts inside the window. */
  allowed(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, recent);
    return recent.length < this.max;
  }
  fail(key: string, now = Date.now()): void {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    recent.push(now);
    this.hits.set(key, recent);
  }
}

@Injectable()
export class PayService {
  private readonly logger = new Logger(PayService.name);
  private readonly promoLimiter = new AttemptLimiter(6, 10 * 60_000);
  private readonly proofLimiter = new AttemptLimiter(8, 60 * 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly builder: InvoiceBuilderService,
    private readonly settlement: SettlementService,
    private readonly payee: PayeeService,
    private readonly audit: CommercialAuditService,
    private readonly messenger: CommercialMessenger,
  ) {}

  // ── Resolving the invoice ──────────────────────────────────────────────────────────────────────

  async loadByToken(token: string, now = new Date()): Promise<PayCtx> {
    if (!isPlausiblePayToken(token)) throw new NotFoundException('This payment link is not valid');
    const invoice = await this.prisma.invoice.findUnique({ where: { payTokenHash: hashPayToken(token) } });
    if (!invoice || invoice.kind == null) throw new NotFoundException('This payment link is not valid');
    if (invoice.status === 'DRAFT') throw new NotFoundException('This payment link is not valid');
    if (invoice.tokenExpiresAt && invoice.tokenExpiresAt.getTime() < now.getTime() && invoice.status !== 'PAID') {
      throw new GoneException('This payment link has expired. Please ask us for a new one.');
    }
    const vendor = await this.prisma.vendor.findUnique({ where: { id: invoice.vendorId } });
    if (!vendor) throw new NotFoundException('This payment link is not valid');
    return { invoice, vendor, via: 'token' };
  }

  async loadForVendor(invoiceId: string, vendorId: string): Promise<PayCtx> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.vendorId !== vendorId || invoice.status === 'DRAFT') throw new NotFoundException('Invoice not found');
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Invoice not found');
    return { invoice, vendor, via: 'vendor' };
  }

  private assertPayable(inv: Invoice): void {
    if (inv.status === 'PAID') throw new BadRequestException('This invoice is already paid');
    if (!isPayable(inv.status)) throw new BadRequestException('This invoice cannot be paid right now');
    if (balanceDue(inv) <= 0) throw new BadRequestException('Nothing is due on this invoice');
  }

  private assertChannel(inv: Invoice, ch: ChannelT): void {
    if (!(inv.allowedChannels as string[]).includes(ch)) throw new ForbiddenException('This payment method is not enabled for this invoice');
  }

  // ── The page / dashboard panel ─────────────────────────────────────────────────────────────────

  async view(ctx: PayCtx) {
    const { invoice: inv, vendor } = ctx;
    const channels = inv.allowedChannels as string[];
    const unpaid = isPayable(inv.status);
    const payee = unpaid && (channels.includes('UPI_QR') || channels.includes('OFFLINE')) ? await this.payee.publicView() : null;
    const razorpayReady = channels.includes('RAZORPAY') && Boolean(process.env.RAZORPAY_KEY_ID) && !String(process.env.RAZORPAY_KEY_ID).startsWith('placeholder');
    const promo = inv.promoCodeId ? await this.prisma.promoCode.findUnique({ where: { id: inv.promoCodeId } }) : null;
    const lastSub = await this.prisma.manualPaymentSubmission.findFirst({ where: { invoiceId: inv.id }, orderBy: { createdAt: 'desc' } });
    return {
      invoice: {
        id: ctx.via === 'vendor' ? inv.id : undefined,
        number: inv.invoiceNumber, kind: inv.kind, description: inv.description, status: inv.status,
        lines: ((inv.lineItems as unknown as Line[] | null) ?? []).map((l) => ({ kind: l.kind, label: l.label, amountPaise: l.amountPaise, qty: l.qty ?? 1 })),
        subtotalPaise: inv.listAmountPaise ?? inv.amount + inv.discountPaise, discountPaise: inv.discountPaise, discountReason: inv.discountReason,
        promoCode: promo?.code ?? null, gstMode: inv.gstMode, taxablePaise: inv.amount, gstPaise: inv.gstAmount, totalPaise: inv.totalAmount,
        paidPaise: inv.paidPaise, balanceDuePaise: balanceDue(inv), overpaymentPaise: inv.overpaymentPaise,
        planKey: inv.planKey, billingCycle: inv.billingCycle, periodStart: inv.periodStart, periodEnd: inv.periodEnd,
        dueDate: inv.dueDate, paidAt: inv.paidAt, expiresAt: inv.tokenExpiresAt,
      },
      business: { name: vendor.businessName },
      channels: { razorpay: razorpayReady, upiQr: unpaid && channels.includes('UPI_QR') && Boolean(payee?.upiId), offline: unpaid && channels.includes('OFFLINE') },
      razorpayKeyId: razorpayReady ? process.env.RAZORPAY_KEY_ID : undefined,
      allowPromoEntry: inv.allowPromoEntry && unpaid && inv.paidPaise === 0,
      payee,
      submission: lastSub ? { status: lastSub.status, submittedAt: lastSub.createdAt, reason: lastSub.status === 'REJECTED' ? lastSub.reason : undefined, utrTail: lastSub.utr.slice(-4) } : null,
    };
  }

  // ── Razorpay ───────────────────────────────────────────────────────────────────────────────────

  /** Amount is ALWAYS the invoice's server-side balance due — the request carries no amount at all. */
  async razorpayOrder(ctx: PayCtx) {
    this.assertChannel(ctx.invoice, 'RAZORPAY');
    this.assertPayable(ctx.invoice);
    const amount = balanceDue(ctx.invoice);
    try {
      const order = await this.payments.createOrder({
        amount, currency: 'INR', receipt: ctx.invoice.invoiceNumber,
        notes: { purpose: 'invoice', invoiceId: ctx.invoice.id, vendorId: ctx.invoice.vendorId, amountPaise: String(amount) },
      });
      return { orderId: order.id, amount: Number(order.amount), currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error(`Razorpay order failed: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
      throw new ServiceUnavailableException('The payment gateway is unavailable right now. Please try again, or use another method.');
    }
  }

  async razorpayVerify(ctx: PayCtx, dto: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    this.assertChannel(ctx.invoice, 'RAZORPAY');
    const inv = ctx.invoice;
    if (inv.status === 'PAID') {
      if (inv.razorpayPaymentId === dto.razorpayPaymentId) return { verified: true, status: 'PAID' as const };
      throw new BadRequestException('This invoice is already paid');
    }
    this.assertPayable(inv);
    const amount = balanceDue(inv);
    await this.payments.assertCaptured({
      orderId: dto.razorpayOrderId, paymentId: dto.razorpayPaymentId, signature: dto.razorpaySignature,
      expectedAmountPaise: amount,
      expectedNotes: { purpose: 'invoice', invoiceId: inv.id, vendorId: inv.vendorId },
    });
    const r = await this.settlement.applyPayment(inv.id, { amountPaise: amount, via: 'RAZORPAY', razorpay: { orderId: dto.razorpayOrderId, paymentId: dto.razorpayPaymentId }, actor: `payer:${ctx.via}` });
    return { verified: true, status: r.invoice.status };
  }

  // ── UPI QR ─────────────────────────────────────────────────────────────────────────────────────

  async upi(ctx: PayCtx) {
    this.assertChannel(ctx.invoice, 'UPI_QR');
    this.assertPayable(ctx.invoice);
    const payee = await this.payee.get();
    if (!payee?.upiId) throw new ServiceUnavailableException('UPI payment is not set up yet. Please use another method or contact us.');
    const amountPaise = balanceDue(ctx.invoice);
    const link = buildUpiLink({ vpa: payee.upiId, payeeName: payee.payeeName ?? 'Get4Domain', amountPaise, note: ctx.invoice.invoiceNumber });
    return { upiLink: link, qrDataUrl: await upiQrDataUrl(link), upiId: payee.upiId, payeeName: payee.payeeName, amountPaise, note: ctx.invoice.invoiceNumber, staticQrUrl: payee.qrImageUrl };
  }

  // ── "I have paid" proof ────────────────────────────────────────────────────────────────────────

  async submitProof(ctx: PayCtx, input: ProofInput, now = new Date()) {
    const inv = ctx.invoice;
    if (!(inv.allowedChannels as string[]).some((c) => c === 'UPI_QR' || c === 'OFFLINE')) throw new ForbiddenException('Manual payment is not enabled for this invoice');
    this.assertPayable(inv);
    const ipKey = `proof:${hashIp(input.ip) ?? 'x'}:${inv.id}`;
    if (!this.proofLimiter.allowed(ipKey)) throw new HttpException('Too many submissions. Please wait a while and try again.', 429);

    const utr = normalizeUtr(input.utr);
    if (!utr) { this.proofLimiter.fail(ipKey); throw new BadRequestException('Enter the UTR / transaction reference exactly as shown in your payment app (12–22 letters or digits)'); }
    const paidAt = new Date(input.paidAt);
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Enter the date you paid');
    if (paidAt.getTime() > now.getTime() + 36 * 3600_000) throw new BadRequestException('The payment date cannot be in the future');
    if (paidAt.getTime() < now.getTime() - 90 * 86_400_000) throw new BadRequestException('That payment date is too old for this invoice');
    const claimedRupees = input.claimedAmountRupees;
    if (claimedRupees === undefined || !Number.isFinite(claimedRupees) || claimedRupees <= 0 || claimedRupees > 1_00_00_000) throw new BadRequestException('Enter the amount you paid');
    const claimedPaise = Math.round(claimedRupees * 100);

    const pending = await this.prisma.manualPaymentSubmission.count({ where: { invoiceId: inv.id, status: 'SUBMITTED' } });
    if (pending >= 3) throw new BadRequestException('You already have payments waiting for confirmation on this invoice. We will confirm them shortly.');

    const dup = await this.prisma.manualPaymentSubmission.findUnique({ where: { utr } });
    if (dup) {
      this.proofLimiter.fail(ipKey);
      // Flag it for the admin: someone tried to reuse a UTR that is already on file.
      await this.audit.log(`payer:${ctx.via}`, 'payment.duplicate_utr', 'ManualPaymentSubmission', dup.id, { attemptedInvoiceId: inv.id, sameInvoice: dup.invoiceId === inv.id });
      await this.messenger.admin('Duplicate UTR flagged', `UTR …${utr.slice(-4)} was submitted again for ${inv.invoiceNumber}`, { invoiceId: inv.id });
      throw new ConflictException('This UTR has already been submitted. If you made a second payment, enter its own UTR.');
    }

    let screenshotUrl: string | undefined;
    let screenshotMime: string | undefined;
    if (input.file) {
      if (input.file.size > MAX_PROOF_BYTES || input.file.buffer.length > MAX_PROOF_BYTES) throw new BadRequestException('Screenshot is too large (max 3 MB)');
      const sniffed = sniffImage(input.file.buffer);
      if (!sniffed) throw new BadRequestException('Screenshot must be a JPG, PNG or WebP image');
      try {
        const dir = join(PRIVATE_PROOF_DIR(), inv.id);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const name = `${Date.now()}_${randomBytes(8).toString('hex')}${sniffed.ext}`;
        writeFileSync(join(dir, name), input.file.buffer, { mode: 0o600 });
        screenshotUrl = `private:${inv.id}/${name}`;
        screenshotMime = sniffed.mime;
      } catch (e) {
        // A storage problem must never stop a customer from telling us they paid — keep the UTR, drop the picture.
        this.logger.error(`Could not store payment proof for ${inv.invoiceNumber}: ${e instanceof Error ? e.message : 'error'}`);
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.manualPaymentSubmission.create({
          data: { invoiceId: inv.id, utr, claimedAmountPaise: claimedPaise, paidAt, screenshotUrl, screenshotMime, payerNote: input.payerNote?.trim().slice(0, 300) || undefined, submittedByIpHash: hashIp(input.ip) },
        });
        if (inv.status !== 'PARTIALLY_PAID') await tx.invoice.update({ where: { id: inv.id }, data: { status: 'PAYMENT_SUBMITTED' } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        await this.audit.log(`payer:${ctx.via}`, 'payment.duplicate_utr', 'Invoice', inv.id, { race: true });
        throw new ConflictException('This UTR has already been submitted.');
      }
      throw e;
    }
    await this.messenger.admin('Payment to confirm', `${ctx.vendor.businessName} submitted UTR …${utr.slice(-4)} for ${inv.invoiceNumber} (claims ${rupees(claimedPaise)})`, { invoiceId: inv.id });
    return { submitted: true, status: 'SUBMITTED' as const };
  }

  // ── Promo codes (server-side recompute) ────────────────────────────────────────────────────────

  async applyPromo(ctx: PayCtx, rawCode: string, ip?: string, now = new Date()) {
    const inv = ctx.invoice;
    if (!inv.allowPromoEntry) throw new ForbiddenException('Promo codes are not accepted on this invoice');
    if (!isPayable(inv.status) || inv.paidPaise > 0 || inv.status === 'PAYMENT_SUBMITTED') throw new BadRequestException('A promo code can only be added to an unpaid invoice');
    const limiterKey = `promo:${inv.id}`;
    const ipKey = `promo-ip:${hashIp(ip) ?? 'x'}`;
    if (!this.promoLimiter.allowed(limiterKey) || !this.promoLimiter.allowed(ipKey)) throw new HttpException('Too many attempts. Please wait a few minutes and try again.', 429);
    const code = normalizePromoCode(rawCode);
    const fail = (msg: string): never => { this.promoLimiter.fail(limiterKey); this.promoLimiter.fail(ipKey); throw new BadRequestException(msg); };
    if (!code) return fail('That promo code is not valid');
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo) return fail('That promo code is not valid');

    const [total, byVendor] = await Promise.all([
      this.prisma.promoRedemption.count({ where: { promoCodeId: promo.id } }),
      this.prisma.promoRedemption.count({ where: { promoCodeId: promo.id, vendorId: inv.vendorId } }),
    ]);
    const subtotal = inv.listAmountPaise ?? inv.amount + inv.discountPaise;
    const res = evaluatePromo(promo, {
      now, planKey: inv.planKey, billingCycle: inv.billingCycle, cycleMonths: inv.cycleMonths, kind: inv.kind,
      subtotalPaise: subtotal, adminDiscountPresent: inv.adminDiscount, allowStacking: inv.allowPromoStacking,
      redemptionsTotal: total, redemptionsByVendor: byVendor, invoiceHasPromo: Boolean(inv.promoCodeId),
    });
    if (!res.ok) return fail(res.reason);
    const existingAdmin = inv.adminDiscount ? inv.discountPaise : 0;
    const updated = await this.builder.reprice(inv.id, Math.min(subtotal, existingAdmin + res.discountPaise), { promoCodeId: promo.id, discountReason: inv.adminDiscount ? undefined : `Promo ${promo.code}` });
    await this.audit.log(`payer:${ctx.via}`, 'promo.apply', 'Invoice', inv.id, { code: promo.code, discountPaise: res.discountPaise });
    return { applied: true, code: promo.code, discountPaise: res.discountPaise, totalPaise: updated.totalAmount };
  }

  async removePromo(ctx: PayCtx) {
    const inv = ctx.invoice;
    if (!inv.promoCodeId || inv.paidPaise > 0 || !isPayable(inv.status)) throw new BadRequestException('No promo code to remove');
    const promo = await this.prisma.promoCode.findUnique({ where: { id: inv.promoCodeId } });
    const subtotal = inv.listAmountPaise ?? inv.amount + inv.discountPaise;
    const promoPart = promo ? (promo.type === 'PERCENT' ? discountFromPercent(subtotal, promo.value) : Math.min(promo.value, subtotal)) : 0;
    const remaining = inv.adminDiscount ? Math.max(0, inv.discountPaise - promoPart) : 0;
    const updated = await this.builder.reprice(inv.id, remaining, { promoCodeId: null, discountReason: inv.adminDiscount ? undefined : null });
    await this.audit.log(`payer:${ctx.via}`, 'promo.remove', 'Invoice', inv.id, {});
    return { removed: true, totalPaise: updated.totalAmount };
  }
}
