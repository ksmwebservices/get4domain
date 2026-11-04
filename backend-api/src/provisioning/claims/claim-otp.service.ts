import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import { canResend, evaluateAttempt, generateOtp, hashCode, hashPhone, normalisePhoneE164, verifyCodeHash } from '../../directory/core/otp';
import { maskPhone } from '../../directory/core/masking';
import { DirectoryAdminService } from '../../directory/directory-admin.service';
import { DirectoryAudit } from '../../directory/directory-audit';
import { directoryError, OTP_INVALID_MESSAGE, OTP_SENT_MESSAGE } from '../../directory/directory.errors';
import { DirectoryRepository } from '../../directory/directory.repository';
import { AccountSetupGrantService } from '../../directory/grants/account-setup-grant.service';
import { OtpPepper } from '../../directory/pepper';
import { DirectorySettingsService } from '../../directory/settings/directory-settings.service';
import { SmsAdapter } from '../../directory/sms/sms-adapter';
import { ClaimsService } from './claims.service';

const invalid = (): BadRequestException => new BadRequestException(directoryError('OTP_INVALID', OTP_INVALID_MESSAGE));
export interface OtpRequestResult { sent: true; message: string }
export interface OtpVerifyResult { claimed: true; vendorId: string; setupToken: string; setupTokenExpiresAt: string }

/**
 * Claim by phone OTP (slice 5.7, completes the slice 5.3 claim link). The code goes to the phone on the business record; a different phone needs a staff override.
 * Everything a stranger can call is uniform: request ALWAYS says the same thing (whether or not the link or a phone exists, a limit was hit, or a message was sent), and every failure
 * of verify is the same 400. A correct code redeems the claim link exactly once (compare-and-set on the challenge, atomic mark on the link), marks the business CLAIMED and
 * hands back a short-lived single-use account-setup grant; NO password is set here.
 */
@Injectable()
export class ClaimOtpService {
  clock: () => Date = () => new Date();
  random: (min: number, max: number) => number = (min, max) => randomInt(min, max);
  salt: () => string = () => randomBytes(16).toString('hex');

  constructor(
    private readonly claims: ClaimsService, private readonly repo: DirectoryRepository, @Inject(DirectorySettingsService) private readonly settings: Pick<DirectorySettingsService, 'get'>, private readonly sms: SmsAdapter,
    private readonly grants: AccountSetupGrantService, @Inject(DirectoryAdminService) private readonly admin: Pick<DirectoryAdminService, 'indexableFor'>, private readonly audit: DirectoryAudit, private readonly pepper: OtpPepper,
  ) {}

  private readonly sent: OtpRequestResult = { sent: true, message: OTP_SENT_MESSAGE };

  /** The phone the code goes to: a staff override if there is one, else the business record, else the vendor's registered phone. */
  private async targetPhone(vendorId: string): Promise<{ phone: string | null; businessId: string | null }> {
    const biz = await this.repo.getBusinessByVendor(vendorId);
    if (biz) {
      const o = await this.repo.latestOverride(biz.id);
      if (o) return { phone: o.phoneE164, businessId: biz.id };
      if (biz.phoneE164) return { phone: biz.phoneE164, businessId: biz.id };
    }
    const v = await this.repo.vendorBasics(vendorId);
    return { phone: v?.phone ? normalisePhoneE164(v.phone) : null, businessId: biz?.id ?? null };
  }

  async request(rawToken: string, ip: string | null): Promise<OtpRequestResult> {
    const claim = await this.claims.peek(rawToken);
    if (!claim) { hashCode('000000', 'x', this.pepper.value()); return this.sent; }   // a bad link costs about the same as a good one
    const { phone } = await this.targetPhone(claim.vendorId);
    if (!phone) return this.sent;
    const s = await this.settings.get(); const now = this.clock(); const pepper = this.pepper.value();
    const phoneHash = hashPhone(phone, pepper); const ipHash = this.pepper.hashIp(ip);
    const hourAgo = new Date(now.getTime() - 3_600_000);
    const last = await this.repo.latestChallenge('CLAIM', claim.tokenId);
    if (last && !canResend(last.createdAt, now, s.otpResendCooldownSeconds)) return this.sent;
    if ((await this.repo.countChallengesSince({ phoneHash }, hourAgo)) >= s.otpMaxPerPhonePerHour) return this.sent;
    if (ipHash && (await this.repo.countChallengesSince({ ipHash }, hourAgo)) >= s.otpMaxPerIpPerHour) return this.sent;

    const code = generateOtp(this.random); const salt = this.salt();
    const sandbox = await this.sms.isSandbox();
    const body = `Your Get4Domain code is ${code}. It expires in ${s.otpExpiryMinutes} minutes. Do not share it.`;
    await this.repo.revokePendingChallenges('CLAIM', claim.tokenId);
    const ch = await this.repo.createChallenge({
      subjectType: 'CLAIM', subjectId: claim.tokenId, channel: 'SMS', phoneHash, codeHash: hashCode(code, salt, pepper), salt, maxAttempts: s.otpMaxAttempts,
      expiresAt: new Date(now.getTime() + s.otpExpiryMinutes * 60_000), requestIpHash: ipHash, sandboxBody: sandbox ? body : null,
    });
    try { await this.sms.send(phone, body); } catch { await this.repo.applyAttempt(ch.id, 0, { attempts: 0, status: 'REVOKED', usedAt: null }); }
    await this.audit.record({ type: 'SYSTEM', id: null, ip }, 'claim.otp.requested', 'otp_challenge', ch.id, null, { vendorId: claim.vendorId, phone: maskPhone(phone), sandbox });
    return this.sent;
  }

  async verify(rawToken: string, code: string, ip: string | null): Promise<OtpVerifyResult> {
    const pepper = this.pepper.value();
    const claim = await this.claims.peek(rawToken);
    const ch = claim ? await this.repo.latestChallenge('CLAIM', claim.tokenId) : null;
    if (!claim || !ch) { hashCode('000000', 'x', pepper); throw invalid(); }
    const now = this.clock();
    const match = verifyCodeHash(code, ch.codeHash, ch.salt, pepper);
    const res = evaluateAttempt(ch, now, match);
    if (res.result === 'EXPIRED' && ch.status === 'PENDING') await this.repo.applyAttempt(ch.id, ch.attempts, { attempts: ch.attempts, status: 'EXPIRED', usedAt: null });
    if (res.result !== 'OK') {
      if (res.result === 'WRONG' || res.result === 'LOCKED') {
        const applied = await this.repo.applyAttempt(ch.id, ch.attempts, { attempts: res.attempts, status: res.result === 'LOCKED' ? 'LOCKED' : 'PENDING', usedAt: null });
        if (applied && res.result === 'LOCKED') await this.audit.record({ type: 'SYSTEM', id: null, ip }, 'claim.otp.locked', 'otp_challenge', ch.id, null, { vendorId: claim.vendorId, attempts: res.attempts });
      }
      throw invalid();
    }
    // the right code: only ONE request can flip PENDING to VERIFIED
    if (!(await this.repo.applyAttempt(ch.id, ch.attempts, { attempts: res.attempts, status: 'VERIFIED', usedAt: now }))) throw invalid();
    let vendorId: string;
    try { ({ vendorId } = await this.claims.redeemClaim(rawToken)); } catch { throw invalid(); }
    await this.markBusinessClaimed(vendorId, now);
    const s = await this.settings.get();
    const grant = await this.grants.issue(vendorId, s.accountSetupGrantMinutes);
    await this.audit.record({ type: 'SYSTEM', id: null, ip }, 'claim.otp.verified', 'otp_challenge', ch.id, null, { vendorId });
    return { claimed: true, vendorId, setupToken: grant.token, setupTokenExpiresAt: grant.expiresAt.toISOString() };
  }

  private async markBusinessClaimed(vendorId: string, now: Date): Promise<void> {
    const b = await this.repo.getBusinessByVendor(vendorId);
    if (!b || b.status === 'CLAIMED' || b.status === 'REMOVED' || b.status === 'SUSPENDED') return;
    const next = { ...b, status: 'CLAIMED' as const };
    await this.repo.updateBusiness(b.id, { status: 'CLAIMED', claimedAt: now, indexable: await this.admin.indexableFor(next) });
    await this.audit.record({ type: 'SYSTEM', id: null, ip: null }, 'directory.business.claimed', 'directory_business', b.id, { status: b.status }, { status: 'CLAIMED' });
  }
}
