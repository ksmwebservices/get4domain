import { STEP_ORDER, backoffSeconds, canCancel, canRetry, cancelPlan, decide, onFailure } from '../src/provisioning/core/state-machine';
import { StepError, classifyError, sanitisedMessage } from '../src/provisioning/provisioning.errors';

/** S53.3: the pure core. No database, no clock, no randomness of its own. */
const steps = (done: number, extra: Record<string, string> = {}) => STEP_ORDER.map((stepKey, i) => ({ stepKey, status: (extra[stepKey] ?? (i < done ? 'DONE' : 'PENDING')) as 'DONE' | 'PENDING' | 'FAILED' | 'SKIPPED' | 'RUNNING' }));

describe('decide()', () => {
  it('runs the first step that is not done', () => {
    expect(decide(steps(0), { hasRawToken: false })).toEqual({ action: 'RUN_STEP', step: 'CREATE_VENDOR' });
    expect(decide(steps(2), { hasRawToken: false })).toEqual({ action: 'RUN_STEP', step: 'CREATE_FREE_SITE_DRAFT' });
  });
  it('completes when every step is done', () => {
    expect(decide(steps(5), { hasRawToken: false })).toEqual({ action: 'COMPLETE' });
  });
  it('a FAILED step is run again (retry), a SKIPPED step is ignored', () => {
    expect(decide(steps(1, { ASSIGN_FREE_PLAN: 'FAILED' }), { hasRawToken: false })).toEqual({ action: 'RUN_STEP', step: 'ASSIGN_FREE_PLAN' });
    expect(decide(steps(0, { CREATE_VENDOR: 'DONE', ASSIGN_FREE_PLAN: 'SKIPPED', CREATE_FREE_SITE_DRAFT: 'SKIPPED', CREATE_CLAIM_LINK: 'SKIPPED', SEND_INVITE: 'SKIPPED' }), { hasRawToken: false })).toEqual({ action: 'COMPLETE' });
  });
  it('the raw claim token only lives in memory: SEND_INVITE without it first issues the link again', () => {
    expect(decide(steps(4), { hasRawToken: false })).toEqual({ action: 'RUN_STEP', step: 'CREATE_CLAIM_LINK' });
    expect(decide(steps(4), { hasRawToken: true })).toEqual({ action: 'RUN_STEP', step: 'SEND_INVITE' });
    expect(decide(steps(3), { hasRawToken: false })).toEqual({ action: 'RUN_STEP', step: 'CREATE_CLAIM_LINK' });
  });
  it('a finished invite never asks for the link again', () => {
    expect(decide(steps(5), { hasRawToken: false })).toEqual({ action: 'COMPLETE' });
  });
});

describe('backoffSeconds()', () => {
  const sched = [30, 120, 600, 1800];
  it('uses the schedule entry for the failure number, repeating the last one', () => {
    expect(backoffSeconds(1, sched, () => 0.5)).toBe(30);
    expect(backoffSeconds(2, sched, () => 0.5)).toBe(120);
    expect(backoffSeconds(4, sched, () => 0.5)).toBe(1800);
    expect(backoffSeconds(9, sched, () => 0.5)).toBe(1800);
  });
  it('jitter stays within plus or minus 20 percent', () => {
    expect(backoffSeconds(3, sched, () => 0)).toBe(480);
    expect(backoffSeconds(3, sched, () => 0.999999)).toBeLessThanOrEqual(720);
    expect(backoffSeconds(3, sched, () => 0.999999)).toBeGreaterThan(700);
  });
  it('an empty schedule falls back to 60 seconds', () => { expect(backoffSeconds(1, [], () => 0.5)).toBe(60); });
});

describe('onFailure()', () => {
  const now = new Date('2026-11-04T10:00:00Z');
  const sched = [30, 120];
  it('a retryable failure waits, with the next run time in the future', () => {
    const r = onFailure({ attempt: 0, maxAttempts: 5 }, { retryable: true }, now, sched, () => 0.5);
    expect(r).toEqual({ status: 'WAITING', attempt: 1, nextRunAt: new Date(now.getTime() + 30_000) });
  });
  it('a permanent failure is FAILED at once', () => {
    expect(onFailure({ attempt: 0, maxAttempts: 5 }, { retryable: false }, now, sched, () => 0.5)).toEqual({ status: 'FAILED', attempt: 1, nextRunAt: null });
  });
  it('the last allowed attempt fails the job', () => {
    expect(onFailure({ attempt: 4, maxAttempts: 5 }, { retryable: true }, now, sched, () => 0.5).status).toBe('FAILED');
    expect(onFailure({ attempt: 3, maxAttempts: 5 }, { retryable: true }, now, sched, () => 0.5).status).toBe('WAITING');
  });
});

describe('retry and cancel rules', () => {
  it('only a FAILED job can be retried', () => {
    expect(canRetry('FAILED')).toBe(true);
    for (const s of ['QUEUED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'CANCELLED']) expect(canRetry(s as never)).toBe(false);
  });
  it('QUEUED, WAITING and FAILED can be cancelled; a RUNNING one only after its lease has lapsed', () => {
    const now = new Date('2026-11-04T10:00:00Z');
    for (const s of ['QUEUED', 'WAITING', 'FAILED']) expect(canCancel({ status: s as never, lockedUntil: null }, now)).toBe(true);
    expect(canCancel({ status: 'RUNNING', lockedUntil: new Date(now.getTime() + 1000) }, now)).toBe(false);
    expect(canCancel({ status: 'RUNNING', lockedUntil: new Date(now.getTime() - 1000) }, now)).toBe(true);
    expect(canCancel({ status: 'SUCCEEDED', lockedUntil: null }, now)).toBe(false);
    expect(canCancel({ status: 'CANCELLED', lockedUntil: null }, now)).toBe(false);
  });
  it('cancelPlan skips every step that is not done and never touches a done one', () => {
    expect(cancelPlan(steps(2, { CREATE_FREE_SITE_DRAFT: 'FAILED' }))).toEqual(['CREATE_FREE_SITE_DRAFT', 'CREATE_CLAIM_LINK', 'SEND_INVITE']);
    expect(cancelPlan(steps(5))).toEqual([]);
  });
});

describe('error classification', () => {
  it('a StepError keeps its code and retryability', () => {
    expect(classifyError(new StepError('DUPLICATE_BUSINESS', false))).toEqual({ code: 'DUPLICATE_BUSINESS', retryable: false });
    expect(classifyError(new StepError('ADAPTER_TIMEOUT', true))).toEqual({ code: 'ADAPTER_TIMEOUT', retryable: true });
  });
  it('database connectivity errors are retryable DB_BUSY', () => {
    const e = Object.assign(new Error('Can not reach database server at db.example:5432 with password=hunter2'), { code: 'P1001' });
    expect(classifyError(e)).toEqual({ code: 'DB_BUSY', retryable: true });
  });
  it('anything else is a retryable UNEXPECTED (until attempts run out)', () => {
    expect(classifyError(new Error('boom'))).toEqual({ code: 'UNEXPECTED', retryable: true });
    expect(classifyError('a string')).toEqual({ code: 'UNEXPECTED', retryable: true });
  });
  it('the stored message is a fixed sentence per code and never contains the original error text', () => {
    const raw = 'Resend said: invalid api key re_SECRET123';
    expect(sanitisedMessage(classifyError(new Error(raw)).code)).not.toContain('re_SECRET123');
    expect(sanitisedMessage('DUPLICATE_BUSINESS')).toMatch(/already/i);
    expect(sanitisedMessage('NOT_A_CODE')).toBe(sanitisedMessage('UNEXPECTED'));
  });
});
