import { PrismaClient } from '@prisma/client';

/** Timing visibility for the staging provisioning tests (test code only). Written to stderr so it shows even without --verbose. */
const say = (line: string): void => { process.stderr.write(`[timing] ${line}\n`); };

/** Time one async step and say how long it took, e.g. how long the Nest test app takes to boot. */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try { return await fn(); } finally { say(`${label}: ${Date.now() - t0} ms`); }
}

/** Per-step durations of a job from g4d_provisioning_steps (finishedAt - startedAt), plus the wall time of the whole run call. */
export async function logJobTimings(prisma: PrismaClient, jobId: string, wallMs: number): Promise<void> {
  try {
    const steps = await prisma.v3ProvisioningStep.findMany({ where: { jobId }, orderBy: { createdAt: 'asc' } });
    const parts = steps.map((s) => `${s.stepKey}=${s.startedAt && s.finishedAt ? s.finishedAt.getTime() - s.startedAt.getTime() : '-'}ms(x${s.attempts})`);
    say(`job ${jobId.slice(0, 8)} run call ${wallMs} ms | ${parts.join(' ')}`);
  } catch { say(`job ${jobId.slice(0, 8)} run call ${wallMs} ms | step times unavailable`); }
}
