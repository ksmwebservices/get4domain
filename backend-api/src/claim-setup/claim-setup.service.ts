import { BadRequestException, ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DirectoryAudit } from '../directory/directory-audit';
import { directoryError } from '../directory/directory.errors';
import { DirectoryRepository } from '../directory/directory.repository';
import { AccountSetupGrantService } from '../directory/grants/account-setup-grant.service';
import { isPlaceholderOwnerEmail } from '../provisioning/claims/claims.service';
import { normaliseEmail } from '../provisioning/steps/business-input';
import { TermsService } from '../terms/terms.service';
import { ClaimAccountStore } from './claim-account.store';
import { SiteGoLivePort } from './site-go-live.port';

export interface SetupInput { setupToken: string; password: string; acceptTerms: boolean; email?: string }
export interface SetupContext { ip: string | null; userAgent: string | null }
export interface SetupResult { vendorId: string; loginEmail: string; passwordSet: true; termsAccepted: true; next: 'LOGIN' }
export interface ApproveResult { state: 'LIVE'; alreadyLive: boolean; publicationId: string; version: number }

/**
 * The two steps after a claim code is verified (Amendment 13 B3 and B7):
 *  1. `setup` redeems the single-use account-setup grant that code verification returned: the owner accepts the current Terms and policy versions, chooses a password (and, for a business made on its behalf
 *     that has no real email address, the email to log in with). Everything that can be wrong is checked BEFORE the grant is spent, so a mistake leaves it usable. A bad, used or expired grant is the same 404.
 *  2. `approve` is the owner (signed in) saying "publish my site": the business must be claimed and the required documents accepted; the site is built and published on its subdomain through the go-live port.
 * No timeframe, price or amount is decided here; the grant's life comes from the directory settings.
 */
@Injectable()
export class ClaimSetupService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly grants: AccountSetupGrantService, private readonly repo: DirectoryRepository, private readonly audit: DirectoryAudit, private readonly site: SiteGoLivePort, private readonly accounts: ClaimAccountStore,
    @Optional() @Inject(TermsService) private readonly terms?: Pick<TermsService, 'acceptanceRequired'>,
  ) {}

  async setup(i: SetupInput, ctx: SetupContext): Promise<SetupResult> {
    const token = String(i.setupToken ?? '').slice(0, 200);
    const peek = await this.grants.peek(token);   // uniform 404 for anything that is not a usable grant, before any other check can leak
    if (i.acceptTerms !== true) throw new BadRequestException(directoryError('CLAIM_TERMS_REQUIRED', 'Please accept the Terms and the policies to continue.'));
    const vendor = await this.repo.vendorBasics(peek.vendorId);
    if (!vendor) throw new BadRequestException(directoryError('GRANT_INVALID', 'This link is not valid.'));
    let email = vendor.email;
    if (isPlaceholderOwnerEmail(vendor.email)) {
      const given = typeof i.email === 'string' ? normaliseEmail(i.email) : null;
      if (!given) throw new BadRequestException(directoryError('CLAIM_EMAIL_REQUIRED', 'Please give the email address you will log in with.'));
      const taken = await this.accounts.vendorIdByEmail(given);
      if (taken && taken !== vendor.id) throw new ConflictException(directoryError('CLAIM_EMAIL_TAKEN', 'That email address is already used for another account.'));
      email = given;
    }
    const hash = await bcrypt.hash(i.password, 10);   // the same cost as the registration path; this module does not call it, so the legacy auth code is not touched
    // the grant is spent here, and only here: the terms are recorded in the same call, and a refusal of the terms leaves the grant usable
    const { vendorId } = await this.grants.consume(token, { acceptTerms: true, ip: ctx.ip, userAgent: ctx.userAgent });
    await this.accounts.setCredentials(vendorId, { passwordHash: hash, email: email === vendor.email ? null : email, at: this.clock() });
    await this.audit.record({ type: 'SYSTEM', id: null, ip: ctx.ip }, 'claim.account_setup', 'vendor', vendorId, null, { emailChanged: email !== vendor.email });
    return { vendorId, loginEmail: email, passwordSet: true, termsAccepted: true, next: 'LOGIN' };
  }

  /** The owner approves the site: it is built and published. Repeating it when the site is already live changes nothing. */
  async approve(vendorId: string, actor: { type: 'VENDOR'; id: string | null; ip: string | null }): Promise<ApproveResult> {
    const biz = await this.repo.getBusinessByVendor(vendorId);
    if (!biz || biz.status !== 'CLAIMED') throw new ConflictException(directoryError('CLAIM_NOT_CLAIMED', 'This business has not been claimed yet.'));
    if (this.terms && (await this.terms.acceptanceRequired(vendorId))) throw new ConflictException(directoryError('CLAIM_TERMS_REQUIRED', 'Please accept the current Terms and policies first.'));
    const live = await this.site.current(vendorId);
    if (live) return { state: 'LIVE', alreadyLive: true, publicationId: live.publicationId, version: live.version };
    let published: { publicationId: string; version: number };
    try { published = await this.site.buildAndPublish(vendorId, actor); }
    catch (e) { if ((e as { getStatus?: () => number }).getStatus) throw e; throw new ConflictException(directoryError('CLAIM_GO_LIVE_UNAVAILABLE', 'The site could not be published right now. Please try again.')); }
    await this.audit.record({ type: 'VENDOR', id: actor.id, ip: actor.ip }, 'claim.approved', 'vendor', vendorId, null, { publicationId: published.publicationId, version: published.version });
    return { state: 'LIVE', alreadyLive: false, ...published };
  }
}
