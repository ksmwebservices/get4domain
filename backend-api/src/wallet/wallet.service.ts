import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { BillingGateService, GatedAction } from '../commercial/billing-gate.service';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { Prisma, Wallet, WalletTransaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../platform-settings/crypto.util';
import { TopupDto } from './dto/topup.dto';
import { VerifyTopupDto } from './dto/verify-topup.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { grantWalletCredit, NINETY_DAYS_MS } from './wallet-credit.util';
import { assertCapturedPayment, lockPayment } from '../payments/payment-verification';

/** Options for deduct() and refund(). */
export interface WalletWriteOptions {
  /**
   * Same key + same vendor, amount and service = the same operation: a repeat returns the original result and moves no money.
   * The same key with a different vendor, amount or service is refused with 409 IDEMPOTENCY_KEY_REUSED.
   */
  idempotencyKey?: string;
  /**
   * Run inside the caller's interactive transaction, so a status change and the debit commit or roll back together.
   * With this option a concurrent duplicate of the same key surfaces as an error and a rollback of the caller's transaction
   * (retry it: the retry returns the original result).
   */
  tx?: Prisma.TransactionClient;
}

type Db = PrismaService | Prisma.TransactionClient;

function bonusPercentFor(amountPaise: number): number {
  if (amountPaise >= 499900) return 30;
  if (amountPaise >= 249900) return 20;
  if (amountPaise >= 99900) return 10;
  return 0;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly razorpay: Razorpay;

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    // Commercial Engine v1: a LAPSED vendor cannot spend wallet credit (AI Studio, messaging, campaigns).
    @Optional() private readonly gate?: BillingGateService,
  ) {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    });
  }

  async getOrCreateWallet(vendorId: string): Promise<Wallet> {
    const existing = await this.prisma.wallet.findUnique({ where: { vendorId } });
    if (existing) return existing;
    return this.prisma.wallet.create({ data: { vendorId } });
  }

  async getBalance(vendorId: string): Promise<{ balance: number; nextExpiry: { amount: number; date: Date } | null }> {
    const wallet = await this.getOrCreateWallet(vendorId);

    const nextExpiring = await this.prisma.walletTransaction.findFirst({
      where: { vendorId, type: 'credit', expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });

    return {
      balance: wallet.balance,
      nextExpiry: nextExpiring?.expiresAt ? { amount: nextExpiring.amount, date: nextExpiring.expiresAt } : null,
    };
  }

  async getTransactions(
    vendorId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: WalletTransaction[]; total: number; page: number; limit: number }> {
    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where: { vendorId } }),
    ]);
    return { items, total, page, limit };
  }

  async topup(vendorId: string, dto: TopupDto): Promise<{ orderId: string; amount: number; currency: string; credits: number }> {
    const order = await this.razorpay.orders.create({
      amount: dto.amount,
      currency: 'INR',
      receipt: `wallet_${vendorId}_${Date.now()}`,
      notes: { vendorId, purpose: 'wallet_topup' },
    });

    const bonusPercent = bonusPercentFor(dto.amount);
    const credits = Math.round(dto.amount + (dto.amount * bonusPercent) / 100);

    return { orderId: order.id, amount: dto.amount, currency: 'INR', credits };
  }

  /**
   * Credit a top-up ONLY when Razorpay confirms a captured payment on an order our server created
   * for THIS vendor (notes.purpose/vendorId). The credited amount comes from the order itself, never
   * the client. Idempotent: the same payment id can credit once — a replayed {order,payment,signature}
   * returns the wallet unchanged (serialised by a per-payment advisory lock; the unique index on
   * razorpayId is the final backstop once its migration is applied).
   */
  async verifyTopup(vendorId: string, dto: VerifyTopupDto): Promise<Wallet> {
    const confirmed = await assertCapturedPayment(this.razorpay, {
      secret: process.env.RAZORPAY_KEY_SECRET,
      orderId: dto.razorpayOrderId,
      paymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature,
      expectedNotes: { purpose: 'wallet_topup', vendorId },
    });
    const paidAmount = confirmed.amountPaise;
    const bonusPercent = bonusPercentFor(paidAmount);
    const credits = Math.round(paidAmount + (paidAmount * bonusPercent) / 100);
    const expiresAt = new Date(Date.now() + NINETY_DAYS_MS);

    const outcome = await this.prisma.$transaction(async (tx) => {
      await lockPayment(tx, dto.razorpayPaymentId);
      const already = await tx.walletTransaction.findFirst({ where: { razorpayId: dto.razorpayPaymentId }, select: { id: true } });
      if (already) {
        const current = await tx.wallet.findUnique({ where: { vendorId } });
        return { wallet: current, credited: false };
      }

      const w = await tx.wallet.upsert({
        where: { vendorId },
        create: { vendorId, balance: credits, totalCredited: credits },
        update: { balance: { increment: credits }, totalCredited: { increment: credits } },
      });

      await tx.walletTransaction.create({
        data: {
          vendorId,
          walletId: w.id,
          type: 'credit',
          amount: credits,
          description: `Wallet top-up (₹${(paidAmount / 100).toFixed(2)} paid, ${bonusPercent}% bonus)`,
          service: 'topup',
          balanceAfter: w.balance,
          expiresAt,
          razorpayId: dto.razorpayPaymentId,
        },
      });

      return { wallet: w, credited: true };
    });

    if (!outcome.wallet) throw new BadRequestException('Wallet not found');
    if (!outcome.credited) return outcome.wallet; // replay — no second credit, no second invoice

    // Auto-generate a GST invoice for the top-up and email it. Best-effort —
    // never blocks/undoes the credit (the method itself swallows failures).
    await this.invoices.createPaidTopupInvoice(vendorId, paidAmount, credits, dto.razorpayPaymentId);

    return outcome.wallet;
  }

  /**
   * Grant free wallet credit (plan/trial welcome credit — not a paid top-up).
   * 90-day validity, logged as a credit transaction. Idempotency is the caller's
   * concern. No-op for amount <= 0.
   */
  async grantCredit(vendorId: string, amount: number, description: string, service = 'plan_credit'): Promise<void> {
    return grantWalletCredit(this.prisma, vendorId, amount, description, service);
  }

  /**
   * Debit the wallet by `amount` paise. ATOMIC: one conditional UPDATE (`balance >= amount`) takes the money, so parallel
   * debits can never overdraw (the row lock makes later ones re-check the balance after earlier ones commit).
   *  - amount 0 is a successful no-op (a free rate): no row, no change.
   *  - a negative, fractional or non-finite amount is 400 INVALID_AMOUNT.
   *  - not enough balance (or no wallet) is 400 INSUFFICIENT_WALLET_BALANCE, unchanged.
   *  - with `idempotencyKey`, a repeat returns the original result (balance as it was after the first debit) and moves no money.
   */
  async deduct(vendorId: string, amount: number, description: string, service: string, opts: WalletWriteOptions = {}): Promise<Wallet> {
    if (opts.tx) return this.deductCore(vendorId, amount, description, service, opts);          // the caller owns that transaction and its error handling
    try {
      return await this.deductCore(vendorId, amount, description, service, opts);
    } catch (e) {
      throw this.asDomainError(e, 'debit');
    }
  }

  private async deductCore(vendorId: string, amount: number, description: string, service: string, opts: WalletWriteOptions): Promise<Wallet> {
    WalletService.assertWholePaise(amount, true);
    const key = opts.idempotencyKey;
    const expected = { vendorId, amount, service, type: 'debit' } as const;

    // A repeat of a debit that already happened answers with the original result, even if the vendor has lapsed since.
    if (key) {
      const db: Db = opts.tx ?? this.prisma;
      const prior = await db.walletTransaction.findUnique({ where: { idempotencyKey: key } });
      if (prior) return this.replayOf(db, prior, expected);
    }

    const action = WalletService.gatedActionFor(service);
    if (action) await this.gate?.assertNotLapsed(vendorId, action);
    if (amount === 0) return this.getOrCreateWallet(vendorId);

    if (opts.tx) return this.debitIn(opts.tx, vendorId, amount, description, service, key);
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction((tx) => this.debitIn(tx, vendorId, amount, description, service, key), WalletService.TX_OPTIONS);
      } catch (e) {
        // Two requests with the same key raced: the loser rolled back (unique violation) or found the money already spent.
        // If the winner committed, this is a replay, not a failure.
        if (key) {
          const prior = await this.prisma.walletTransaction.findUnique({ where: { idempotencyKey: key } });
          if (prior) return this.replayOf(this.prisma, prior, expected);
        }
        if (!WalletService.isConcurrencyError(e)) throw e;          // includes the clean INSUFFICIENT_WALLET_BALANCE from inside the transaction
        // Safe to run again when nothing can have been written (it never started, or the database rolled it back), or when the key makes a repeat harmless.
        if ((key || WalletService.nothingCommitted(e)) && attempt < WalletService.MAX_ATTEMPTS) { await this.backoff(attempt); continue; }
        throw await this.cleanDebitFailure(vendorId, amount);
      }
    }
  }

  /** Attempts for a transaction that fails because of contention (many requests queued on one wallet row, or a slow link to the database). */
  static MAX_ATTEMPTS = 4;
  static RETRY_BASE_MS = 40;
  /** Debits on one wallet queue behind its row lock, so a transaction may legitimately wait: more room than Prisma's 2 s / 5 s defaults. */
  private static readonly TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 };

  /**
   * Prisma failures that say "the database was busy or unreachable", not "the balance is wrong": P2034 write conflict / deadlock, P2028 transaction could not
   * start in time or was closed, P2024 timed out waiting for a pooled connection, P1001 cannot reach the server, P1002 the server timed out, P1017 the server
   * closed the connection. Everything else from Prisma is unexpected.
   */
  private static readonly RETRYABLE_CODES: ReadonlySet<string> = new Set(['P2034', 'P2028', 'P2024', 'P1001', 'P1002', 'P1017']);

  private static prismaCode(e: unknown): string | undefined {
    if (e instanceof Prisma.PrismaClientKnownRequestError) return e.code;
    if (e instanceof Prisma.PrismaClientInitializationError) return e.errorCode;
    return undefined;
  }

  private static isPrismaError(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError || e instanceof Prisma.PrismaClientInitializationError
      || e instanceof Prisma.PrismaClientUnknownRequestError || e instanceof Prisma.PrismaClientValidationError || e instanceof Prisma.PrismaClientRustPanicError;
  }

  private static isConcurrencyError(e: unknown): boolean {
    const code = WalletService.prismaCode(e);
    return code !== undefined && WalletService.RETRYABLE_CODES.has(code);
  }

  /** True when this failure proves no write was committed: a conflict is rolled back by the database, and with P2024 / P1001 / "unable to start" no transaction began. */
  private static nothingCommitted(e: unknown): boolean {
    const code = WalletService.prismaCode(e);
    return code === 'P2034' || code === 'P2024' || code === 'P1001' || (code === 'P2028' && /unable to start a transaction/i.test((e as Error).message));
  }

  /**
   * The boundary: no Prisma error leaves deduct() / refund() on their own transaction. Busy or unreachable database = 503 WALLET_BUSY; any other Prisma error =
   * a generic 500 WALLET_ERROR. The details (code, first line of the message) go to the server log, never to the caller. Other errors are not disguised.
   */
  private asDomainError(e: unknown, op: string): unknown {
    if (e instanceof HttpException || !WalletService.isPrismaError(e)) return e;
    const code = WalletService.prismaCode(e);
    this.logger.error(`Wallet ${op} failed with a database error: ${(e as Error).name} ${code ?? ''} ${String((e as Error).message).split('\n').pop()?.slice(0, 300) ?? ''}`.trim());
    return WalletService.isConcurrencyError(e) ? new ServiceUnavailableException('WALLET_BUSY') : new InternalServerErrorException('WALLET_ERROR');
  }

  private backoff(attempt: number): Promise<void> {
    const ms = WalletService.RETRY_BASE_MS * attempt + Math.floor(Math.random() * WalletService.RETRY_BASE_MS);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** The caller never sees a Prisma error: a short balance is INSUFFICIENT_WALLET_BALANCE, anything else is a plain "busy, try again". */
  private async cleanDebitFailure(vendorId: string, amount: number): Promise<Error> {
    const wallet = await this.prisma.wallet.findUnique({ where: { vendorId } }).catch(() => null);
    return wallet && wallet.balance < amount ? new BadRequestException('INSUFFICIENT_WALLET_BALANCE') : new ServiceUnavailableException('WALLET_BUSY');
  }

  /**
   * Put money back as a CREDIT ROW ONLY: balance and totalCredited go up, totalDebited is NOT restored, and the credit
   * does not expire (it returns what was taken). `idempotencyKey` is required: a repeat returns the first result.
   */
  async refund(vendorId: string, amount: number, description: string, service: string, idempotencyKey: string, opts: { tx?: Prisma.TransactionClient } = {}): Promise<Wallet> {
    if (opts.tx) return this.refundCore(vendorId, amount, description, service, idempotencyKey, opts);
    try {
      return await this.refundCore(vendorId, amount, description, service, idempotencyKey, opts);
    } catch (e) {
      throw this.asDomainError(e, 'refund');
    }
  }

  private async refundCore(vendorId: string, amount: number, description: string, service: string, idempotencyKey: string, opts: { tx?: Prisma.TransactionClient }): Promise<Wallet> {
    WalletService.assertWholePaise(amount, false);
    if (!idempotencyKey) throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    const expected = { vendorId, amount, service, type: 'credit' } as const;
    const db: Db = opts.tx ?? this.prisma;
    const prior = await db.walletTransaction.findUnique({ where: { idempotencyKey } });
    if (prior) return this.replayOf(db, prior, expected);

    const credit = async (tx: Prisma.TransactionClient): Promise<Wallet> => {
      const wallet = await tx.wallet.upsert({
        where: { vendorId },
        create: { vendorId, balance: amount, totalCredited: amount },
        update: { balance: { increment: amount }, totalCredited: { increment: amount } },
      });
      await tx.walletTransaction.create({
        data: { vendorId, walletId: wallet.id, type: 'credit', amount, description, service, balanceAfter: wallet.balance, expiresAt: null, idempotencyKey },
      });
      return wallet;
    };
    if (opts.tx) return credit(opts.tx);
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(credit, WalletService.TX_OPTIONS);
      } catch (e) {
        const raced = await this.prisma.walletTransaction.findUnique({ where: { idempotencyKey } });
        if (raced) return this.replayOf(this.prisma, raced, expected);
        if (!WalletService.isConcurrencyError(e)) throw e;
        if (attempt < WalletService.MAX_ATTEMPTS) { await this.backoff(attempt); continue; }      // the key makes a repeat harmless
        throw new ServiceUnavailableException('WALLET_BUSY');
      }
    }
  }

  /** The conditional UPDATE that takes the money. Count 0 means the balance was too low (or there is no wallet): nothing was changed. */
  private async debitIn(tx: Prisma.TransactionClient, vendorId: string, amount: number, description: string, service: string, key: string | undefined): Promise<Wallet> {
    const claimed = await tx.wallet.updateMany({
      where: { vendorId, balance: { gte: amount } },
      data: { balance: { decrement: amount }, totalDebited: { increment: amount } },
    });
    if (claimed.count === 0) throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
    // We hold the row lock until commit, so this reads our own write and nobody else's.
    const updated = await tx.wallet.findUniqueOrThrow({ where: { vendorId } });
    await tx.walletTransaction.create({
      data: { vendorId, walletId: updated.id, type: 'debit', amount, description, service, balanceAfter: updated.balance, idempotencyKey: key ?? null },
    });
    return updated;
  }

  /** The result a repeated call gets: the wallet, showing the balance as it was right after the original operation. */
  private async replayOf(db: Db, prior: WalletTransaction, expected: { vendorId: string; amount: number; service: string; type: 'debit' | 'credit' }): Promise<Wallet> {
    if (prior.vendorId !== expected.vendorId || prior.amount !== expected.amount || prior.service !== expected.service || prior.type !== expected.type) {
      throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
    }
    const current = await db.wallet.findUniqueOrThrow({ where: { id: prior.walletId } });
    return { ...current, balance: prior.balanceAfter };
  }

  /** Whole paise only. `allowZero`: a debit of 0 is a valid free action; a refund of 0 is not. */
  private static assertWholePaise(amount: number, allowZero: boolean): void {
    if (!Number.isInteger(amount) || amount < 0 || (!allowZero && amount === 0)) throw new BadRequestException('INVALID_AMOUNT');
  }

  /** Which lapse-gate action a wallet debit belongs to (domain purchases are not gated). */
  static gatedActionFor(service: string): GatedAction | null {
    if (service.startsWith('domain')) return null;
    if (service.startsWith('comm_') || service.startsWith('whatsapp') || service.startsWith('lead_wa')) return 'message';
    if (service.startsWith('campaign')) return 'publish';
    return 'ai_spend';
  }

  async hasSufficientBalance(vendorId: string, amount: number): Promise<boolean> {
    const wallet = await this.getOrCreateWallet(vendorId);
    return wallet.balance >= amount;
  }

  /**
   * Resolve a wallet rate (in paise) from the admin-managed pricing settings
   * (g4d_platform_settings, category "pricing"), falling back to a hardcoded
   * default when the key is not configured. Stored values are rupees.
   */
  async getRate(key: string, fallbackPaise: number): Promise<number> {
    if (!key) return fallbackPaise;
    try {
      const row = await this.prisma.platformSetting.findUnique({
        where: { category_key: { category: 'pricing', key } },
      });
      if (row?.value) {
        const rupees = parseFloat(decryptSecret(row.value));
        if (!Number.isNaN(rupees) && rupees >= 0) return Math.round(rupees * 100);
      }
    } catch (err) {
      this.logger.warn(`getRate(${key}) fell back to default: ${err instanceof Error ? err.message : 'error'}`);
    }
    return fallbackPaise;
  }
}
