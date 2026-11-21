// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as crypto from 'crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { buildTestApp } from './support/test-app';
import { SeededTenant, cleanupTenants, newPrisma, seedMember, seedTenant } from './support/fixtures';

/**
 * S8-A: a vendor's team member must not be able to read or replace the vendor's payment credentials.
 * Before the fix, PUT /vendor-payments had no owner/area guard: any invited member (even one granted only 'telecrm') could replace
 * the vendor's Razorpay keys and redirect the public-checkout money. Real controller + real service against the STAGING database.
 * Key ids are assembled at run time and are obviously fake; no call is made to Razorpay (the owner "test" case fails validation first).
 */
const fakeKeyId = (tail: string) => ['rzp', 'test', tail].join('_');
const KEY_A = fakeKeyId('AAAAAAAAAAAA01');
const KEY_NEW = fakeKeyId('NEWKEYNEWKEY02');

describe('vendor payment credentials: owner-only writes, area-gated reads (staging database)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let A: SeededTenant;
  let B: SeededTenant;
  let restricted: string;        // a member of A with only 'telecrm' (no 'accounts')
  const secretPlain = crypto.randomBytes(12).toString('hex');

  const call = (token: string | undefined, method: 'get' | 'put' | 'post', path: string, body?: Record<string, unknown>) => {
    let r = request(app.getHttpServer())[method](path);
    if (token) r = r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const data = (res: { body: { data?: unknown } }): Record<string, unknown> => ((res.body.data ?? res.body) as Record<string, unknown>);
  const row = () => prisma.vendorPaymentConfig.findUnique({ where: { vendorId: A.vendorId } });

  beforeAll(async () => {
    process.env.PLATFORM_SETTINGS_KEY = crypto.randomBytes(32).toString('hex');   // throw-away key for the encrypt step
    prisma = newPrisma();
    app = await buildTestApp();
    A = await seedTenant(prisma, 'pa', RUN_ID);
    B = await seedTenant(prisma, 'pb', RUN_ID);
    restricted = await seedMember(prisma, A.vendorId, 'pa-restricted', RUN_ID, ['telecrm']);
    await prisma.vendorPaymentConfig.create({ data: { vendorId: A.vendorId, razorpayKeyId: KEY_A, razorpayKeySecret: 'placeholder-not-a-secret', enabled: false } });
  }, 120000);

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 120000);

  describe('a team member cannot change or test the credentials', () => {
    it('a member with only "telecrm" gets 403 on PUT and the stored key is untouched', async () => {
      const res = await call(restricted, 'put', '/vendor-payments', { razorpayKeyId: KEY_NEW, enabled: true });
      if (res.status !== 403) throw new Error(`PUT /vendor-payments as a restricted team member answered ${res.status}, expected 403`);
      const r = await row();
      expect({ keyId: r?.razorpayKeyId, enabled: r?.enabled }).toEqual({ keyId: KEY_A, enabled: false });
    });

    it('even a member WITH the accounts area gets 403 on PUT (writes are owner-only) and nothing changes', async () => {
      const res = await call(A.memberToken, 'put', '/vendor-payments', { razorpayKeyId: KEY_NEW });
      if (res.status !== 403) throw new Error(`PUT /vendor-payments as a member with the accounts area answered ${res.status}, expected 403`);
      expect((await row())?.razorpayKeyId).toBe(KEY_A);
    });

    it('POST /vendor-payments/test is 403 for any member (the guard runs before any provider call)', async () => {
      for (const token of [restricted, A.memberToken]) {
        const res = await call(token, 'post', '/vendor-payments/test', { razorpayKeyId: 'not-a-key' });
        if (res.status !== 403) throw new Error(`POST /vendor-payments/test as a team member answered ${res.status}, expected 403`);
      }
    });
  });

  describe('reading needs the accounts area', () => {
    it('a member without "accounts" gets 403 on GET', async () => {
      const res = await call(restricted, 'get', '/vendor-payments');
      if (res.status !== 403) throw new Error(`GET /vendor-payments as a member without accounts answered ${res.status}, expected 403`);
      expect(JSON.stringify(res.body)).not.toContain(KEY_A);
    });
    it('a member with "accounts" can read, and the secret is never in the response', async () => {
      const res = await call(A.memberToken, 'get', '/vendor-payments');
      expect(res.status).toBe(200);
      expect(data(res).razorpayKeyId).toBe(KEY_A);
      expect(JSON.stringify(res.body)).not.toContain('placeholder-not-a-secret');
      expect(JSON.stringify(res.body)).not.toMatch(/razorpayKeySecret|keySecret/);
    });
    it('the owner can read', async () => {
      const res = await call(A.token, 'get', '/vendor-payments');
      expect(res.status).toBe(200);
      expect(data(res)).toMatchObject({ razorpayKeyId: KEY_A, hasSecret: true });
    });
  });

  describe('the owner can still manage the credentials (positive controls)', () => {
    it('owner PUT stores the key; the secret is encrypted at rest and never returned', async () => {
      const res = await call(A.token, 'put', '/vendor-payments', { razorpayKeyId: KEY_NEW, razorpayKeySecret: secretPlain, enabled: true });
      expect(res.status).toBe(200);
      expect(data(res)).toMatchObject({ razorpayKeyId: KEY_NEW, enabled: true, hasSecret: true });
      expect(JSON.stringify(res.body)).not.toContain(secretPlain);
      const r = await row();
      expect(r?.razorpayKeyId).toBe(KEY_NEW);
      expect(r?.razorpayKeySecret).toBeTruthy();
      expect(r?.razorpayKeySecret).not.toContain(secretPlain);               // stored encrypted (iv:tag:ciphertext)
      expect(String(r?.razorpayKeySecret).split(':')).toHaveLength(3);
    });
    it('owner test with a malformed key id is a plain 400 (validation, no call to Razorpay)', async () => {
      const res = await call(A.token, 'post', '/vendor-payments/test', { razorpayKeyId: 'not-a-key' });
      expect(res.status).toBe(400);
    });
  });

  describe('isolation and authentication', () => {
    it("another vendor never sees this vendor's key id", async () => {
      const res = await call(B.token, 'get', '/vendor-payments');
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(KEY_A);
      expect(JSON.stringify(res.body)).not.toContain(KEY_NEW);
      expect(data(res).razorpayKeyId).toBeNull();
    });
    it('another vendor\'s PUT changes only their own row', async () => {
      const before = await row();
      const res = await call(B.token, 'put', '/vendor-payments', { razorpayKeyId: fakeKeyId('BBBBBBBBBBBB03') });
      expect(res.status).toBe(200);
      expect(await row()).toEqual(before);
    });
    it('no token is 401 on all three routes', async () => {
      for (const [m, p] of [['get', '/vendor-payments'], ['put', '/vendor-payments'], ['post', '/vendor-payments/test']] as const) {
        expect((await call(undefined, m, p, m === 'get' ? undefined : {})).status).toBe(401);
      }
    });
  });
});
