import { ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { directoryError } from '../../directory/directory.errors';
import { DirectoryRepository } from '../../directory/directory.repository';
import { assertMailEnabled, MAIL_ENABLED, MailEnabled } from '../../v3-mail/mail-enabled';
import { ClaimOtpService } from './claim-otp.service';
import { ClaimsService } from './claims.service';

export type StartChannel = 'EMAIL' | 'SMS';
export interface ClaimStartResult { token: string; channel: StartChannel; message: string }

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The one answer for every listing that cannot be claimed from here: unknown, still a draft, suspended, removed, already claimed, or one with no business record behind it. */
const notClaimable = (): ConflictException => new ConflictException(directoryError('DIRECTORY_STATE_INVALID', 'This business cannot be claimed from here.'));

/**
 * Start a claim from a listing (Wave 2, public site gap G1). The public site sends the business slug; this finds the listing, issues the claim link, asks for the code through the existing claim OTP
 * (by email, through the mail port, kind OTP) and answers the claim token that then drives `status`, `otp/request` and `otp/verify`. The code itself goes ONLY to the address on the record, never to one
 * the caller types, so the token alone proves nothing and is safe to hand to an unauthenticated caller. With the mail switch OFF and the email channel asked for, the answer is the registered
 * MAIL_DISABLED (503), decided before the listing is looked up so it tells nothing about any listing.
 */
@Injectable()
export class ClaimStartService {
  constructor(
    private readonly repo: DirectoryRepository, private readonly claims: ClaimsService, private readonly otp: ClaimOtpService,
    @Optional() @Inject(MAIL_ENABLED) private readonly mailEnabled?: MailEnabled,
  ) {}

  async start(businessSlug: string, channel: StartChannel, ip: string | null): Promise<ClaimStartResult> {
    if (channel === 'EMAIL') assertMailEnabled(this.mailEnabled);
    const slug = String(businessSlug ?? '').trim().toLowerCase();
    const biz = slug.length <= 160 && SLUG.test(slug) ? await this.repo.getBusinessBySlug(slug) : null;
    if (!biz || biz.status !== 'UNCLAIMED' || !biz.vendorId) throw notClaimable();
    let token: string;
    try { ({ token } = await this.claims.issueForPublicStart(biz.vendorId, ip)); } catch { throw notClaimable(); }   // a business that was claimed a moment ago looks like any other
    const sent = await this.otp.request(token, ip, channel);
    return { token, channel, message: sent.message };
  }
}
