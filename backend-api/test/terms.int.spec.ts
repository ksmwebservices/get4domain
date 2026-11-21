// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { cleanupTenants, newPrisma, seedMember, seedStaff, seedTenant, SeededTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

/**
 * Slice 5.15 on STAGING: the real routes over the real database, and the database trigger that makes an acceptance immutable. NOT RUN in the build session that wrote it (no .env.staging there).
 * It publishes real-looking test text for the three vendor documents, so it records every document row first and puts staging back exactly as it was in afterAll.
 */
jest.setTimeout(180_000);

describe('terms on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let sup: string; let ops: string; let t: SeededTenant; let memberToken: string;
  let before: Array<{ id: string; status: 'DRAFT' | 'PUBLISHED' | 'RETIRED'; changeNote: string | null; publishedAt: Date | null; publishedBy: string | null; bodyMarkdown: string; title: string }> = [];
  const api = (method: 'get' | 'post' | 'put', url: string, token: string | null, body?: object) => { const r = request(app.getHttpServer())[method](url); const a = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? a.send(body) : a; };

  beforeAll(async () => {
    prisma = newPrisma();
    before = (await prisma.v3TermsDocument.findMany()).map((d) => ({ id: d.id, status: d.status, changeNote: d.changeNote, publishedAt: d.publishedAt, publishedBy: d.publishedBy, bodyMarkdown: d.bodyMarkdown, title: d.title }));
    sup = await seedStaff(prisma, 'p515sup', RUN_ID, 'SUPER_ADMIN'); ops = await seedStaff(prisma, 'p515ops', RUN_ID, 'OPERATIONS');
    t = await seedTenant(prisma, 'p515a', RUN_ID); memberToken = await seedMember(prisma, t.vendorId, 'p515m', RUN_ID, ['website']);
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true });
  }, 240000);

  afterAll(async () => {
    // order matters: the test vendor goes first (its acceptances leave with it: the trigger allows the cascade of a vendor that is gone), then the documents this run made are removed and the older ones put back
    await runCleanup([
      () => cleanupTenants(prisma, RUN_ID),
      async () => {
        const known = new Set(before.map((b) => b.id));
        await prisma.v3TermsDocument.deleteMany({ where: { id: { notIn: [...known] } } });
        for (const b of before) await prisma.v3TermsDocument.update({ where: { id: b.id }, data: { status: b.status, changeNote: b.changeNote, publishedAt: b.publishedAt, publishedBy: b.publishedBy, bodyMarkdown: b.bodyMarkdown, title: b.title } });
      },
      () => app?.close(), () => prisma?.$disconnect(),
    ]);
  }, 180000);

  const text = `# Terms ${RUN_ID}\n\nTest text for the integration run. It is long enough to count as real text and is removed when the run ends.`;
  const publishKind = async (kind: string, note: string): Promise<void> => {
    const d = await api('post', `/v3/admin/terms/kinds/${kind}/drafts`, sup, { bodyMarkdown: text, title: `V3TEST ${RUN_ID}` });
    expect(d.status).toBe(200);
    expect((await api('post', `/v3/admin/terms/${d.body.data.id}/publish`, sup, { changeNote: note })).status).toBe(200);
  };

  it('staff: OPERATIONS is refused; a draft with the placeholder cannot be published (422 TERMS_PLACEHOLDER); the public sees nothing of a draft', async () => {
    expect((await api('get', '/v3/admin/terms', ops)).status).toBe(403);
    const d = await api('post', '/v3/admin/terms/kinds/GRIEVANCE/drafts', sup, {});
    expect(d.status).toBe(200); expect(d.body.data).toMatchObject({ status: 'DRAFT', placeholder: true });
    const blocked = await api('post', `/v3/admin/terms/${d.body.data.id}/publish`, sup, { changeNote: 'First version' });
    expect(blocked.status).toBe(422); expect(blocked.body.code).toBe('TERMS_PLACEHOLDER');
    const pub = await request(app.getHttpServer()).get('/v3/public/terms/GRIEVANCE');
    expect([200, 404]).toContain(pub.status);   // 404 unless an earlier real version of this kind is live on staging; never the draft text
    if (pub.status === 200) expect(pub.body.data.bodyMarkdown).not.toBe('To be supplied by counsel');
  });

  it('publish the three vendor documents: the owner is asked to accept, a team member cannot, acceptance clears the flag, and a new version asks again', async () => {
    for (const k of ['VENDOR_TERMS', 'ACCEPTABLE_USE', 'DATA_PROCESSING']) await publishKind(k, 'Integration run');
    const st = await api('get', '/v3/me/terms', t.token);
    expect(st.status).toBe(200); expect(st.body.data.acceptanceRequired).toBe(true);
    expect((await api('get', '/v3/me/terms', memberToken)).status).toBe(403);
    const docs = st.body.data.outstanding as Array<{ kind: string; version: number }>;
    expect((await api('post', '/v3/me/terms/accept', t.token, { documents: docs.map((d) => ({ ...d, version: d.version + 5 })) })).status).toBe(409);
    const ok = await api('post', '/v3/me/terms/accept', t.token, { documents: docs });
    expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ accepted: 3, acceptanceRequired: false });
    expect((await api('post', '/v3/me/terms/accept', t.token, { documents: docs })).body.data.accepted).toBe(0);   // idempotent
    await publishKind('DATA_PROCESSING', 'Integration run: a new version');
    expect((await api('get', '/v3/me/terms', t.token)).body.data).toMatchObject({ acceptanceRequired: true, outstanding: [{ kind: 'DATA_PROCESSING' }] });
  });

  it('the database refuses to change or delete an acceptance, and lets it go only when its vendor row is gone', async () => {
    const row = await prisma.v3TermsAcceptance.findFirstOrThrow({ where: { vendorId: t.vendorId } });
    await expect(prisma.v3TermsAcceptance.update({ where: { id: row.id }, data: { version: 99 } })).rejects.toThrow(/cannot be changed/);
    await expect(prisma.v3TermsAcceptance.delete({ where: { id: row.id } })).rejects.toThrow(/cannot be deleted/);
    await expect(prisma.$executeRawUnsafe(`UPDATE "g4d_terms_acceptances" SET "ipHash" = 'x' WHERE "vendorId" = '${t.vendorId}'`)).rejects.toThrow(/cannot be changed/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "g4d_terms_acceptances" WHERE "vendorId" = '${t.vendorId}'`)).rejects.toThrow(/cannot be deleted/);
    expect(await prisma.v3TermsAcceptance.count({ where: { vendorId: t.vendorId } })).toBe(3);
  });
});
