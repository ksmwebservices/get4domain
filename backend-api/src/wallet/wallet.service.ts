import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { Wallet, WalletTransaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../platform-settings/crypto.util';
import { TopupDto } from './dto/topup.dto';
import { VerifyTopupDto } from './dto/verify-topup.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { grantWalletCredit, NINETY_DAYS_MS } from './wallet-credit.util';

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

  async verifyTopup(vendorId: string, dto: VerifyTopupDto): Promise<Wallet> {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== dto.razorpaySignature) {
      throw new BadRequestException('Payment signature verification failed');
    }

    const order = await this.razorpay.orders.fetch(dto.razorpayOrderId);
    const paidAmount = Number(order.amount);
    const bonusPercent = bonusPercentFor(paidAmount);
    const credits = Math.round(paidAmount + (paidAmount * bonusPercent) / 100);
    const expiresAt = new Date(Date.now() + NINETY_DAYS_MS);

    const wallet = await this.prisma.$transaction(async (tx) => {
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

      return w;
    });

    // Auto-generate a GST invoice for the top-up and email it. Best-effort —
    // never blocks/undoes the credit (the method itself swallows failures).
    await this.invoices.createPaidTopupInvoice(vendorId, paidAmount, credits, dto.razorpayPaymentId);

    return wallet;
  }

  /**
   * Grant free wallet credit (plan/trial welcome credit — not a paid top-up).
   * 90-day validity, logged as a credit transaction. Idempotency is the caller's
   * concern. No-op for amount <= 0.
   */
  async grantCredit(vendorId: string, amount: number, description: string, service = 'plan_credit'): Promise<void> {
    return grantWalletCredit(this.prisma, vendorId, amount, description, service);
  }

  async deduct(vendorId: string, amount: number, description: string, service: string): Promise<Wallet> {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet || wallet.balance < amount) {
        throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
      }

      const updated = await tx.wallet.update({
        where: { vendorId },
        data: { balance: { decrement: amount }, totalDebited: { increment: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          vendorId,
          walletId: wallet.id,
          type: 'debit',
          amount,
          description,
          service,
          balanceAfter: updated.balance,
        },
      });

      return updated;
    });
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
