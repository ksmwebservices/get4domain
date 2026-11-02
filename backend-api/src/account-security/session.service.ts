import { randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { AuthService, LoginResult } from '../auth/auth.service';
import { LoginDto } from '../auth/dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Account, AccountDirectory, AccountRef, TokenClaims } from './account-directory.service';
import { securityConfig } from './account-security.config';
import { LoginLimiter } from './login-limiter';
import { hashToken, newToken } from './token.util';

export interface SessionResult extends LoginResult { refreshToken: string }
export interface Tokens { accessToken: string; refreshToken: string }

/**
 * The global response filter (common/utils/redact-secrets.ts) strips `refreshToken` from every plain object, so no endpoint can leak one by
 * accident. It passes class instances through untouched, which is how the three routes whose JOB is to hand out a refresh token opt out,
 * explicitly and only here.
 */
export class IssuedTokens {}
export function issued<T extends object>(body: T): T {
  return Object.assign(new IssuedTokens(), body);
}

/** One message for every way a sign-in can fail: it must never tell an unknown email, a wrong password and a suspended account apart. */
const SIGN_IN_FAILED = 'Invalid email or password';
const SESSION_ENDED = 'Your session has ended. Please sign in again.';
const REFRESH_SHAPE = /^rt_[A-Za-z0-9_-]{43}$/;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Sign-in sessions: a login that also returns a rotating refresh token, rotation with reuse detection, and revocation.
 *
 * Refresh tokens form a FAMILY (one per login). Using a token marks it used and issues the next one in the same family. Presenting a token
 * that was already used means it was copied (theft or replay), so the whole family is revoked and both the thief and the owner must sign in again.
 */
@Injectable()
export class SessionService {
  private readonly limiter = new LoginLimiter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly directory: AccountDirectory,
    private readonly auth: AuthService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent?: string): Promise<SessionResult> {
    const started = Date.now();
    const key = `${ip}|${dto.email.trim().toLowerCase()}`;
    this.limiter.assertAllowed(key);
    let result: LoginResult;
    try {
      result = await this.auth.login(dto);
    } catch (e) {
      if (!(e instanceof UnauthorizedException)) throw e;
      this.limiter.recordFailure(key);
      const wait = securityConfig().minFailureMs - (Date.now() - started);
      if (wait > 0) await sleep(wait);
      throw new UnauthorizedException(SIGN_IN_FAILED);
    }
    this.limiter.recordSuccess(key);

    const claims = this.jwt.decode(result.accessToken) as (TokenClaims & { iat?: number }) | null;
    const ref = claims ? this.directory.fromClaims(claims) : null;
    if (!claims || !ref) throw new UnauthorizedException(SIGN_IN_FAILED);
    const accessToken = this.signAccess({ sub: claims.sub, email: claims.email, role: claims.role, adminRole: claims.adminRole, kind: claims.kind, memberId: claims.memberId });
    const refreshToken = await this.createRefresh(ref, randomUUID(), userAgent);
    return issued({ ...result, accessToken, refreshToken });
  }

  /** A fresh login-equivalent session for an already-verified account (after a password change). */
  async issue(account: Account, userAgent?: string): Promise<Tokens> {
    return issued({
      accessToken: this.signAccess(this.directory.claims(account)),
      refreshToken: await this.createRefresh(account, randomUUID(), userAgent),
    });
  }

  async refresh(token: string, userAgent?: string): Promise<Tokens> {
    if (typeof token !== 'string' || !REFRESH_SHAPE.test(token)) throw new UnauthorizedException(SESSION_ENDED);
    const row = await this.prisma.authRefreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.revokedAt) throw new UnauthorizedException(SESSION_ENDED);
    if (row.usedAt) {                                              // REUSE: this token was already exchanged. Treat the family as stolen.
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException(SESSION_ENDED);
    }
    if (row.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException(SESSION_ENDED);

    // Claim the token atomically: of several simultaneous uses exactly one gets count 1.
    const claimed = await this.prisma.authRefreshToken.updateMany({ where: { id: row.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) {
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException(SESSION_ENDED);
    }

    const account = await this.directory.load({ type: row.accountType as AccountRef['type'], id: row.accountId });
    if (!account) {                                                // suspended, removed or deactivated since the token was issued
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException(SESSION_ENDED);
    }

    const next = await this.createRefreshRow(account, row.familyId, userAgent);
    await this.prisma.authRefreshToken.update({ where: { id: row.id }, data: { replacedById: next.id } });

    // A losing request of a race may have revoked the family between our claim and our insert; make sure the new token does not survive it.
    const parent = await this.prisma.authRefreshToken.findUnique({ where: { id: row.id }, select: { revokedAt: true } });
    if (parent?.revokedAt) {
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException(SESSION_ENDED);
    }
    return issued({ accessToken: this.signAccess(this.directory.claims(account)), refreshToken: next.token });
  }

  /** Ends the session this refresh token belongs to. Idempotent: an unknown or already-revoked token is not an error. */
  async logout(token: string): Promise<void> {
    if (typeof token !== 'string' || !REFRESH_SHAPE.test(token)) return;
    const row = await this.prisma.authRefreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (row) await this.revokeFamily(row.familyId);
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.authRefreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Every session of one account (password change or reset). Pass the transaction so it commits together with the new password. */
  async revokeAll(ref: AccountRef, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.authRefreshToken.updateMany({ where: { accountType: ref.type, accountId: ref.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private signAccess(claims: TokenClaims): string {
    return this.jwt.sign({ ...claims }, { expiresIn: securityConfig().accessTtl as JwtSignOptions['expiresIn'] });
  }

  private async createRefresh(ref: AccountRef, familyId: string, userAgent?: string): Promise<string> {
    return (await this.createRefreshRow(ref, familyId, userAgent)).token;
  }

  private async createRefreshRow(ref: AccountRef, familyId: string, userAgent?: string): Promise<{ id: string; token: string }> {
    const token = newToken('rt_');
    const row = await this.prisma.authRefreshToken.create({
      data: {
        accountType: ref.type, accountId: ref.id, familyId, tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + securityConfig().refreshTtlDays * 86_400_000),
        userAgent: userAgent ? userAgent.slice(0, 300) : null,
      },
    });
    return { id: row.id, token };
  }
}
