// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { ProvisioningRepository } from '../src/provisioning/provisioning.repository';
import { JobRunnerService, PROVISIONING_STEPS, ProvisioningAudit, ProvisioningStep } from '../src/provisioning/runner/job-runner.service';
import { ProvisioningSettingsService } from '../src/provisioning/settings/provisioning-settings.service';
import { cleanupTenants, newPrisma, seedStaff } from './support/fixtures';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

/**
 * S53.8 on STAGING: two or more runners over the real database never execute the same job twice (FOR UPDATE SKIP LOCKED + lease), and a runner that
 * crashed mid-job is taken over once its lease lapses. Synthetic data only, removed at the end. NOT RUN in the build session that wrote it (no .env.staging there).
 */
describe('provisioning concurrency on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let ops: string;
  let seq = 0;
  const phone = (): string => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const key = (): string => `v3test-${RUN_ID}-conc-${++seq}`;
  const biz = (label: string) => ({ businessName: `V3TEST ${label} ${RUN_ID}`, track: 'professional', category: 'lawyer', ownerName: 'V3TEST Owner', phone: phone(), email: `p53${label}-${RUN_ID}@v3test.invalid`, city: 'Chennai', language: 'en' });
  const create = async (label: string): Promise<{ id: string; email: string }> => {
    const input = biz(label);
    const r = await request(app.getHttpServer()).post('/v3/admin/provisioning/jobs').set('Authorization', `Bearer ${ops}`).set('Idempotency-Key', key()).send(input);
    return { id: r.body.data.id as string, email: input.email };
  };
  /** another runner over the same database, as a second process would be */
  const newRunner = (id: string): JobRunnerService =>
    new JobRunnerService(app.get(ProvisioningRepository), app.get<ProvisioningStep[]>(PROVISIONING_STEPS), app.get(ProvisioningSettingsService), app.get(ProvisioningAudit), id);

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    ops = await seedStaff(prisma, 'p53conc', RUN_ID, 'OPERATIONS');
    app = await buildProvisioningTestApp();
  }, 180000);

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 120000);

  it('two runners racing for ONE job: exactly one runs it, and nothing is created twice', async () => {
    const j = await create('one');
    const [a, b] = await Promise.all([newRunner('runner-A').runOne({ jobId: j.id }), newRunner('runner-B').runOne({ jobId: j.id })]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect((await prisma.v3ProvisioningJob.findUniqueOrThrow({ where: { id: j.id } })).status).toBe('SUCCEEDED');
    const steps = await prisma.v3ProvisioningStep.findMany({ where: { jobId: j.id } });
    expect(steps.every((s) => s.attempts === 1 && s.status === 'DONE')).toBe(true);
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { email: j.email } });
    expect(await prisma.v3PlanSubscription.count({ where: { vendorId: vendor.id } })).toBe(1);
    expect(await prisma.v3ClaimToken.count({ where: { vendorId: vendor.id } })).toBe(1);
    expect(await prisma.v3Invite.count({ where: { vendorId: vendor.id } })).toBe(1);
  });

  it('three runners over six due jobs: every job succeeds once, every step ran once, six distinct vendors', async () => {
    const jobs = await Promise.all(['a', 'b', 'c', 'd', 'e', 'f'].map((l) => create(`many${l}`)));
    const ids = jobs.map((j) => j.id);
    await Promise.all([newRunner('r1').runDue(6), newRunner('r2').runDue(6), newRunner('r3').runDue(6)]);
    const rows = await prisma.v3ProvisioningJob.findMany({ where: { id: { in: ids } }, include: { steps: true } });
    expect(rows.map((r) => r.status)).toEqual(Array(6).fill('SUCCEEDED'));
    for (const r of rows) expect(r.steps.every((s) => s.attempts === 1)).toBe(true);
    expect(new Set(rows.map((r) => r.vendorId)).size).toBe(6);
    expect(await prisma.vendor.count({ where: { email: { in: jobs.map((j) => j.email) } } })).toBe(6);
  });

  it('a crashed runner\'s job is taken over after its lease lapses, and finishes without repeating done steps', async () => {
    const j = await create('crash');
    // simulate a runner that claimed the job and died: RUNNING, lease already in the past, first step half done
    await prisma.v3ProvisioningJob.update({ where: { id: j.id }, data: { status: 'RUNNING', lockedBy: 'runner-dead', lockedUntil: new Date(Date.now() - 60_000) } });
    await prisma.v3ProvisioningStep.update({ where: { jobId_stepKey: { jobId: j.id, stepKey: 'CREATE_VENDOR' } }, data: { status: 'RUNNING', attempts: 1 } });
    const report = await newRunner('runner-rescue').runOne({ jobId: j.id });
    expect(report).toMatchObject({ status: 'SUCCEEDED' });
    expect(await prisma.vendor.count({ where: { email: j.email } })).toBe(1);
    expect((await prisma.v3ProvisioningJob.findUniqueOrThrow({ where: { id: j.id } })).lockedBy).toBeNull();
  });

  it('a job whose lease is still valid is NOT taken by another runner', async () => {
    const j = await create('lease');
    await prisma.v3ProvisioningJob.update({ where: { id: j.id }, data: { status: 'RUNNING', lockedBy: 'runner-busy', lockedUntil: new Date(Date.now() + 600_000) } });
    expect(await newRunner('runner-other').runOne({ jobId: j.id })).toBeNull();
    expect(await prisma.vendor.count({ where: { email: j.email } })).toBe(0);
  });
});
