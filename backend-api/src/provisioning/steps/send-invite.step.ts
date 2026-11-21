import { Inject, Injectable, Optional } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { ClaimStore } from '../claims/claim-store';
import { deliverInvite } from '../invites/invite-service';
import { InviteStore } from '../invites/invite-store';
import { StepError } from '../provisioning.errors';
import { ProvisioningStep, StepContext, StepResult } from '../runner/job-runner.service';
import { parseBusinessInput } from './business-input';

export const INVITE_ENV = Symbol('INVITE_ENV');

/**
 * Step 5. Renders the invite from the owner-editable templates and sends it through the EmailAdapter in the configured mode (see invite-service.ts for
 * the rules: one invite row per claim token, masked preview, the full message in sandbox mode only, live guarded OFF).
 */
@Injectable()
export class SendInviteStep implements ProvisioningStep {
  readonly key = 'SEND_INVITE' as const;
  constructor(
    private readonly claims: ClaimStore,
    private readonly invites: InviteStore,
    private readonly mail: EmailService,
    @Optional() @Inject(INVITE_ENV) private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  async run(ctx: StepContext): Promise<StepResult> {
    if (!ctx.vendorId) throw new StepError('UNKNOWN_VENDOR', false);
    const biz = parseBusinessInput(ctx.input);   // permanent INVALID_INPUT before anything is written
    if (ctx.rawToken === undefined) throw new StepError('UNEXPECTED', true);   // the runner normally issues a new link first; retry
    const { inviteId } = await deliverInvite(
      { claims: this.claims, invites: this.invites, mail: this.mail, env: this.env },
      { vendorId: ctx.vendorId, businessName: biz.businessName, toAddress: biz.email, rawToken: ctx.rawToken, settings: ctx.settings, now: ctx.now },
    );
    return { outputRef: { inviteId } };
  }
}
