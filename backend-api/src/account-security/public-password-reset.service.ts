import { Inject, Injectable, Optional } from '@nestjs/common';
import { canonicalOrigin } from '../seo-directory/core/url-scheme';
import { EmailPort } from '../v3-mail/email.port';
import { assertMailEnabled, MAIL_ENABLED, MailEnabled } from '../v3-mail/mail-enabled';
import { PasswordService, ResetDelivery } from './password.service';

/** The public site's base address (the Provisioning setting the claim links use). Provided by the module; without it no link can be built and nothing is sent. */
export const RESET_PUBLIC_URL = Symbol('RESET_PUBLIC_URL');
export type ResetPublicUrl = () => Promise<string>;
export const RESET_PAGE_PATH = '/account/reset-password';
export const RESET_REPLY = 'If an account exists for that email, a password reset link has been sent.';

/**
 * Password reset for the public site (Wave 2, public site gap G14). Request and confirm, by email, through the mail port (system lane, kind ACCOUNT_NOTICE), with a link to the PUBLIC site's reset page
 * (`<public site>/account/reset-password?token=`) instead of the backend's FRONTEND_URL. The tokens, the hourly cap, the single use, the ending of every session and the notification of the change are
 * the existing PasswordService, unchanged. With the mail switch OFF the request answers the registered MAIL_DISABLED (503) before anything is looked up, which depends on the switch only; with it ON the
 * answer is the same whether or not an account exists, and is sent without waiting for the lookup, the write or the mail, so neither the text nor the time tells an address apart.
 */
@Injectable()
export class PublicPasswordResetService {
  constructor(
    private readonly passwords: PasswordService,
    @Optional() @Inject(EmailPort) private readonly email?: EmailPort,
    @Optional() @Inject(MAIL_ENABLED) private readonly mailEnabled?: MailEnabled,
    @Optional() @Inject(RESET_PUBLIC_URL) private readonly publicUrl?: ResetPublicUrl,
  ) {}

  private readonly deliver: ResetDelivery = async ({ to, token }) => {
    const base = this.publicUrl ? canonicalOrigin(await this.publicUrl()) : '';
    if (!base || !this.email) throw new Error('reset link not deliverable');   // logged by PasswordService with fixed text; the link is never in the message
    await this.email.send({
      lane: 'SYSTEM', kind: 'ACCOUNT_NOTICE', to, subject: 'Reset your Get4Domain password',
      text: `We received a request to reset your Get4Domain password. Open this link to choose a new one. It works once and expires soon.\n\n${base}${RESET_PAGE_PATH}?token=${token}\n\nIf you did not ask for this, you can ignore this message. Your password has not changed.`,
    });
  };

  request(email: string, ip: string | null): { message: string } {
    assertMailEnabled(this.mailEnabled);
    this.passwords.requestReset(email, ip ?? undefined, this.deliver);
    return { message: RESET_REPLY };
  }

  /** Same rules and the same single use as the existing reset: a bad, used, expired or revoked token is one 400. */
  async confirm(token: unknown, newPassword: string): Promise<{ ok: true }> { await this.passwords.reset(typeof token === 'string' ? token : '', newPassword); return { ok: true }; }
}
