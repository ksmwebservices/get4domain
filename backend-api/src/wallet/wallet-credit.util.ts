import { PrismaService } from '../prisma/prisma.service';

export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * The single source of truth for granting free (non-paid) wallet credit —
 * plan/welcome bonuses, trial credit, etc. 90-day validity, logged as a credit
 * transaction with the running balance. No-op for amount <= 0.
 *
 * Extracted from WalletService.grantCredit so flows that cannot import
 * WalletModule without a circular dependency (e.g. PaymentsService, which sits
 * upstream of Wallet → Invoices → Payments) reuse the exact same code path
 * instead of a parallel implementation.
 */
export async function grantWalletCredit(
  prisma: PrismaService,
  vendorId: string,
  amount: number,
  description: string,
  service = 'plan_credit',
): Promise<void> {
  if (amount <= 0) return;
  const expiresAt = new Date(Date.now() + NINETY_DAYS_MS);
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { vendorId },
      create: { vendorId, balance: amount, totalCredited: amount },
      update: { balance: { increment: amount }, totalCredited: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        vendorId,
        walletId: wallet.id,
        type: 'credit',
        amount,
        description,
        service,
        balanceAfter: wallet.balance,
        expiresAt,
      },
    });
  });
}
