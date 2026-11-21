// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { buildTestApp } from './support/test-app';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant } from './support/fixtures';

/**
 * What a real client sees when a delete is blocked by a database constraint. Before this fix the response was a 500 whose
 * message contained the server's absolute file path and Prisma's query text (found by the tenant-isolation run).
 */
const LEAK_NEEDLES = ['c:\\', '/app/', 'node_modules', 'prisma', 'invocation', 'invalid `', 'foreign key', 'constraint', 'contacts.service', '.ts:'];

describe('error responses (staging database, synthetic tenant)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let T: SeededTenant;

  const call = (method: 'get' | 'delete', path: string) => request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${T.token}`);

  beforeAll(async () => {
    prisma = newPrisma();
    app = await buildTestApp();
    T = await seedTenant(prisma, 'e', RUN_ID);
  }, 120000);

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 120000);

  it('deleting a contact that records and invoices still use answers 409, not 500', async () => {
    const res = await call('delete', `/domainapp/contacts/${T.ids.contact}`);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, statusCode: 409 });
  });

  it('the 409 body contains no file path, query text or Prisma text', async () => {
    const res = await call('delete', `/domainapp/contacts/${T.ids.contact}`);
    const text = JSON.stringify(res.body).toLowerCase();
    for (const needle of LEAK_NEEDLES) expect({ needle, found: text.includes(needle) }).toEqual({ needle, found: false });
  });

  it('the 409 tells the owner what is in the way (counts of records and invoices)', async () => {
    const res = await call('delete', `/domainapp/contacts/${T.ids.contact}`);
    expect(res.status).toBe(409);
    expect(String(res.body.message)).toMatch(/1 record/);
    expect(String(res.body.message)).toMatch(/1 invoice/);
  });

  it('the contact was not deleted', async () => {
    expect(await prisma.contact.findUnique({ where: { id: T.ids.contact } })).not.toBeNull();
  });

  it('an unknown id is still a plain 404 with its own message', async () => {
    const res = await call('delete', '/domainapp/contacts/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Contact not found');
  });

  it('an unused contact can still be deleted', async () => {
    const res = await call('delete', `/domainapp/contacts/${T.ids.disposableContact}`);
    expect(res.status).toBe(200);
    expect(await prisma.contact.findUnique({ where: { id: T.ids.disposableContact } })).toBeNull();
  });
});
