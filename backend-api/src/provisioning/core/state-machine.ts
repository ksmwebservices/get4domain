/**
 * The pure core of the provisioning runner: what to do next, how long to wait, who may retry or cancel. No database, no clock, no randomness of its own
 * (the caller passes `now` and `random`), so every rule is unit tested. Diagram and rules: docs/v3/V3_S3_PROVISIONING.md section 4.
 */
export type StepKey = 'CREATE_VENDOR' | 'ASSIGN_FREE_PLAN' | 'CREATE_FREE_SITE_DRAFT' | 'CREATE_CLAIM_LINK' | 'SEND_INVITE';
export type StepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
export type JobStatus = 'QUEUED' | 'RUNNING' | 'WAITING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export const STEP_ORDER: readonly StepKey[] = ['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT', 'CREATE_CLAIM_LINK', 'SEND_INVITE'];

export interface StepState { stepKey: StepKey; status: StepStatus }
export interface RunContext { hasRawToken: boolean }
export type Decision = { action: 'RUN_STEP'; step: StepKey } | { action: 'COMPLETE' };

/**
 * The first step that is neither DONE nor SKIPPED runs next (a FAILED or half-run step runs again: steps are idempotent).
 * The raw claim token exists only in memory during one run, so when SEND_INVITE is next and this run does not hold the token, the link is issued again first.
 */
export function decide(steps: readonly StepState[], ctx: RunContext): Decision {
  const status = new Map(steps.map((s) => [s.stepKey, s.status]));
  for (const key of STEP_ORDER) {
    const st = status.get(key) ?? 'PENDING';
    if (st === 'DONE' || st === 'SKIPPED') continue;
    if (key === 'SEND_INVITE' && !ctx.hasRawToken) return { action: 'RUN_STEP', step: 'CREATE_CLAIM_LINK' };
    return { action: 'RUN_STEP', step: key };
  }
  return { action: 'COMPLETE' };
}

/** Seconds to wait after the nth failure (1-based): the schedule entry, the last one repeating, plus or minus 20 percent. */
export function backoffSeconds(failureNumber: number, schedule: readonly number[], random: () => number): number {
  const base = schedule.length === 0 ? 60 : schedule[Math.min(Math.max(failureNumber, 1), schedule.length) - 1];
  return Math.round(base * (0.8 + 0.4 * random()));
}

export interface FailureOutcome { status: 'WAITING' | 'FAILED'; attempt: number; nextRunAt: Date | null }

/** What the job becomes after a step failed. `job.attempt` counts failures so far. */
export function onFailure(job: { attempt: number; maxAttempts: number }, err: { retryable: boolean }, now: Date, schedule: readonly number[], random: () => number): FailureOutcome {
  const attempt = job.attempt + 1;
  if (!err.retryable || attempt >= job.maxAttempts) return { status: 'FAILED', attempt, nextRunAt: null };
  return { status: 'WAITING', attempt, nextRunAt: new Date(now.getTime() + backoffSeconds(attempt, schedule, random) * 1000) };
}

export const canRetry = (status: JobStatus): boolean => status === 'FAILED';

export function canCancel(job: { status: JobStatus; lockedUntil: Date | null }, now: Date): boolean {
  if (job.status === 'QUEUED' || job.status === 'WAITING' || job.status === 'FAILED') return true;
  return job.status === 'RUNNING' && job.lockedUntil !== null && job.lockedUntil.getTime() < now.getTime();
}

/** The steps a cancel marks SKIPPED: every step that is not DONE. Completed steps are never touched or rolled back. */
export function cancelPlan(steps: readonly StepState[]): StepKey[] {
  return STEP_ORDER.filter((k) => {
    const st = steps.find((s) => s.stepKey === k)?.status ?? 'PENDING';
    return st !== 'DONE' && st !== 'SKIPPED';
  });
}
