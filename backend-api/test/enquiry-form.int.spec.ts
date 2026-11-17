// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Dispatch G1 B1 on STAGING: the vendor site's own enquiry form post over the real routes and the real database. The theme form's fields (urlencoded) become ONE request and ONE inbox row; a double post is
 * still one; the vendor reads it through the inbox route the Enquiries screen uses; another vendor reads nothing of it; a Free site and an unknown host are the same 404; no consent is a 400.
 * Synthetic data only (V3TEST names). No mail is sent: EMAIL_FORWARD_LIVE is off, so the row says SKIPPED_FLAG_OFF.
 */
jest.setTimeout(180_000);

describe('the enquiry form post on staging', () => {
  let app: INestApplication; let prisma: PrismaClient;
  let A: SeededTenant; let B: SeededTenant; let F: SeededTenant; let tokenA: string; let tokenB: string;
  let hostA: string; let hostF: string;
  const phone = `98${String(Date.now()).slice(-8)}`;
  const api = (method: 'get' | 'post', url: string, token: string | null) => { const r = request(app.getHttpServer())[method](url); return token ? r.set('Authorization', `Bearer ${token}`) : r; };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'g1b1a', RUN_ID); B = await seedTenant(prisma, 'g1b1b', RUN_ID); F = await seedTenant(prisma, 'g1b1f', RUN_ID);
    hostA = (await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true })).host; await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true }); hostF = (await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false })).host;
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  const form = (over: Record<string, string> = {}) => ({ name: 'V3TEST Meena', phone, message: `V3TEST ${RUN_ID} do you fix geysers?`, consent: 'on', source: 'site', ...over });

  it('the theme form post becomes one request and one inbox row; a double post is still one; the vendor reads it; another vendor reads nothing', async () => {
    const first = await request(app.getHttpServer()).post(`/v3/public/sites/${hostA}/enquire`).type('form').send(form());
    expect(first.status).toBe(200); expect(first.body.data).toMatchObject({ received: true }); expect(first.headers['cache-control']).toBe('no-store');
    const again = await request(app.getHttpServer()).post(`/v3/public/sites/${hostA}/enquire`).type('form').send(form());
    expect(again.status).toBe(200); expect(again.body.data.reference).toBe(first.body.data.reference);
    const reqs = await api('get', '/v3/me/requests', tokenA); expect(reqs.status).toBe(200); expect(reqs.body.data.total).toBe(1);
    const inbox = await api('get', '/v3/me/inbox', tokenA); expect(inbox.status).toBe(200); expect(inbox.body.data.total).toBe(1);
    expect(inbox.body.data.items[0]).toMatchObject({ state: 'NEW', fromName: 'V3TEST Meena', forwardStatus: 'SKIPPED_FLAG_OFF' });
    const one = await api('get', `/v3/me/inbox/${inbox.body.data.items[0].id}`, tokenA); expect(one.body.data.body).toContain('geysers'); expect(one.body.data.body).toContain('+91');
    expect((await api('get', '/v3/me/inbox', tokenB)).body.data.total).toBe(0);
    expect(await prisma.v3InboxMessage.count({ where: { vendorId: A.vendorId } })).toBe(1);
  });

  it('a browser form post gets a 303 back to the site; no consent is a 400; a Free site and an unknown host are the same 404', async () => {
    const browser = await request(app.getHttpServer()).post(`/v3/public/sites/${hostA}/enquire`).set('Accept', 'text/html').type('form').send(form({ message: `V3TEST ${RUN_ID} second question` })).redirects(0);
    expect(browser.status).toBe(303); expect(browser.headers.location).toBe('/?enquiry=sent');
    const noConsent = await request(app.getHttpServer()).post(`/v3/public/sites/${hostA}/enquire`).type('form').send(form({ consent: '', message: `V3TEST ${RUN_ID} third` }));
    expect(noConsent.status).toBe(400); expect(noConsent.body.code).toBe('REQUEST_INVALID');
    const a = await request(app.getHttpServer()).post(`/v3/public/sites/${hostF}/enquire`).type('form').send(form()); const b = await request(app.getHttpServer()).post('/v3/public/sites/nobody-here.get4domain.com/enquire').type('form').send(form());
    expect([a.status, b.status]).toEqual([404, 404]); expect(a.body.message).toBe(b.body.message);
    expect(await prisma.v3InboxMessage.count({ where: { vendorId: F.vendorId } })).toBe(0);
  });
});
