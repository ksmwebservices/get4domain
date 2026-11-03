import { InviteRow } from '../invites/invite-store';
import { JobRow, StepRow } from '../provisioning.repository';

/** g***@e***.com: the first letter of the name and of the domain, and the ending. Staff can tell addresses apart; a leaked list is useless. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return '***';
  const domain = email.slice(at + 1);
  const dot = domain.indexOf('.');
  return `${email[0]}***@${domain[0]}***${dot > 0 ? domain.slice(dot) : ''}`;
}

/** What staff see of a job. No lock holder, no idempotency key internals beyond the key they sent. */
export function presentJob(j: JobRow, withInput = false) {
  return {
    id: j.id, kind: j.kind, status: j.status, vendorId: j.vendorId, currentStep: j.currentStep, attempt: j.attempt, maxAttempts: j.maxAttempts,
    nextRunAt: j.nextRunAt.toISOString(), lastErrorCode: j.lastErrorCode, lastErrorMessage: j.lastErrorMessage,
    createdByType: j.createdByType, createdById: j.createdById, createdAt: j.createdAt.toISOString(), updatedAt: j.updatedAt.toISOString(), finishedAt: j.finishedAt?.toISOString() ?? null,
    ...(withInput ? { input: j.input } : {}),
  };
}

export const presentStep = (s: StepRow) => ({
  stepKey: s.stepKey, status: s.status, attempts: s.attempts, startedAt: s.startedAt?.toISOString() ?? null, finishedAt: s.finishedAt?.toISOString() ?? null,
  outputRef: s.outputRef, errorCode: s.errorCode,
});

/** `showSandboxBody`: staging only (see ProvisioningAdminService). A live invite never has a body to show. */
export function presentInvite(i: InviteRow, showSandboxBody: boolean) {
  return {
    id: i.id, vendorId: i.vendorId, channel: i.channel, toAddress: maskEmail(i.toAddress), adapterMode: i.adapterMode, status: i.status, subject: i.subject,
    bodyPreview: i.bodyPreview, providerMessageId: i.providerMessageId, sentAt: i.sentAt?.toISOString() ?? null, createdAt: i.createdAt.toISOString(),
    ...(showSandboxBody && i.adapterMode === 'SANDBOX' && i.sandboxBody ? { sandboxBody: i.sandboxBody } : {}),
  };
}
