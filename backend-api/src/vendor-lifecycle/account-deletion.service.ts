import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import { b3Error } from '../b3-settings/b3-errors';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { maskPhone } from '../directory/core/masking';
import { canResend, evaluateAttempt, generateOtp, hashCode, hashPhone, normalisePhoneE164, verifyCodeHash } from '../directory/core/otp';
import { DirectoryRepository } from '../directory/directory.repository';
import { OtpPepper } from '../directory/pepper';
import { DirectorySettingsService } from '../directory/settings/directory-settings.service';
import { SmsAdapter } from '../directory/sms/sms-adapter';
import { Actor } from '../plans/admin/audit.service';
import { DeletionStep } from './core/lifecycle-core';
import { LifecycleStore } from './lifecycle.store';

const SUBJECT = 'ACCOUNT_DELETION';
export interface DeletionStepResult { step: DeletionStep; warning: string; maskedPhone?: string; expiresInMinutes?: number; requestId?: string; status?: 'PENDING' }
const invalidCode = (): BadRequestException => new BadRequestException(b3Error('DELETION_CODE_INVALID', 'That code is not valid.'));

/**
 * The vendor's own deletion request (path (a) of owner rule 9). Owner only (the controller). Three steps in ONE route so a screen cannot skip one:
 *  1. no code in the body            -> a fresh one-time code is sent to the phone on file (slice 5.7 OTP core, SMS sandbox adapter), the warning text is returned.
 *  2. a code, but confirm is not true -> 400 DELETION_CONFIRM_REQUIRED with the warning (the confirmation step).
 *  3. the right code and confirm=true -> an open request joins the staff-visible queue. Nothing is removed yet; staff execute it.
 * The code is bound to this vendor (subject ACCOUNT_DELETION), single use, expires, and is checked in constant time with a compare-and-set on the attempt counter.
 */
@Injectable()
export class AccountDeletionService {
  clock: () => Date = () => new Date();
  random: (min: number, max: number) => number = (min, max) => randomInt(min, max);
  salt: () => string = () => randomBytes(16).toString('hex');

  constructor(
    private readonly store: LifecycleStore, private readonly repo: DirectoryRepository, @Inject(DirectorySettingsService) private readonly dirSettings: Pick<DirectorySettingsService, 'get'>,
    private readonly b3: Pick<B3SettingsService, 'get'>, private readonly sms: SmsAdapter, private readonly pepper: OtpPepper,
  ) {}

  async request(vendorId: string, userId: string | null, actor: Actor, input: { code?: string; confirm?: boolean }): Promise<DeletionStepResult> {
    const b3 = await this.b3.get();
    const warning = b3.accountDeletionWarningText;
    if (await this.store.isRemoved(vendorId)) throw new BadRequestException(b3Error('LIFECYCLE_STATE_INVALID', 'This account has already been removed.'));
    const open = await this.store.pendingDeletion(vendorId);
    if (open) return { step: 'REQUESTED', warning, requestId: open.id, status: 'PENDING' };   // idempotent: asking again returns the open request

    if (!input.code) return this.sendCode(vendorId, actor, warning);
    if (input.confirm !== true) throw new BadRequestException(b3Error('DELETION_CONFIRM_REQUIRED', 'Confirm that you want your site and listing removed for good.', { warning }));
    await this.verify(vendorId, input.code);
    const row = await this.store.createDeletion({
      vendorId, requestedById: userId, verifiedAt: this.clock(),
      audit: { actor, action: 'account.deletion.requested', entityType: 'account_deletion_request', entityId: null, after: { vendorId } },
    });
    return { step: 'REQUESTED', warning, requestId: row.id, status: 'PENDING' };
  }

  private async sendCode(vendorId: string, actor: Actor, warning: string): Promise<DeletionStepResult> {
    const v = await this.store.vendor(vendorId);
    const phone = v?.phone ? normalisePhoneE164(v.phone) : null;
    if (!v || !phone) throw new BadRequestException(b3Error('DELETION_NO_PHONE', 'We need a mobile number on your account to confirm this. Contact support.'));
    const s = await this.dirSettings.get(); const now = this.clock(); const pepper = this.pepper.value();
    const phoneHash = hashPhone(phone, pepper); const ipHash = this.pepper.hashIp(actor.ip);
    const hourAgo = new Date(now.getTime() - 3_600_000);
    const last = await this.repo.latestChallenge(SUBJECT, vendorId);
    const quiet = { step: 'CODE_SENT' as const, warning, maskedPhone: maskPhone(phone), expiresInMinutes: s.otpExpiryMinutes };
    if (last && !canResend(last.createdAt, now, s.otpResendCooldownSeconds)) return quiet;   // inside the cooldown the earlier code is still the one to use
    if ((await this.repo.countChallengesSince({ phoneHash }, hourAgo)) >= s.otpMaxPerPhonePerHour) return quiet;
    if (ipHash && (await this.repo.countChallengesSince({ ipHash }, hourAgo)) >= s.otpMaxPerIpPerHour) return quiet;
    const code = generateOtp(this.random); const salt = this.salt();
    const sandbox = await this.sms.isSandbox();
    const body = `Your Get4Domain code to confirm deleting your account is ${code}. It expires in ${s.otpExpiryMinutes} minutes. Do not share it.`;
    await this.repo.revokePendingChallenges(SUBJECT, vendorId);
    const ch = await this.repo.createChallenge({
      subjectType: SUBJECT, subjectId: vendorId, channel: 'SMS', phoneHash, codeHash: hashCode(code, salt, pepper), salt, maxAttempts: s.otpMaxAttempts,
      expiresAt: new Date(now.getTime() + s.otpExpiryMinutes * 60_000), requestIpHash: ipHash, sandboxBody: sandbox ? body : null,
    });
    try { await this.sms.send(phone, body); } catch { await this.repo.applyAttempt(ch.id, 0, { attempts: 0, status: 'REVOKED', usedAt: null }); }
    return quiet;
  }

  private async verify(vendorId: string, code: string): Promise<void> {
    const pepper = this.pepper.value();
    const ch = await this.repo.latestChallenge(SUBJECT, vendorId);
    if (!ch) { hashCode('000000', 'x', pepper); throw invalidCode(); }
    const now = this.clock();
    const res = evaluateAttempt(ch, now, verifyCodeHash(code, ch.codeHash, ch.salt, pepper));
    if (res.result === 'EXPIRED' && ch.status === 'PENDING') await this.repo.applyAttempt(ch.id, ch.attempts, { attempts: ch.attempts, status: 'EXPIRED', usedAt: null });
    if (res.result !== 'OK') {
      if (res.result === 'WRONG' || res.result === 'LOCKED') await this.repo.applyAttempt(ch.id, ch.attempts, { attempts: res.attempts, status: res.result === 'LOCKED' ? 'LOCKED' : 'PENDING', usedAt: null });
      throw invalidCode();
    }
    // only ONE request can flip PENDING to VERIFIED, so a code works once
    if (!(await this.repo.applyAttempt(ch.id, ch.attempts, { attempts: res.attempts, status: 'VERIFIED', usedAt: now }))) throw invalidCode();
  }
}
