import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus, STEP_ORDER, StepKey, StepStatus } from './core/state-machine';

export interface JobRow {
  id: string;
  kind: 'BUSINESS_FREE_SITE';
  status: JobStatus;
  idempotencyKey: string;
  vendorId: string | null;
  input: Record<string, unknown>;
  currentStep: StepKey | null;
  attempt: number;
  maxAttempts: number;
  nextRunAt: Date;
  lockedBy: string | null;
  lockedUntil: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdByType: 'STAFF' | 'SYSTEM';
  createdById: string | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StepRow {
  jobId: string;
  stepKey: StepKey;
  status: StepStatus;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  outputRef: Record<string, string> | null;
  errorCode: string | null;
}

export interface NewJob {
  idempotencyKey: string;
  input: Record<string, unknown>;
  maxAttempts: number;
  createdByType: 'STAFF' | 'SYSTEM';
  createdById: string | null;
}

export interface JobFinish {
  status: JobStatus;
  currentStep?: StepKey | null;
  attempt?: number;
  nextRunAt?: Date;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  finishedAt?: Date | null;
}

export interface JobListFilter { status?: JobStatus; from?: Date; to?: Date; skip: number; take: number }

/**
 * Everything the runner needs from storage. Two implementations: Prisma (below) and an in-memory one in test/support, which behaves the same way
 * (claim is atomic, a lease fences writes), so the runner's crash and double-runner behaviour is tested without a database.
 */
export abstract class ProvisioningRepository {
  /** Idempotent: an existing key returns the existing job (`created: false`). The five steps are created PENDING with it. */
  abstract createJob(data: NewJob): Promise<{ job: JobRow; created: boolean }>;
  abstract getJob(id: string): Promise<JobRow | null>;
  abstract listJobs(filter: JobListFilter): Promise<{ items: JobRow[]; total: number }>;
  abstract listSteps(jobId: string): Promise<StepRow[]>;
  /**
   * Atomically takes ONE due job (QUEUED or WAITING with nextRunAt <= now, or RUNNING whose lease has lapsed) for `runnerId`, sets its lease, and returns it.
   * Two runners never receive the same job. `onlyJobId` restricts the claim to one job (admin "run now").
   */
  abstract claimNext(runnerId: string, now: Date, leaseMs: number, onlyJobId?: string): Promise<JobRow | null>;
  /** Pushes the lease forward; false when this runner no longer holds the job. */
  abstract extendLease(jobId: string, runnerId: string, now: Date, leaseMs: number): Promise<boolean>;
  abstract markStepRunning(jobId: string, key: StepKey, now: Date): Promise<void>;
  abstract finishStep(jobId: string, key: StepKey, status: StepStatus, now: Date, outputRef: Record<string, string> | null, errorCode: string | null): Promise<void>;
  abstract setVendor(jobId: string, vendorId: string): Promise<void>;
  /** Ends this runner's hold on the job. Writes nothing and returns false when the lease was lost. */
  abstract finishRun(jobId: string, runnerId: string, patch: JobFinish): Promise<boolean>;
  abstract resetForRetry(jobId: string, now: Date): Promise<void>;
  abstract cancel(jobId: string, now: Date, skipKeys: StepKey[]): Promise<void>;
}

const toJob = (r: Prisma.V3ProvisioningJobGetPayload<object>): JobRow => ({ ...r, input: (r.input ?? {}) as Record<string, unknown>, status: r.status as JobStatus, currentStep: r.currentStep as StepKey | null, createdByType: r.createdByType === 'STAFF' ? 'STAFF' : 'SYSTEM' });
const toStep = (r: Prisma.V3ProvisioningStepGetPayload<object>): StepRow => ({ ...r, stepKey: r.stepKey as StepKey, status: r.status as StepStatus, outputRef: (r.outputRef ?? null) as Record<string, string> | null });

@Injectable()
export class PrismaProvisioningRepository extends ProvisioningRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  async createJob(data: NewJob): Promise<{ job: JobRow; created: boolean }> {
    const existing = await this.prisma.v3ProvisioningJob.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing) return { job: toJob(existing), created: false };
    try {
      const row = await this.prisma.v3ProvisioningJob.create({
        data: {
          idempotencyKey: data.idempotencyKey, input: data.input as Prisma.InputJsonValue, maxAttempts: data.maxAttempts,
          createdByType: data.createdByType, createdById: data.createdById,
          steps: { create: STEP_ORDER.map((stepKey) => ({ stepKey })) },
        },
      });
      return { job: toJob(row), created: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.prisma.v3ProvisioningJob.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
        if (winner) return { job: toJob(winner), created: false };
      }
      throw e;
    }
  }

  async getJob(id: string): Promise<JobRow | null> {
    const r = await this.prisma.v3ProvisioningJob.findUnique({ where: { id } });
    return r ? toJob(r) : null;
  }

  async listJobs(f: JobListFilter): Promise<{ items: JobRow[]; total: number }> {
    const where: Prisma.V3ProvisioningJobWhereInput = {
      ...(f.status ? { status: f.status } : {}),
      ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.v3ProvisioningJob.findMany({ where, orderBy: { createdAt: 'desc' }, skip: f.skip, take: f.take }),
      this.prisma.v3ProvisioningJob.count({ where }),
    ]);
    return { items: rows.map(toJob), total };
  }

  async listSteps(jobId: string): Promise<StepRow[]> {
    const rows = await this.prisma.v3ProvisioningStep.findMany({ where: { jobId } });
    return rows.map(toStep).sort((a, b) => STEP_ORDER.indexOf(a.stepKey) - STEP_ORDER.indexOf(b.stepKey));
  }

  /**
   * One statement: the inner SELECT locks a single due row with FOR UPDATE SKIP LOCKED (a second runner skips it instead of waiting), the outer UPDATE takes
   * the lease. No advisory lock is needed because nothing else is read between the choice and the write. All values are bound parameters.
   */
  async claimNext(runnerId: string, now: Date, leaseMs: number, onlyJobId?: string): Promise<JobRow | null> {
    const until = new Date(now.getTime() + leaseMs);
    const rows = onlyJobId
      ? await this.prisma.$queryRaw<{ id: string }[]>`
          UPDATE "g4d_provisioning_jobs" SET "status" = 'RUNNING', "lockedBy" = ${runnerId}, "lockedUntil" = ${until}, "updatedAt" = ${now}
          WHERE "id" = (
            SELECT "id" FROM "g4d_provisioning_jobs"
            WHERE "id" = ${onlyJobId}
              AND (("status" IN ('QUEUED', 'WAITING') AND "nextRunAt" <= ${now}) OR ("status" = 'RUNNING' AND "lockedUntil" < ${now}))
            FOR UPDATE SKIP LOCKED)
          RETURNING "id"`
      : await this.prisma.$queryRaw<{ id: string }[]>`
          UPDATE "g4d_provisioning_jobs" SET "status" = 'RUNNING', "lockedBy" = ${runnerId}, "lockedUntil" = ${until}, "updatedAt" = ${now}
          WHERE "id" = (
            SELECT "id" FROM "g4d_provisioning_jobs"
            WHERE ("status" IN ('QUEUED', 'WAITING') AND "nextRunAt" <= ${now}) OR ("status" = 'RUNNING' AND "lockedUntil" < ${now})
            ORDER BY "nextRunAt" ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED)
          RETURNING "id"`;
    if (rows.length === 0) return null;
    return this.getJob(rows[0].id);
  }

  async extendLease(jobId: string, runnerId: string, now: Date, leaseMs: number): Promise<boolean> {
    const r = await this.prisma.v3ProvisioningJob.updateMany({ where: { id: jobId, lockedBy: runnerId, status: 'RUNNING' }, data: { lockedUntil: new Date(now.getTime() + leaseMs) } });
    return r.count === 1;
  }

  async markStepRunning(jobId: string, key: StepKey, now: Date): Promise<void> {
    await this.prisma.v3ProvisioningStep.update({ where: { jobId_stepKey: { jobId, stepKey: key } }, data: { status: 'RUNNING', startedAt: now, attempts: { increment: 1 }, errorCode: null } });
    await this.prisma.v3ProvisioningJob.update({ where: { id: jobId }, data: { currentStep: key } });
  }

  async finishStep(jobId: string, key: StepKey, status: StepStatus, now: Date, outputRef: Record<string, string> | null, errorCode: string | null): Promise<void> {
    await this.prisma.v3ProvisioningStep.update({
      where: { jobId_stepKey: { jobId, stepKey: key } },
      data: { status, finishedAt: now, errorCode, ...(outputRef ? { outputRef: outputRef as Prisma.InputJsonValue } : {}) },
    });
  }

  async setVendor(jobId: string, vendorId: string): Promise<void> {
    await this.prisma.v3ProvisioningJob.update({ where: { id: jobId }, data: { vendorId } });
  }

  async finishRun(jobId: string, runnerId: string, p: JobFinish): Promise<boolean> {
    const r = await this.prisma.v3ProvisioningJob.updateMany({
      where: { id: jobId, lockedBy: runnerId, status: 'RUNNING' },
      data: {
        status: p.status, lockedBy: null, lockedUntil: null,
        ...(p.currentStep !== undefined ? { currentStep: p.currentStep } : {}),
        ...(p.attempt !== undefined ? { attempt: p.attempt } : {}),
        ...(p.nextRunAt ? { nextRunAt: p.nextRunAt } : {}),
        ...(p.lastErrorCode !== undefined ? { lastErrorCode: p.lastErrorCode } : {}),
        ...(p.lastErrorMessage !== undefined ? { lastErrorMessage: p.lastErrorMessage } : {}),
        ...(p.finishedAt !== undefined ? { finishedAt: p.finishedAt } : {}),
      },
    });
    return r.count === 1;
  }

  async resetForRetry(jobId: string, now: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.v3ProvisioningStep.updateMany({ where: { jobId, status: 'FAILED' }, data: { status: 'PENDING', errorCode: null } }),
      this.prisma.v3ProvisioningJob.update({ where: { id: jobId }, data: { status: 'QUEUED', attempt: 0, nextRunAt: now, lastErrorCode: null, lastErrorMessage: null, finishedAt: null, lockedBy: null, lockedUntil: null } }),
    ]);
  }

  async cancel(jobId: string, now: Date, skipKeys: StepKey[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.v3ProvisioningStep.updateMany({ where: { jobId, stepKey: { in: skipKeys } }, data: { status: 'SKIPPED', finishedAt: now } }),
      this.prisma.v3ProvisioningJob.update({ where: { id: jobId }, data: { status: 'CANCELLED', finishedAt: now, lockedBy: null, lockedUntil: null } }),
    ]);
  }
}

/** A runner id that is unique per process and run (not a secret). */
export const newRunnerId = (): string => `runner-${randomBytes(6).toString('hex')}`;
