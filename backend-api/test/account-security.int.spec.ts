// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Controller, Get, INestApplication, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { ACCOUNT_SECURITY_PROVIDERS } from '../src/account-security/account-security.module';
import { AccountSecurityController } from '../src/account-security/account-security.controller';
import { PasswordService } from '../src/account-security/password.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { EmailService } from '../src/email/email.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant } from './support/fixtures';

// @nestjs/schedule ships ES modules that Jest does not parse; AuthService reaches it through its service imports. Only the cron
// decorators are needed at import time, and no job should run in a test anyway.
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined, Interval: () => () => undefined, Timeout: () => () => undefined,
  CronExpression: new Proxy({}, { get: () => '* * * * *' }), ScheduleModule: {}, SchedulerRegistry: class {},
}));

/**
 * S13 end to end against STAGING with real accounts of all three kinds (vendor owner, vendor team member, Get4Domain staff).
 * Real controller, real services, real JwtStrategy + JwtAuthGuard. Email goes to the in-memory test outbox (EMAIL_MODE=test): nothing is sent.
 */
@Controller('probe')
class ProbeController {
  @Get() ok() { return { ok: true }; }       // any authenticated route: proves whether a token is still accepted
}

const OLD = 'OldPass1';
const NEW = 'NewPass123';
const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('S13 password reset, change and refresh tokens (staging database)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;
  let passwords: PasswordService;
  let V: SeededTenant;
  let vendorEmail: string;
  let memberEmail: string;
  let staffEmail: string;
  let staffId: string;

  /** Status + body without the per-request timestamp, so two answers can be compared for sameness. */
  const stable = (res: { status: number; body: Record<string, unknown> }) => { const { timestamp: _t, ...rest } = res.body; return { status: res.status, ...rest }; };
  const body = (res: { body: { data?: unknown } }): Record<string, unknown> => ((res.body.data ?? res.body) as Record<string, unknown>);
  const post = (path: string, payload: Record<string, unknown>, token?: string) => {
    const r = request(app.getHttpServer()).post(path);
    return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(payload);
  };
  const login = (email: string, password: string) => post('/auth/session/login', { email, password });
  const probe = (token: string) => request(app.getHttpServer()).get('/probe').set('Authorization', `Bearer ${token}`);
  const forgot = async (email: string) => { const res = await post('/auth/password/forgot', { email }); await passwords.idle(); return res; };
  const mailsTo = (email: string) => EmailService.outbox.filter((m) => m.to === email);
  const tokenFromMail = (email: string): string => {
    const mails = mailsTo(email);
    const m = /token=([A-Za-z0-9_-]+)/.exec(mails[mails.length - 1]?.html ?? '');
    if (!m) throw new Error(`no reset mail with a token was sent to ${email}`);
    return m[1];
  };
  const setPassword = (model: 'vendor' | 'adminTeamMember' | 'teamMember', where: Record<string, unknown>, plain: string) =>
    (prisma[model] as unknown as { updateMany: (a: unknown) => Promise<unknown> }).updateMany({ where, data: { password: bcrypt.hashSync(plain, 4), passwordChangedAt: null } });
  /** An access token as if issued `ageSeconds` ago. */
  const oldAccessToken = (payload: Record<string, unknown>, ageSeconds = 120) => jwt.sign({ ...payload, iat: Math.floor(Date.now() / 1000) - ageSeconds }, { expiresIn: '1h' });

  beforeAll(async () => {
    prisma = newPrisma();
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, PassportModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
      controllers: [AccountSecurityController, ProbeController],
      providers: [...ACCOUNT_SECURITY_PROVIDERS, AuthService, EmailService, JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
    }).useMocker(() => ({})).compile();      // AuthService also wants VendorsService / StarterService: never used by login
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(buildValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    jwt = app.get(JwtService);
    passwords = app.get(PasswordService);

    V = await seedTenant(prisma, 'sa', RUN_ID);
    vendorEmail = V.email;
    memberEmail = (await prisma.teamMember.findUniqueOrThrow({ where: { id: V.ids.member } })).email as string;
    await setPassword('vendor', { id: V.vendorId }, OLD);
    await setPassword('teamMember', { id: V.ids.member }, OLD);
    await seedStaff(prisma, 'sastaff', RUN_ID, 'OPERATIONS');
    const staff = await prisma.adminTeamMember.findFirstOrThrow({ where: { email: { contains: `sastaff-${RUN_ID}` } } });
    staffEmail = staff.email; staffId = staff.id;
    await setPassword('adminTeamMember', { id: staffId }, OLD);
  }, 120000);

  beforeEach(async () => {
    EmailService.outbox.length = 0;
    // each test starts below the hourly reset cap
    await prisma.accountPasswordReset.deleteMany({ where: { accountId: { in: [V.vendorId, V.ids.member, staffId] } } });
  });

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 120000);

  // ── login + refresh issue ────────────────────────────────────────────────────────────────────────────
  describe('session login for all three account kinds', () => {
    it.each([['vendor owner', () => vendorEmail], ['vendor team member', () => memberEmail], ['Get4Domain staff', () => staffEmail]] as const)('%s receives an access token and a refresh token', async (_n, email) => {
      const res = await login(email(), OLD);
      expect(res.status).toBe(200);
      const d = body(res);
      expect(typeof d.accessToken).toBe('string');
      expect(String(d.refreshToken)).toMatch(/^rt_[A-Za-z0-9_-]{43}$/);
      expect((await probe(d.accessToken as string)).status).toBe(200);
    });
  });

  // ── RULE: reset tokens single-use, hashed, short-lived, configurable ──────────────────────────────────
  describe('reset tokens', () => {
    it('are stored only as a hash and can be used exactly once', async () => {
      await setPassword('vendor', { id: V.vendorId }, OLD);
      expect((await forgot(vendorEmail)).status).toBe(200);
      const token = tokenFromMail(vendorEmail);
      const rows = await prisma.accountPasswordReset.findMany({ where: { accountId: V.vendorId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(sha(token));
      expect(JSON.stringify(rows)).not.toContain(token);
      const first = await post('/auth/password/reset', { token, newPassword: NEW });
      expect(first.status).toBe(200);
      const replay = await post('/auth/password/reset', { token, newPassword: 'Another123' });
      expect(replay.status).toBe(400);
      expect((await login(vendorEmail, NEW)).status).toBe(200);          // the new password works
      expect((await login(vendorEmail, OLD)).status).toBe(401);          // the old one does not
      expect((await login(vendorEmail, 'Another123')).status).toBe(401); // the replayed request changed nothing
    });

    it('two simultaneous uses of one token succeed exactly once', async () => {
      await forgot(vendorEmail);
      const token = tokenFromMail(vendorEmail);
      const results = await Promise.all([1, 2, 3, 4].map((i) => post('/auth/password/reset', { token, newPassword: `Race${i}Pass1` })));
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    });

    it('expire after the configured time (default 30 minutes, set from the environment)', async () => {
      process.env.PASSWORD_RESET_TTL_MINUTES = '7';
      try {
        await forgot(vendorEmail);
        const row = await prisma.accountPasswordReset.findFirstOrThrow({ where: { accountId: V.vendorId }, orderBy: { createdAt: 'desc' } });
        expect(Math.round((row.expiresAt.getTime() - row.createdAt.getTime()) / 60000)).toBe(7);
      } finally { delete process.env.PASSWORD_RESET_TTL_MINUTES; }
    });

    it('are refused once expired', async () => {
      await forgot(vendorEmail);
      const token = tokenFromMail(vendorEmail);
      await prisma.accountPasswordReset.updateMany({ where: { tokenHash: sha(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await post('/auth/password/reset', { token, newPassword: NEW })).status).toBe(400);
    });

    it('a newer request voids the older link', async () => {
      await forgot(vendorEmail);
      const older = tokenFromMail(vendorEmail);
      EmailService.outbox.length = 0;
      await forgot(vendorEmail);
      const newer = tokenFromMail(vendorEmail);
      expect(newer).not.toBe(older);
      expect((await post('/auth/password/reset', { token: older, newPassword: NEW })).status).toBe(400);
      expect((await post('/auth/password/reset', { token: newer, newPassword: NEW })).status).toBe(200);
    });

    it('a made-up token and a weak password are both refused', async () => {
      expect((await post('/auth/password/reset', { token: 'x'.repeat(43), newPassword: NEW })).status).toBe(400);
      await forgot(vendorEmail);
      expect((await post('/auth/password/reset', { token: tokenFromMail(vendorEmail), newPassword: 'weak' })).status).toBe(400);
    });

    it.each([['vendor team member', () => memberEmail, 'teamMember'], ['Get4Domain staff', () => staffEmail, 'adminTeamMember']] as const)('work for a %s as well', async (_n, email, _kind) => {
      await forgot(email());
      const token = tokenFromMail(email());
      expect((await post('/auth/password/reset', { token, newPassword: NEW })).status).toBe(200);
      expect((await login(email(), NEW)).status).toBe(200);
      expect((await login(email(), OLD)).status).toBe(401);
    });
  });

  // ── RULE: no account enumeration, rate limits ─────────────────────────────────────────────────────────
  describe('responses never reveal whether an account exists', () => {
    it('forgot-password answers identically for a known and an unknown email, and only the known one gets mail', async () => {
      await setPassword('vendor', { id: V.vendorId }, OLD);
      const known = await forgot(vendorEmail);
      const unknown = await forgot(`nobody-${RUN_ID}@v3test.invalid`);
      expect(unknown.status).toBe(known.status);
      expect(stable(unknown)).toEqual(stable(known));
      expect(mailsTo(vendorEmail)).toHaveLength(1);
      expect(mailsTo(`nobody-${RUN_ID}@v3test.invalid`)).toHaveLength(0);
      expect(await prisma.accountPasswordReset.count({ where: { accountId: { in: [`nobody-${RUN_ID}`] } } })).toBe(0);
    });

    it('login fails identically for an unknown email, a wrong password and a suspended account, and not faster for unknown ones', async () => {
      await setPassword('vendor', { id: V.vendorId }, OLD);
      const S = await seedTenant(prisma, 'ss', RUN_ID);
      await setPassword('vendor', { id: S.vendorId }, OLD);
      await prisma.vendor.update({ where: { id: S.vendorId }, data: { status: 'SUSPENDED' } });
      process.env.AUTH_MIN_FAILURE_MS = '250';
      try {
        const timed = async (email: string, pw: string) => { const t = Date.now(); const res = await login(email, pw); return { res, ms: Date.now() - t }; };
        const unknown = await timed(`ghost-${RUN_ID}@v3test.invalid`, OLD);
        const wrong = await timed(vendorEmail, 'WrongPass1');
        const suspended = await timed(S.email, OLD);                 // CORRECT password, suspended account
        for (const r of [unknown, wrong, suspended]) {
          expect(r.res.status).toBe(401);
          expect(stable(r.res)).toEqual(stable(unknown.res));
          expect(r.ms).toBeGreaterThanOrEqual(240);
        }
        expect(JSON.stringify(unknown.res.body)).not.toMatch(/suspend|not found|exist|unavailable/i);
      } finally { delete process.env.AUTH_MIN_FAILURE_MS; }
    });
  });

  describe('rate limits', () => {
    it('at most 3 reset mails per account per hour; the extra requests look exactly the same but send nothing', async () => {
      await setPassword('vendor', { id: V.vendorId }, OLD);
      await prisma.accountPasswordReset.deleteMany({ where: { accountId: V.vendorId } });
      const answers = [];
      for (let i = 0; i < 5; i++) answers.push(await forgot(vendorEmail));
      expect(mailsTo(vendorEmail)).toHaveLength(3);
      expect(await prisma.accountPasswordReset.count({ where: { accountId: V.vendorId } })).toBe(3);
      for (const a of answers) { expect(stable(a)).toEqual(stable(answers[0])); }
    });

    it('10 wrong passwords lock that IP + email (even for the right password); other accounts are not affected', async () => {
      const L = await seedTenant(prisma, 'sl', RUN_ID);
      await setPassword('vendor', { id: L.vendorId }, OLD);
      for (let i = 0; i < 10; i++) expect((await login(L.email, `Wrong${i}Pass1`)).status).toBe(401);
      expect((await login(L.email, OLD)).status).toBe(429);
      expect((await login(vendorEmail, OLD)).status).toBe(200);
    });
  });

  // ── RULE: refresh tokens rotate; reuse revokes the family ─────────────────────────────────────────────
  describe('refresh tokens', () => {
    let account: SeededTenant;
    beforeAll(async () => { account = await seedTenant(prisma, 'sr', RUN_ID); await setPassword('vendor', { id: account.vendorId }, OLD); });

    it('rotate on every use: the old token dies, the new one works, the chain is recorded', async () => {
      const first = body(await login(account.email, OLD));
      const r1 = await post('/auth/session/refresh', { refreshToken: first.refreshToken });
      expect(r1.status).toBe(200);
      const second = body(r1);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect((await probe(second.accessToken as string)).status).toBe(200);
      const rows = await prisma.authRefreshToken.findMany({ where: { accountId: account.vendorId }, orderBy: { createdAt: 'asc' } });
      expect(rows[0].tokenHash).toBe(sha(first.refreshToken as string));
      expect(rows[0].usedAt).not.toBeNull();
      expect(rows[0].replacedById).toBe(rows[1].id);
      expect(rows[1].familyId).toBe(rows[0].familyId);
      expect(JSON.stringify(rows)).not.toContain(first.refreshToken as string);       // hashes only
    });

    it('presenting a used token again is treated as theft: 401 and the whole family, including the newest token, is revoked', async () => {
      const first = body(await login(account.email, OLD));
      const second = body(await post('/auth/session/refresh', { refreshToken: first.refreshToken }));
      expect((await post('/auth/session/refresh', { refreshToken: first.refreshToken })).status).toBe(401);   // replay
      expect((await post('/auth/session/refresh', { refreshToken: second.refreshToken })).status).toBe(401);  // family is dead
      const fam = await prisma.authRefreshToken.findMany({ where: { tokenHash: { in: [sha(first.refreshToken as string), sha(second.refreshToken as string)] } } });
      expect(fam.every((r) => r.revokedAt !== null)).toBe(true);
    });

    it('simultaneous uses of one token: at most one gets through, and the reuse kills the family so nothing from it works afterwards', async () => {
      const first = body(await login(account.email, OLD));
      const results = await Promise.all([1, 2, 3].map(() => post('/auth/session/refresh', { refreshToken: first.refreshToken })));
      const winners = results.filter((r) => r.status === 200);
      expect(winners.length).toBeLessThanOrEqual(1);
      expect(results.filter((r) => r.status === 401).length).toBeGreaterThanOrEqual(2);
      for (const w of winners) expect((await post('/auth/session/refresh', { refreshToken: body(w).refreshToken })).status).toBe(401);
      const family = await prisma.authRefreshToken.findMany({ where: { familyId: (await prisma.authRefreshToken.findFirstOrThrow({ where: { tokenHash: sha(first.refreshToken as string) } })).familyId } });
      expect(family.every((r) => r.revokedAt !== null)).toBe(true);
    });

    it('an expired, unknown or malformed refresh token is a plain 401', async () => {
      const first = body(await login(account.email, OLD));
      await prisma.authRefreshToken.updateMany({ where: { tokenHash: sha(first.refreshToken as string) }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await post('/auth/session/refresh', { refreshToken: first.refreshToken })).status).toBe(401);
      expect((await post('/auth/session/refresh', { refreshToken: `rt_${'A'.repeat(43)}` })).status).toBe(401);
      expect((await post('/auth/session/refresh', { refreshToken: 'garbage' })).status).toBe(401);
    });

    it('lifetime comes from REFRESH_TOKEN_TTL_DAYS', async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '3';
      try {
        const first = body(await login(account.email, OLD));
        const row = await prisma.authRefreshToken.findFirstOrThrow({ where: { tokenHash: sha(first.refreshToken as string) } });
        expect(Math.round((row.expiresAt.getTime() - row.createdAt.getTime()) / 86_400_000)).toBe(3);
      } finally { delete process.env.REFRESH_TOKEN_TTL_DAYS; }
    });

    it('a suspended account cannot refresh, and its family is revoked', async () => {
      const first = body(await login(account.email, OLD));
      await prisma.vendor.update({ where: { id: account.vendorId }, data: { status: 'SUSPENDED' } });
      try { expect((await post('/auth/session/refresh', { refreshToken: first.refreshToken })).status).toBe(401); }
      finally { await prisma.vendor.update({ where: { id: account.vendorId }, data: { status: 'ACTIVE' } }); }
      expect((await post('/auth/session/refresh', { refreshToken: first.refreshToken })).status).toBe(401);
    });

    it('logout revokes the family and is idempotent', async () => {
      const first = body(await login(account.email, OLD));
      expect((await post('/auth/session/logout', { refreshToken: first.refreshToken })).status).toBe(200);
      expect((await post('/auth/session/logout', { refreshToken: first.refreshToken })).status).toBe(200);
      expect((await post('/auth/session/refresh', { refreshToken: first.refreshToken })).status).toBe(401);
    });
  });

  // ── RULE: password change and reset revoke every session ──────────────────────────────────────────────
  describe('changing the password ends every other session', () => {
    it('change-password: needs the current password, revokes all refresh tokens, rejects older access tokens, and returns a fresh session', async () => {
      const C = await seedTenant(prisma, 'sc', RUN_ID);
      await setPassword('vendor', { id: C.vendorId }, OLD);
      const a = body(await login(C.email, OLD));
      const b = body(await login(C.email, OLD));               // a second device
      const stale = oldAccessToken({ sub: C.vendorId, email: C.email, role: 'VENDOR' });
      expect((await probe(stale)).status).toBe(200);           // before the change it is fine
      expect((await post('/auth/password/change', { currentPassword: 'WrongPass1', newPassword: NEW }, a.accessToken as string)).status).toBe(400);
      expect((await post('/auth/password/change', { currentPassword: OLD, newPassword: NEW })).status).toBe(401);   // needs a session
      const changed = await post('/auth/password/change', { currentPassword: OLD, newPassword: NEW }, a.accessToken as string);
      expect(changed.status).toBe(200);
      for (const t of [a.refreshToken, b.refreshToken]) expect((await post('/auth/session/refresh', { refreshToken: t })).status).toBe(401);
      expect((await probe(stale)).status).toBe(401);
      expect((await probe(a.accessToken as string)).status).toBe(401);           // issued before the change
      const fresh = body(changed);
      expect((await probe(fresh.accessToken as string)).status).toBe(200);
      expect((await post('/auth/session/refresh', { refreshToken: fresh.refreshToken })).status).toBe(200);
      expect((await login(C.email, NEW)).status).toBe(200);
      expect((await login(C.email, OLD)).status).toBe(401);
    });

    it('reset-password: revokes all refresh tokens and rejects older access tokens', async () => {
      const R = await seedTenant(prisma, 'sp', RUN_ID);
      await setPassword('vendor', { id: R.vendorId }, OLD);
      const a = body(await login(R.email, OLD));
      const stale = oldAccessToken({ sub: R.vendorId, email: R.email, role: 'VENDOR' });
      await forgot(R.email);
      expect((await post('/auth/password/reset', { token: tokenFromMail(R.email), newPassword: NEW })).status).toBe(200);
      expect((await post('/auth/session/refresh', { refreshToken: a.refreshToken })).status).toBe(401);
      expect((await probe(stale)).status).toBe(401);
    });

    it('the same cutoff applies to a team member and to staff (access tokens older than the change are refused)', async () => {
      await prisma.teamMember.update({ where: { id: V.ids.member }, data: { passwordChangedAt: null } });      // earlier tests reset these passwords
      await prisma.adminTeamMember.update({ where: { id: staffId }, data: { passwordChangedAt: null } });
      const memberOld = oldAccessToken({ sub: V.vendorId, email: memberEmail, role: 'VENDOR', kind: 'team_member', memberId: V.ids.member });
      const staffOld = oldAccessToken({ sub: staffId, email: staffEmail, role: 'ADMIN', kind: 'admin_member' });
      expect((await probe(memberOld)).status).toBe(200);
      expect((await probe(staffOld)).status).toBe(200);
      await prisma.teamMember.update({ where: { id: V.ids.member }, data: { passwordChangedAt: new Date() } });
      await prisma.adminTeamMember.update({ where: { id: staffId }, data: { passwordChangedAt: new Date() } });
      expect((await probe(memberOld)).status).toBe(401);
      expect((await probe(staffOld)).status).toBe(401);
    });
  });

  // ── RULE: no passwords or tokens in logs; email behind the provider ───────────────────────────────────
  describe('logging and email', () => {
    it('no password, reset token or refresh token ever reaches a log line, even when the mail provider fails', async () => {
      const lines: string[] = [];
      const grab = (...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
      const spies = (['log', 'error', 'warn', 'debug', 'verbose'] as const).map((m) => jest.spyOn(Logger.prototype, m).mockImplementation(grab));
      const c = [jest.spyOn(console, 'log').mockImplementation(grab), jest.spyOn(console, 'error').mockImplementation(grab), jest.spyOn(console, 'warn').mockImplementation(grab)];
      const L = await seedTenant(prisma, 'slog', RUN_ID);
      const secretPw = 'Lg0SecretPw9', secretNew = 'Lg0NewSecret7';
      try {
        await setPassword('vendor', { id: L.vendorId }, secretPw);
        const session = body(await login(L.email, secretPw));
        await login(L.email, 'Wr0ngSecret1');
        await forgot(L.email);
        const resetToken = tokenFromMail(L.email);
        await post('/auth/session/refresh', { refreshToken: session.refreshToken });
        await post('/auth/session/refresh', { refreshToken: session.refreshToken });              // reuse path
        await post('/auth/password/reset', { token: resetToken, newPassword: secretNew });
        await post('/auth/password/reset', { token: resetToken, newPassword: secretNew });        // replay path
        const mail = jest.spyOn(EmailService.prototype, 'sendPasswordReset').mockRejectedValue(new Error(`provider down for ${resetToken}`));
        await forgot(L.email);                                                                   // provider-failure path
        mail.mockRestore();
        const all = lines.join('\n');
        for (const secret of [secretPw, secretNew, 'Wr0ngSecret1', resetToken, session.refreshToken as string, session.accessToken as string]) expect(all).not.toContain(secret);
      } finally { spies.forEach((s) => s.mockRestore()); c.forEach((s) => s.mockRestore()); }
    });

    it('a mail-provider failure never changes the answer (still the generic reply, no error)', async () => {
      const ok = await forgot(`nobody2-${RUN_ID}@v3test.invalid`);
      const mail = jest.spyOn(EmailService.prototype, 'sendPasswordReset').mockRejectedValue(new Error('provider down'));
      try {
        const res = await forgot(vendorEmail);
        expect(res.status).toBe(ok.status);
        expect(stable(res)).toEqual(stable(ok));
      } finally { mail.mockRestore(); }
    });

    it('test mode captures the mail instead of sending it, and the link points at the frontend reset page', async () => {
      await forgot(vendorEmail);
      const m = mailsTo(vendorEmail)[0];
      expect(m.subject).toMatch(/reset/i);
      expect(m.html).toMatch(/\/reset-password\?token=/);
    });

    it('the forgot-password response is not slower for a known account (the work is not done inside the request)', async () => {
      const t1 = Date.now(); await post('/auth/password/forgot', { email: `zz-${RUN_ID}@v3test.invalid` }); const unknownMs = Date.now() - t1;
      await sleep(10);
      const t2 = Date.now(); await post('/auth/password/forgot', { email: staffEmail }); const knownMs = Date.now() - t2;
      await passwords.idle();
      expect(knownMs - unknownMs).toBeLessThan(150);
    });
  });
});
