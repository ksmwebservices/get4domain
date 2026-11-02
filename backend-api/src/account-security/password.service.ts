import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { Account, AccountDirectory, AccountRef } from './account-directory.service';
import { securityConfig } from './account-security.config';
import { SessionService, Tokens } from './session.service';
import { hashToken, newToken } from './token.util';

const BAD_LINK = 'This reset link is invalid or has expired. Please request a new one.';
const HOUR_MS = 3_600_000;

/**
 * Forgot, reset and change password.
 *
 * Nothing here ever logs a password or a token, and nothing in a response depends on whether an email belongs to an account. In particular
 * `requestReset` is fire-and-forget: the HTTP answer is sent without waiting for the lookup, the database write or the mail, so response time
 * does not leak either.
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: AccountDirectory,
    private readonly sessions: SessionService,
    private readonly email: EmailService,
  ) {}

  /** Starts the reset in the background and returns immediately. Never throws and never reports whether the email matched an account. */
  requestReset(email: string, ip?: string): void {
    const job: Promise<void> = this.processReset(email, ip)
      .catch(() => this.logger.warn('A password reset request could not be processed'))      // fixed text: no email, no token, no error details
      .finally(() => { this.pending.delete(job); });
    this.pending.add(job);
  }

  /** Resolves when every background reset job has finished (for tests and for a clean shutdown). */
  async idle(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  private async processReset(email: string, ip?: string): Promise<void> {
    const account = await this.directory.findByEmail(email);
    if (!account) return;
    const cfg = securityConfig();
    const recent = await this.prisma.accountPasswordReset.count({ where: { accountType: account.type, accountId: account.id, createdAt: { gte: new Date(Date.now() - HOUR_MS) } } });
    if (recent >= cfg.resetMaxPerHour) return;                                       // silently over the hourly cap

    const token = newToken();
    const now = new Date();
    await this.prisma.$transaction([
      // a new request voids any older link that is still outstanding
      this.prisma.accountPasswordReset.updateMany({ where: { accountType: account.type, accountId: account.id, usedAt: null, revokedAt: null }, data: { revokedAt: now } }),
      this.prisma.accountPasswordReset.create({
        data: { accountType: account.type, accountId: account.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + cfg.resetTtlMinutes * 60_000), requestedIp: ip ? ip.slice(0, 64) : null },
      }),
    ]);
    try {
      await this.email.sendPasswordReset(account.email, account.name, `${cfg.frontendUrl}/reset-password?token=${token}`, cfg.resetTtlMinutes);
    } catch {
      this.logger.warn(`A password reset email could not be delivered for a ${account.type} account`);   // the cause may contain the link, so it is not logged
    }
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const row = await this.prisma.accountPasswordReset.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.revokedAt || row.expiresAt.getTime() <= Date.now()) throw new BadRequestException(BAD_LINK);
    const ref: AccountRef = { type: row.accountType as AccountRef['type'], id: row.accountId };
    const account = await this.directory.load(ref);
    if (!account) throw new BadRequestException(BAD_LINK);

    const hash = await bcrypt.hash(newPassword, 10);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Single use: of several simultaneous requests with the same token exactly one gets count 1.
      const claimed = await tx.accountPasswordReset.updateMany({ where: { id: row.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (claimed.count !== 1) throw new BadRequestException(BAD_LINK);
      await this.directory.setPassword(tx, ref, hash, now);
      await tx.accountPasswordReset.updateMany({ where: { accountType: ref.type, accountId: ref.id, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
      await this.sessions.revokeAll(ref, tx);
    });
    await this.notifyChanged(account);
  }

  /** The signed-in user changes their own password. Returns a fresh session, because every older one was just ended. */
  async change(user: AuthenticatedUser, currentPassword: string, newPassword: string, userAgent?: string): Promise<Tokens> {
    const ref = this.directory.fromPrincipal(user);
    if (!ref) throw new ForbiddenException('A password cannot be changed from this kind of session.');
    const currentHash = await this.directory.passwordHash(ref);
    if (!currentHash || !(await bcrypt.compare(currentPassword, currentHash))) throw new BadRequestException('Your current password is incorrect.');
    if (currentPassword === newPassword) throw new BadRequestException('Choose a new password that is different from the current one.');

    const hash = await bcrypt.hash(newPassword, 10);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.directory.setPassword(tx, ref, hash, now);
      await tx.accountPasswordReset.updateMany({ where: { accountType: ref.type, accountId: ref.id, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
      await this.sessions.revokeAll(ref, tx);
    });
    const account = await this.directory.load(ref);
    if (!account) throw new ForbiddenException('A password cannot be changed from this kind of session.');
    await this.notifyChanged(account);
    return this.sessions.issue(account, userAgent);
  }

  private async notifyChanged(account: Account): Promise<void> {
    try { await this.email.sendPasswordChangedNotice(account.email, account.name); }
    catch { this.logger.warn(`A password-changed notice could not be delivered for a ${account.type} account`); }
  }
}
