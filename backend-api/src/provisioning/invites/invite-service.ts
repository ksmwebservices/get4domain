import { EmailService } from '../../email/email.service';
import { ClaimStore } from '../claims/claim-store';
import { hashToken } from '../claims/token';
import { StepError } from '../provisioning.errors';
import { ProvisioningSettings } from '../settings/provisioning-settings';
import { selectEmailAdapter } from './email-adapter';
import { InviteStore } from './invite-store';
import { renderInvite } from './invite-renderer';

export interface InviteDeps {
  claims: ClaimStore;
  invites: InviteStore;
  mail: Pick<EmailService, 'sendPlainText'>;
  env?: Record<string, string | undefined>;
}
export interface DeliverArgs { vendorId: string; businessName: string; toAddress: string; rawToken: string; settings: ProvisioningSettings; now: Date }

/**
 * Sends one invite for one claim token. Shared by the SEND_INVITE step and by staff "reissue", so both obey the same rules:
 * one invite row per token (a SENT invite is never sent again; a retry reuses the row), a masked preview always, the full message only in sandbox mode,
 * and the adapter chosen by the plan setting (live is guarded OFF).
 */
export async function deliverInvite(deps: InviteDeps, a: DeliverArgs): Promise<{ inviteId: string }> {
  const token = await deps.claims.findByHash(hashToken(a.rawToken));
  if (!token || token.vendorId !== a.vendorId || token.status !== 'ACTIVE') throw new StepError('UNEXPECTED', true);

  let invite = await deps.invites.findByToken(token.id);
  if (invite?.status === 'SENT') return { inviteId: invite.id };

  const mode = a.settings.inviteAdapterMode;
  const msg = renderInvite(a.settings, { businessName: a.businessName, rawToken: a.rawToken });
  if (!invite) {
    invite = await deps.invites.create({
      vendorId: a.vendorId, channel: 'EMAIL', toAddress: a.toAddress, claimTokenId: token.id, adapterMode: mode === 'live' ? 'LIVE' : 'SANDBOX',
      subject: msg.subject, bodyPreview: msg.preview, sandboxBody: mode === 'live' ? null : msg.text,
    });
  }
  try {
    const sent = await selectEmailAdapter(mode, deps.mail, deps.env).send({ to: a.toAddress, subject: msg.subject, text: msg.text });
    await deps.invites.markSent(invite.id, sent.providerMessageId, a.now);
  } catch (e) {
    await deps.invites.markFailed(invite.id);
    throw e;
  }
  return { inviteId: invite.id };
}
