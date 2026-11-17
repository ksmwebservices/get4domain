import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { InMemoryGateway } from '../../src/plan-billing/gateway/in-memory.gateway';
import { BillingSettingsService } from '../../src/plan-billing/settings/billing-settings.service';
import { paiseToDecimal } from '../../src/plan-billing/gateway/gateway-core';
import { RUN_ID } from './staging-env';
import { buildProvisioningTestApp } from './provisioning-test-app';
import { FakeRazorpay } from './fake-razorpay';
import { secret } from './wave3-world';

/**
 * Helpers for the Wave 3 staging suites. Like every staging suite they use the real (staging) database and NEVER a real provider: the app is built with in-memory gateways whose secrets are made here,
 * at run time. Every row a suite creates carries the test markers (e-mails ending @v3test.invalid, names starting V3TEST, run id in the keys), so `npm run test:cleanup-staging` removes it.
 */
export interface Wave3Env {
  app: INestApplication; gws: { razorpay: InMemoryGateway; cashfree: InMemoryGateway };
  api: (method: 'get' | 'post' | 'put' | 'delete', url: string, token?: string, body?: object) => request.Test;
  /** switches the admin setting directly in the database and forgets the settings cache */
  setGateway: (name: 'razorpay' | 'cashfree') => Promise<void>;
  /** the body and headers a gateway would POST for a successful or failed payment, signed with the secret this run made */
  hook: (gateway: 'razorpay' | 'cashfree', providerOrderId: string, o: { amountMinor: number; paymentId: string; eventId?: string; sign?: boolean; failed?: boolean }) => { raw: string; headers: Record<string, string | undefined> };
  key: (label: string) => string;
}

/** `wallet: true` also mounts the real V3 wallet routes (/v3/me/wallet and the rest), for suites that must prove a rule holds on routes outside the partner area. */
export async function bootWave3(prisma: PrismaClient, opts: { wallet?: boolean; legacyVendorsRoute?: boolean } = {}): Promise<Wave3Env> {
  const gws = { razorpay: new InMemoryGateway('razorpay', { signing: secret(), webhook: secret() }), cashfree: new InMemoryGateway('cashfree', { signing: secret(), webhook: secret() }) };
  const app = await buildProvisioningTestApp({ billing: { fake: new FakeRazorpay() }, wave3: { gateways: gws }, ...(opts.wallet ? { wallet: true } : {}), ...(opts.legacyVendorsRoute ? { legacyVendorsRoute: true } : {}) });
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token?: string, body?: object) => { const r = request(app.getHttpServer())[method](url); const t = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? t.send(body) : t; };
  const setGateway = async (name: 'razorpay' | 'cashfree') => { await prisma.v3PlanSetting.upsert({ where: { key: 'paymentGateway' }, create: { key: 'paymentGateway', valueJson: name, description: 'v3test' }, update: { valueJson: name } }); app.get(BillingSettingsService).invalidate(); };
  const hook: Wave3Env['hook'] = (gateway, providerOrderId, o) => {
    const raw = gateway === 'cashfree'
      ? JSON.stringify({ type: o.failed ? 'PAYMENT_FAILED_WEBHOOK' : 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: providerOrderId }, payment: { cf_payment_id: o.paymentId, payment_status: o.failed ? 'FAILED' : 'SUCCESS', payment_amount: paiseToDecimal(o.amountMinor), payment_currency: 'INR' } } })
      : JSON.stringify({ event: o.failed ? 'payment.failed' : 'payment.captured', payload: { payment: { entity: { id: o.paymentId, order_id: providerOrderId, amount: o.amountMinor, currency: 'INR', status: o.failed ? 'failed' : 'captured' } } } });
    const gw = gws[gateway];
    return { raw, headers: o.sign === false ? gw.signedHeaders(raw + ' tampered', new Date(), o.eventId) : gw.signedHeaders(raw, new Date(), o.eventId) };
  };
  let n = 0;
  return { app, gws, api, setGateway, hook, key: (label) => `v3test-${RUN_ID}-${label}-${++n}` };
}

/** POSTs a signed gateway webhook as the gateway would: the raw body with the gateway's own headers. */
export function postHook(env: Wave3Env, gateway: 'razorpay' | 'cashfree', h: { raw: string; headers: Record<string, string | undefined> }): request.Test {
  let r = request(env.app.getHttpServer()).post(`/v3/payments/${gateway}/webhook`).set('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(h.headers)) if (v !== undefined) r = r.set(k, v);
  return r.send(h.raw);
}
