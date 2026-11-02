// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient, Wallet } from '@prisma/client';
import { InvoicesService } from '../src/invoices/invoices.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { WalletService } from '../src/wallet/wallet.service';
import { cleanupTenants, newPrisma, seedBareVendor, seedWallet } from './support/fixtures';

/**
 * The wallet debit must be one atomic conditional update, safe under parallel requests, and idempotent per key.
 * Runs against the STAGING database with synthetic vendors; WalletService is the real class (no mocks of the money path).
 * Written to compile against the OLD signature too, so it fails on today's code by assertion, not by a compile error.
 */
type Opts = { idempotencyKey?: string };
describe('wallet debit and refund (staging database)', () => {
  let prisma: PrismaClient;
  let wallet: WalletService;
  let seq = 0;

  const deduct = (vendorId: string, amount: number, description: string, service: string, opts?: Opts): Promise<Wallet> =>
    (wallet.deduct as unknown as (...a: unknown[]) => Promise<Wallet>).apply(wallet, [vendorId, amount, description, service, opts]);
  const refund = (vendorId: string, amount: number, description: string, service: string, key: string): Promise<Wallet> =>
    (wallet as unknown as { refund: (...a: unknown[]) => Promise<Wallet> }).refund(vendorId, amount, description, service, key);

  const freshWallet = async (balance: number) => {
    seq += 1;
    const v = await seedBareVendor(prisma, `w${seq}`, RUN_ID);
    await seedWallet(prisma, v.vendorId, balance);
    return v.vendorId;
  };
  const read = (vendorId: string) => prisma.wallet.findUniqueOrThrow({ where: { vendorId } });
  const rows = (vendorId: string, service: string) => prisma.walletTransaction.findMany({ where: { vendorId, service }, orderBy: { createdAt: 'asc' } });
  const key = (name: string) => `${RUN_ID}:${name}`;

  beforeAll(async () => {
    prisma = newPrisma();
    // WalletService builds a Razorpay client in its constructor. Dummy values, assembled at run time, never used to call anything.
    process.env.RAZORPAY_KEY_ID = ['rzp', 'test', 'notarealkey0001'].join('_');
    process.env.RAZORPAY_KEY_SECRET = 'not-a-real-secret-never-used';
    wallet = new WalletService(prisma as unknown as PrismaService, {} as InvoicesService);
  }, 60000);

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await prisma?.$disconnect(); }
  }, 120000);

  describe('concurrency', () => {
    it('20 parallel debits of 10 on a balance of 100: exactly 10 succeed, balance ends at 0, never negative', async () => {
      const vendorId = await freshWallet(100);
      const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => deduct(vendorId, 10, `race ${i}`, 'test_race')));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const w = await read(vendorId);
      const debitRows = (await rows(vendorId, 'test_race')).filter((r) => r.type === 'debit').length;
      expect({ ok, balance: w.balance, totalDebited: w.totalDebited, debitRows }).toEqual({ ok: 10, balance: 0, totalDebited: 100, debitRows: 10 });
      expect(w.balance).toBe(w.totalCredited - w.totalDebited);       // the ledger still adds up
    }, 120000);

    it('every refused debit is INSUFFICIENT_WALLET_BALANCE (unchanged text)', async () => {
      const vendorId = await freshWallet(30);
      const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => deduct(vendorId, 10, `r ${i}`, 'test_refused')));
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected).toHaveLength(5);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(BadRequestException);
        expect((r.reason as BadRequestException).message).toBe('INSUFFICIENT_WALLET_BALANCE');
      }
      expect((await read(vendorId)).balance).toBe(0);
    }, 120000);

    it('mixed amounts in parallel never overdraw: balance is exactly the starting balance minus what succeeded', async () => {
      const vendorId = await freshWallet(100);
      const amounts = [7, 13, 9, 21, 5, 17, 11, 8, 30, 12, 6, 14, 25, 10, 4, 19];
      const results = await Promise.allSettled(amounts.map((a, i) => deduct(vendorId, a, `mix ${i}`, 'test_mix')));
      const spent = results.reduce((sum, r, i) => (r.status === 'fulfilled' ? sum + amounts[i] : sum), 0);
      const w = await read(vendorId);
      expect(w.balance).toBeGreaterThanOrEqual(0);
      expect({ balance: w.balance, totalDebited: w.totalDebited }).toEqual({ balance: 100 - spent, totalDebited: spent });
    }, 120000);
  });

  describe('idempotency key', () => {
    it('the same key twice (one after the other): one debit, and the second call returns the original result', async () => {
      const vendorId = await freshWallet(100);
      const first = await deduct(vendorId, 30, 'once', 'test_idem', { idempotencyKey: key('seq') });
      const second = await deduct(vendorId, 30, 'once', 'test_idem', { idempotencyKey: key('seq') });
      expect(first.balance).toBe(70);
      expect(second.balance).toBe(70);                                  // the original result, not a new one
      expect((await read(vendorId)).balance).toBe(70);
      expect(await rows(vendorId, 'test_idem')).toHaveLength(1);
    }, 60000);

    it('the same key from 10 parallel requests: exactly one debit and every request gets the same answer', async () => {
      const vendorId = await freshWallet(100);
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => deduct(vendorId, 25, 'burst', 'test_burst', { idempotencyKey: key('burst') })));
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
      expect(new Set(results.map((r) => (r as PromiseFulfilledResult<Wallet>).value.balance))).toEqual(new Set([75]));
      expect((await read(vendorId)).balance).toBe(75);
      expect(await rows(vendorId, 'test_burst')).toHaveLength(1);
    }, 120000);

    it('the same key when the first debit takes the LAST of the money: the repeats are replays, not "insufficient"', async () => {
      const vendorId = await freshWallet(25);
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => deduct(vendorId, 25, 'last', 'test_last', { idempotencyKey: key('last') })));
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
      expect(new Set(results.map((r) => (r as PromiseFulfilledResult<Wallet>).value.balance))).toEqual(new Set([0]));
      expect((await read(vendorId)).balance).toBe(0);
      expect(await rows(vendorId, 'test_last')).toHaveLength(1);
    }, 120000);

    it('the same key with a different amount is a 409 and debits nothing more', async () => {
      const vendorId = await freshWallet(100);
      await deduct(vendorId, 30, 'a', 'test_conflict', { idempotencyKey: key('amt') });
      await expect(deduct(vendorId, 40, 'a', 'test_conflict', { idempotencyKey: key('amt') })).rejects.toBeInstanceOf(ConflictException);
      expect((await read(vendorId)).balance).toBe(70);
    }, 60000);

    it('the same key for a different vendor is a 409 and debits nobody', async () => {
      const a = await freshWallet(100);
      const b = await freshWallet(100);
      await deduct(a, 30, 'x', 'test_vendor', { idempotencyKey: key('vendor') });
      await expect(deduct(b, 30, 'x', 'test_vendor', { idempotencyKey: key('vendor') })).rejects.toBeInstanceOf(ConflictException);
      expect((await read(a)).balance).toBe(70);
      expect((await read(b)).balance).toBe(100);
    }, 60000);

    it('the same key with a different service is a 409', async () => {
      const vendorId = await freshWallet(100);
      await deduct(vendorId, 30, 'x', 'test_svc_one', { idempotencyKey: key('svc') });
      await expect(deduct(vendorId, 30, 'x', 'test_svc_two', { idempotencyKey: key('svc') })).rejects.toBeInstanceOf(ConflictException);
    }, 60000);

    it('different keys are independent debits', async () => {
      const vendorId = await freshWallet(100);
      await deduct(vendorId, 10, 'x', 'test_diff', { idempotencyKey: key('d1') });
      await deduct(vendorId, 10, 'x', 'test_diff', { idempotencyKey: key('d2') });
      expect((await read(vendorId)).balance).toBe(80);
    }, 60000);
  });

  describe('amounts', () => {
    it('zero is a successful no-op: no row, balance unchanged (a ₹0 admin rate must keep working)', async () => {
      const vendorId = await freshWallet(50);
      const w = await deduct(vendorId, 0, 'free', 'test_zero');
      expect(w.balance).toBe(50);
      expect(await rows(vendorId, 'test_zero')).toHaveLength(0);
    }, 60000);

    it.each([[-10], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY]])('rejects %p and leaves the balance alone', async (bad) => {
      const vendorId = await freshWallet(50);
      await expect(deduct(vendorId, bad, 'bad', 'test_bad')).rejects.toBeInstanceOf(BadRequestException);
      const w = await read(vendorId);
      expect({ balance: w.balance, totalDebited: w.totalDebited }).toEqual({ balance: 50, totalDebited: 0 });
    }, 60000);

    it('a wallet that cannot cover the amount is refused with the same text, and nothing changes', async () => {
      const vendorId = await freshWallet(5);
      await expect(deduct(vendorId, 10, 'x', 'test_short')).rejects.toThrow('INSUFFICIENT_WALLET_BALANCE');
      expect((await read(vendorId)).balance).toBe(5);
    }, 60000);

    it('a vendor with no wallet row is refused the same way', async () => {
      const v = await seedBareVendor(prisma, `nowallet${++seq}`, RUN_ID);
      await expect(deduct(v.vendorId, 10, 'x', 'test_none')).rejects.toThrow('INSUFFICIENT_WALLET_BALANCE');
    }, 60000);
  });

  describe('refund (a credit row only; totalDebited is not restored)', () => {
    it('adds the amount back, writes one credit row, and leaves totalDebited alone', async () => {
      const vendorId = await freshWallet(100);
      await deduct(vendorId, 40, 'spend', 'test_refund_src');
      const after = await refund(vendorId, 40, 'refund of spend', 'test_refund', key('refund1'));
      const w = await read(vendorId);
      expect(after.balance).toBe(100);
      expect({ balance: w.balance, totalDebited: w.totalDebited, totalCredited: w.totalCredited }).toEqual({ balance: 100, totalDebited: 40, totalCredited: 140 });
      expect(w.balance).toBe(w.totalCredited - w.totalDebited);       // invariant holds
      const r = await rows(vendorId, 'test_refund');
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ type: 'credit', amount: 40, expiresAt: null });
    }, 60000);

    it('the same refund key twice (even in parallel) credits once', async () => {
      const vendorId = await freshWallet(0);
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => refund(vendorId, 25, 'r', 'test_refund_idem', key('refund-burst'))));
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
      expect((await read(vendorId)).balance).toBe(25);
      expect(await rows(vendorId, 'test_refund_idem')).toHaveLength(1);
    }, 120000);

    it('the same refund key with a different amount is a 409', async () => {
      const vendorId = await freshWallet(0);
      await refund(vendorId, 25, 'r', 'test_refund_conflict', key('refund-conflict'));
      await expect(refund(vendorId, 30, 'r', 'test_refund_conflict', key('refund-conflict'))).rejects.toBeInstanceOf(ConflictException);
      expect((await read(vendorId)).balance).toBe(25);
    }, 60000);

    it.each([[0], [-5], [2.5], [Number.NaN]])('refuses to refund %p', async (bad) => {
      const vendorId = await freshWallet(10);
      await expect(refund(vendorId, bad, 'r', 'test_refund_bad', key(`bad${String(bad)}`))).rejects.toBeInstanceOf(BadRequestException);
      expect((await read(vendorId)).balance).toBe(10);
    }, 60000);
  });
});
