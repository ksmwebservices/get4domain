import { Injectable } from '@nestjs/common';
import { ClaimStore } from '../claims/claim-store';
import { generateToken, hashToken } from '../claims/token';
import { StepError } from '../provisioning.errors';
import { ProvisioningStep, StepContext, StepResult } from '../runner/job-runner.service';

/**
 * Step 4. Issues a claim token: 32 random bytes, only the SHA-256 stored, expiry from claimLinkExpiryDays, the previous ACTIVE token revoked in the same
 * transaction. The raw token is returned to the runner in memory for SEND_INVITE and appears in no stored result (outputRef holds the token's row id only).
 * If the process dies before SEND_INVITE the raw token is gone; the runner issues a new link on the retry (state machine rule).
 */
@Injectable()
export class CreateClaimLinkStep implements ProvisioningStep {
  readonly key = 'CREATE_CLAIM_LINK' as const;
  constructor(private readonly claims: ClaimStore) {}

  async run(ctx: StepContext): Promise<StepResult> {
    if (!ctx.vendorId) throw new StepError('UNKNOWN_VENDOR', false);
    const rawToken = generateToken();
    const { id } = await this.claims.issue({
      vendorId: ctx.vendorId, tokenHash: hashToken(rawToken), expiresAt: new Date(ctx.now.getTime() + ctx.settings.claimLinkExpiryDays * 86_400_000), actor: ctx.actor,
    });
    return { rawToken, outputRef: { claimTokenId: id } };
  }
}
