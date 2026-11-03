import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvoicesService } from '../src/invoices/invoices.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { WalletService } from '../src/wallet/wallet.service';

/**
 * CI-FIX-1. Under load (many debits queued on one wallet row, a slow link to the database) Prisma can fail a transaction with P2028 ("Unable to start a
 * transaction in the given time", "Transaction already closed") or P2034 (write conflict / deadlock). That used to escape the wallet as a raw
 * PrismaClientKnownRequestError (CI run 41563276200). Now: bounded retries; then a domain outcome, never a Prisma error.
 * No database: the Prisma client is a stub that fails on cue.
 */
const prismaError = (code: string, message: string) => new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: 'test' });
const P2034 = () => prismaError('P2034', 'Transaction failed due to a write conflict or a deadlock. Please retry your transaction');
const P2028_START = () => prismaError('P2028', 'Transaction API error: Unable to start a transaction in the given time.');
const P2028_CLOSED = () => prismaError('P2028', 'Transaction API error: Transaction already closed: A commit cannot be executed on an expired transaction.');

interface Stub { tx: jest.Mock; walletFind: jest.Mock; txnFind: jest.Mock; walletFindOrThrow: jest.Mock }
function build(): { wallet: WalletService; stub: Stub } {
  process.env.RAZORPAY_KEY_ID = ['rzp', 'test', 'notarealkey0001'].join('_');
  process.env.RAZORPAY_KEY_SECRET = 'not-a-real-secret-never-used';
  const stub: Stub = { tx: jest.fn(), walletFind: jest.fn(), txnFind: jest.fn().mockResolvedValue(null), walletFindOrThrow: jest.fn() };
  const prisma = { $transaction: stub.tx, wallet: { findUnique: stub.walletFind, findUniqueOrThrow: stub.walletFindOrThrow }, walletTransaction: { findUnique: stub.txnFind } };
  WalletService.RETRY_BASE_MS = 1;                                          // keep the test fast
  return { wallet: new WalletService(prisma as unknown as PrismaService, {} as InvoicesService), stub };
}
const walletRow = { id: 'w1', vendorId: 'v1', balance: 70, totalCredited: 100, totalDebited: 30 };

describe('wallet debit: concurrency errors never reach the caller as Prisma errors', () => {
  it('a write conflict (P2034) is retried and then succeeds', async () => {
    const { wallet, stub } = build();
    stub.tx.mockRejectedValueOnce(P2034()).mockRejectedValueOnce(P2034()).mockResolvedValueOnce(walletRow);
    await expect(wallet.deduct('v1', 10, 'x', 'test_svc')).resolves.toEqual(walletRow);
    expect(stub.tx).toHaveBeenCalledTimes(3);
  });

  it('"unable to start a transaction" (P2028) is retried: nothing had been written, so a retry is safe', async () => {
    const { wallet, stub } = build();
    stub.tx.mockRejectedValueOnce(P2028_START()).mockResolvedValueOnce(walletRow);
    await expect(wallet.deduct('v1', 10, 'x', 'test_svc')).resolves.toEqual(walletRow);
    expect(stub.tx).toHaveBeenCalledTimes(2);
  });

  it('retries are bounded, and when they run out with a short balance the answer is INSUFFICIENT_WALLET_BALANCE', async () => {
    const { wallet, stub } = build();
    stub.tx.mockRejectedValue(P2028_START());
    stub.walletFind.mockResolvedValue({ ...walletRow, balance: 5 });
    const err = await wallet.deduct('v1', 10, 'x', 'test_svc').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).message).toBe('INSUFFICIENT_WALLET_BALANCE');
    expect(stub.tx.mock.calls.length).toBeGreaterThan(1);
    expect(stub.tx.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('when retries run out and the balance is enough, the answer is a clean 503 WALLET_BUSY, not a Prisma error', async () => {
    const { wallet, stub } = build();
    stub.tx.mockRejectedValue(P2034());
    stub.walletFind.mockResolvedValue(walletRow);
    const err = await wallet.deduct('v1', 10, 'x', 'test_svc').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as Error).message).toBe('WALLET_BUSY');
    expect(err).not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it('a transaction that died mid-flight without an idempotency key is NOT retried blindly (it could have committed): clean outcome instead', async () => {
    const { wallet, stub } = build();
    stub.tx.mockRejectedValue(P2028_CLOSED());
    stub.walletFind.mockResolvedValue(walletRow);
    const err = await wallet.deduct('v1', 10, 'x', 'test_svc').catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(stub.tx).toHaveBeenCalledTimes(1);
  });

  it('with an idempotency key, a failure after the debit committed returns the existing result instead of an error', async () => {
    const { wallet, stub } = build();
    const prior = { id: 't1', walletId: 'w1', vendorId: 'v1', amount: 10, service: 'test_svc', type: 'debit', balanceAfter: 70 };
    stub.txnFind.mockResolvedValueOnce(null).mockResolvedValue(prior);          // first look: nothing yet; after the failure: the winner is there
    stub.tx.mockRejectedValue(P2028_CLOSED());
    stub.walletFindOrThrow.mockResolvedValue(walletRow);
    await expect(wallet.deduct('v1', 10, 'x', 'test_svc', { idempotencyKey: 'k1' })).resolves.toMatchObject({ balance: 70 });
  });

  it('a clean domain error from inside the transaction (balance too low) is passed through untouched and not retried', async () => {
    const { wallet, stub } = build();
    stub.tx.mockRejectedValue(new BadRequestException('INSUFFICIENT_WALLET_BALANCE'));
    await expect(wallet.deduct('v1', 10, 'x', 'test_svc')).rejects.toThrow('INSUFFICIENT_WALLET_BALANCE');
    expect(stub.tx).toHaveBeenCalledTimes(1);
  });

  it('refund is retried the same way (it is idempotent by key)', async () => {
    const { wallet, stub } = build();
    stub.tx.mockRejectedValueOnce(P2034()).mockResolvedValueOnce(walletRow);
    await expect(wallet.refund('v1', 10, 'x', 'test_svc', 'rk1')).resolves.toEqual(walletRow);
    expect(stub.tx).toHaveBeenCalledTimes(2);
  });
});
