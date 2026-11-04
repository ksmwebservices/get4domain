import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { unknownVendor } from '../../plans/admin/plans-admin.common';
import { Actor } from '../../plans/admin/audit.service';
import { InviteStore } from '../invites/invite-store';
import { deliverInvite } from '../invites/invite-service';
import { ProvisioningAudit } from '../runner/job-runner.service';
import { ProvisioningSettingsService } from '../settings/provisioning-settings.service';
import { INVITE_ENV } from '../steps/send-invite.step';
import { ClaimStore } from './claim-store';
import { generateToken, hashToken, hashesEqual } from './token';

/** The one answer for every token that cannot be used: unknown, malformed, used, revoked, expired. Same status, same body, so nothing can be learned from it. */
const invalidPublic = (): NotFoundException => new NotFoundException({ message: 'This link is not valid.', code: 'CLAIM_INVALID' });

/** The address the existing staff site-creation code gives a site that has no owner yet (site+<sub>@sites.get4domain.invalid). Only this exact placeholder domain is refused: other addresses, including synthetic test ones, are real as far as reissue is concerned. */
const PLACEHOLDER_OWNER_DOMAIN = '@sites.get4domain.invalid';
export const isPlaceholderOwnerEmail = (email: string): boolean => email.trim().toLowerCase().endsWith(PLACEHOLDER_OWNER_DOMAIN);

export interface ClaimStatus { valid: true; businessName: string; expiresAt: string }

/**
 * Claim links after they are issued: checking one, using one up, and the two staff actions (revoke, reissue).
 * It creates no account and sets no password: `redeemClaim` only marks the token used and says which business it belonged to; slice 5.7 (phone OTP,
 * password) calls it. Raw tokens are hashed on the way in and never logged, audited or returned.
 */
@Injectable()
export class ClaimsService {
  /** overridable in tests */
  clock: () => Date = () => new Date();

  constructor(
    private readonly claims: ClaimStore,
    private readonly invites: InviteStore,
    private readonly settings: ProvisioningSettingsService,
    private readonly audit: ProvisioningAudit,
    private readonly mail: EmailService,
    @Optional() @Inject(INVITE_ENV) private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  /** The token's row when it is ACTIVE and not expired; null for anything else (an expired ACTIVE token is marked EXPIRED on the way). */
  private async usable(rawToken: string) {
    const presented = hashToken(String(rawToken).slice(0, 200));   // always hash and look up, so a malformed token costs the same as a well-formed one
    const row = await this.claims.findByHash(presented);
    if (!row || !hashesEqual(row.tokenHash, presented)) return null;
    if (row.status !== 'ACTIVE') return null;
    if (row.expiresAt.getTime() <= this.clock().getTime()) { await this.claims.markExpired(row.id); return null; }
    return row;
  }

  /** The claim link's identity if it is usable right now, WITHOUT using it up (slice 5.7: the OTP check comes before the link is redeemed). */
  async peek(rawToken: string): Promise<{ tokenId: string; vendorId: string; businessName: string } | null> {
    const row = await this.usable(rawToken);
    return row ? { tokenId: row.id, vendorId: row.vendorId, businessName: row.businessName } : null;
  }

  async status(rawToken: string): Promise<ClaimStatus> {
    const row = await this.usable(rawToken);
    if (!row) throw invalidPublic();
    return { valid: true, businessName: row.businessName, expiresAt: row.expiresAt.toISOString() };
  }

  /** Marks the token USED exactly once (race safe). Everything that is not a usable token throws CLAIM_INVALID. */
  async redeemClaim(rawToken: string): Promise<{ vendorId: string }> {
    const row = await this.usable(rawToken);
    if (!row || !(await this.claims.markUsed(row.id, this.clock()))) throw invalidPublic();
    await this.audit.record({ type: 'SYSTEM', id: null, ip: null }, 'claim.redeemed', 'claim_token', row.id, { vendorId: row.vendorId });
    return { vendorId: row.vendorId };
  }

  async revoke(vendorId: string, actor: Actor): Promise<{ revoked: number }> {
    const revoked = await this.claims.revokeActive(vendorId);
    await this.audit.record(actor, 'claim.revoke', 'vendor', vendorId, { revoked });
    return { revoked };
  }

  /**
   * Slice 5.13a: a SEEDED business has no owner email, so nothing is emailed. Staff get the claim link ONCE in the response and hand it to the owner themselves (read out on a call, or sent
   * by the staff member). The link is hashed in the database and is never logged or audited; the old link stops working. The caller has already checked consent and the register.
   */
  async issueForHandover(vendorId: string, actor: Actor): Promise<{ claimTokenId: string; expiresAt: string; claimUrl: string }> {
    const vendor = await this.claims.vendorContact(vendorId);
    if (!vendor) throw unknownVendor();
    if (await this.claims.hasUsedToken(vendorId)) throw new ConflictException({ message: 'This business has already been claimed.', code: 'CLAIM_INVALID' });
    const settings = await this.settings.get();
    const rawToken = generateToken();
    const expiresAt = new Date(this.clock().getTime() + settings.claimLinkExpiryDays * 86_400_000);
    const { id } = await this.claims.issue({ vendorId, tokenHash: hashToken(rawToken), expiresAt, actor });
    await this.audit.record(actor, 'claim.handover', 'vendor', vendorId, { claimTokenId: id });
    return { claimTokenId: id, expiresAt: expiresAt.toISOString(), claimUrl: `${settings.publicAppUrl.replace(/\/+$/, '')}/claim/${rawToken}` };
  }

  /** Staff: a new link (the old one stops working) and a new invite to the business's owner email. */
  async reissue(vendorId: string, actor: Actor): Promise<{ claimTokenId: string; inviteId: string; expiresAt: string }> {
    const vendor = await this.claims.vendorContact(vendorId);
    if (!vendor) throw unknownVendor();
    if (await this.claims.hasUsedToken(vendorId)) throw new ConflictException({ message: 'This business has already been claimed.', code: 'CLAIM_INVALID' });
    if (isPlaceholderOwnerEmail(vendor.email)) throw new BadRequestException('This business has no owner email address to send the link to.');

    const settings = await this.settings.get();
    const now = this.clock();
    const rawToken = generateToken();
    const expiresAt = new Date(now.getTime() + settings.claimLinkExpiryDays * 86_400_000);
    const { id } = await this.claims.issue({ vendorId, tokenHash: hashToken(rawToken), expiresAt, actor });
    const { inviteId } = await deliverInvite(
      { claims: this.claims, invites: this.invites, mail: this.mail, env: this.env },
      { vendorId, businessName: vendor.businessName, toAddress: vendor.email, rawToken, settings, now },
    );
    await this.audit.record(actor, 'claim.reissue', 'vendor', vendorId, { claimTokenId: id, inviteId });
    return { claimTokenId: id, inviteId, expiresAt: expiresAt.toISOString() };
  }
}
