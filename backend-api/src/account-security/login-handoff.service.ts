import { HttpException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AccountDirectory } from './account-directory.service';
import { securityConfig } from './account-security.config';
import { SessionService, Tokens } from './session.service';
import { hashToken, newToken } from './token.util';

export interface HandoffCode { code: string; expiresAt: string; ttlSeconds: number }
const invalid = (): HttpException => new HttpException({ message: 'This sign-in link is not valid.', code: 'HANDOFF_INVALID' }, 401);
const notAllowed = (): HttpException => new HttpException({ message: 'A sign-in link can only be made for a business owner.', code: 'HANDOFF_NOT_ALLOWED' }, 403);

/**
 * The login handoff (Wave 2, public site gap G2). A vendor owner who has just signed in on the public site asks for a one-time code, and the public site sends the browser to the vendor app with the
 * code in the URL FRAGMENT (never the query string, so it is not sent to any server or written to an access log). The vendor app swaps the code for a normal session. The code is 256 random bits, only its
 * hash is stored, it lives for seconds (LOGIN_HANDOFF_TTL_SECONDS, 15 to 300, default 60), it works once (a compare-and-set, so two simultaneous uses give exactly one session), and asking for a new
 * one ends every older unused one. Only a vendor OWNER can hand off: a team member, a staff member or a sandbox session cannot. Every failure of the swap is the same 401.
 */
@Injectable()
export class LoginHandoffService {
  clock: () => Date = () => new Date();
  constructor(private readonly prisma: PrismaService, private readonly directory: AccountDirectory, private readonly sessions: SessionService) {}

  async issue(user: AuthenticatedUser, ip: string | null): Promise<HandoffCode> {
    const ref = this.directory.fromPrincipal(user);
    if (!ref || ref.type !== 'VENDOR') throw notAllowed();
    const account = await this.directory.load(ref);
    if (!account) throw notAllowed();
    const now = this.clock(); const ttl = securityConfig().handoffTtlSeconds; const code = newToken('ho_'); const expiresAt = new Date(now.getTime() + ttl * 1000);
    await this.prisma.$transaction([
      this.prisma.v3LoginHandoff.updateMany({ where: { accountType: ref.type, accountId: ref.id, usedAt: null }, data: { usedAt: now } }),   // an older unused code stops working; the row stays as history
      this.prisma.v3LoginHandoff.create({ data: { tokenHash: hashToken(code), accountType: ref.type, accountId: ref.id, expiresAt, issuedIp: ip ? ip.slice(0, 64) : null } }),
    ]);
    return { code, expiresAt: expiresAt.toISOString(), ttlSeconds: ttl };
  }

  async redeem(code: string, userAgent?: string): Promise<Tokens> {
    if (typeof code !== 'string' || !/^ho_[A-Za-z0-9_-]{43}$/.test(code)) { hashToken('x'); throw invalid(); }
    const row = await this.prisma.v3LoginHandoff.findUnique({ where: { tokenHash: hashToken(code) } });
    const now = this.clock();
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) throw invalid();
    const claimed = await this.prisma.v3LoginHandoff.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimed.count !== 1) throw invalid();
    const account = await this.directory.load({ type: 'VENDOR', id: row.accountId });
    if (!account) throw invalid();   // suspended or removed since the code was made
    return this.sessions.issue(account, userAgent);
  }
}
