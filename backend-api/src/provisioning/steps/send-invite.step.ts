import { Inject, Injectable, Optional } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { ClaimStore } from '../claims/claim-store';
import { hashToken } from '../claims/token';
import { selectEmailAdapter } from '../invites/email-adapter';
import { InviteStore } from '../invites/invite-store';
import { renderInvite } from '../invites/invite-renderer';
import { StepError } from '../provisioning.errors';
import { ProvisioningStep, StepContext, StepResult } from '../runner/job-runner.service';
import { parseBusinessInput } from './business-input';

export const INVITE_ENV = Symbol('INVITE_ENV');

/**
 * Step 5. Renders the invite from the owner-editable templates and sends it through the EmailAdapter in the configured mode.
 * One invite row per claim token: a SENT invite is never sent again, and a retry after a failure reuses the same row.
 * Stored: subject, a body preview with the token masked, and (sandbox only) the full message. Live mode stores no body at all.
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
    const raw = ctx.rawToken;
    if (raw === undefined) throw new StepError('UNEXPECTED', true);   // the runner normally issues a new link first; retry
    const token = await this.claims.findByHash(hashToken(raw));
    if (!token || token.vendorId !== ctx.vendorId || token.status !== 'ACTIVE') throw new StepError('UNEXPECTED', true);

    let invite = await this.invites.findByToken(token.id);
    if (invite?.status === 'SENT') return { outputRef: { inviteId: invite.id } };

    const mode = ctx.settings.inviteAdapterMode;
    const msg = renderInvite(ctx.settings, { businessName: biz.businessName, rawToken: raw });
    if (!invite) {
      invite = await this.invites.create({
        vendorId: ctx.vendorId, channel: 'EMAIL', toAddress: biz.email, claimTokenId: token.id, adapterMode: mode === 'live' ? 'LIVE' : 'SANDBOX',
        subject: msg.subject, bodyPreview: msg.preview, sandboxBody: mode === 'live' ? null : msg.text,
      });
    }
    try {
      const sent = await selectEmailAdapter(mode, this.mail, this.env).send({ to: biz.email, subject: msg.subject, text: msg.text });
      await this.invites.markSent(invite.id, sent.providerMessageId, ctx.now);
    } catch (e) {
      await this.invites.markFailed(invite.id);
      throw e;
    }
    return { outputRef: { inviteId: invite.id } };
  }
}
