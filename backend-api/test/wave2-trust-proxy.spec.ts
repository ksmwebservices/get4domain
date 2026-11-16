import { Controller, Get, Req } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import request from 'supertest';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { resolveTrustProxy, trustedProxyProblem } from '../src/common/trust-proxy';

/** Wave 2, public site gap G15: X-Forwarded-For is believed only from the configured proxy, and the rate limit then follows the visitor. */
jest.setTimeout(120_000);

describe('resolveTrustProxy (pure)', () => {
  it('TRUSTED_PROXIES wins: addresses, subnets and the Express words, lower cased, de-duplicated; TRUST_PROXY_HOPS is then ignored', () => {
    expect(resolveTrustProxy({ TRUSTED_PROXIES: ' 10.0.0.5, 10.0.0.0/24 ,::1,LOOPBACK,10.0.0.5', TRUST_PROXY_HOPS: '2' })).toEqual({ value: ['10.0.0.5', '10.0.0.0/24', '::1', 'loopback'], source: 'TRUSTED_PROXIES', rejected: [] });
  });
  it('an entry that is not an address, a subnet or a word is rejected and named; the valid ones still count', () => {
    const r = resolveTrustProxy({ TRUSTED_PROXIES: '10.0.0.5, evil.example.com, 10.0.0.0/40, 1.2.3.4/8/9, *, true, 2001:db8::/129' });
    expect(r.value).toEqual(['10.0.0.5']); expect(r.rejected).toEqual(['evil.example.com', '10.0.0.0/40', '1.2.3.4/8/9', '*', 'true', '2001:db8::/129']);
  });
  it('a list with no valid entry is ignored (never "trust everyone" and never silently "trust nobody"): the hop count or the default applies', () => {
    expect(resolveTrustProxy({ TRUSTED_PROXIES: 'nope', TRUST_PROXY_HOPS: '2' })).toEqual({ value: 2, source: 'TRUST_PROXY_HOPS', rejected: ['nope'] });
    expect(resolveTrustProxy({ TRUSTED_PROXIES: ',, ,' })).toEqual({ value: 1, source: 'DEFAULT', rejected: [] });
  });
  it('without the list the old hop count still works, with the old default of 1; nonsense falls back to 1', () => {
    expect(resolveTrustProxy({})).toEqual({ value: 1, source: 'DEFAULT', rejected: [] }); expect(resolveTrustProxy({ TRUST_PROXY_HOPS: '2' }).value).toBe(2); expect(resolveTrustProxy({ TRUST_PROXY_HOPS: '0' }).value).toBe(0);
    for (const v of ['abc', '-1', '99', '1.5', ' ']) expect([v, resolveTrustProxy({ TRUST_PROXY_HOPS: v }).value]).toEqual([v, 1]);
  });
  it('trustedProxyProblem accepts v4 and v6 addresses and subnets and the three words only', () => {
    for (const ok of ['10.0.0.5', '10.0.0.0/8', '::1', '2001:db8::/32', 'loopback', 'linklocal', 'uniquelocal']) expect([ok, trustedProxyProblem(ok)]).toEqual([ok, null]);
    for (const bad of ['', 'localhost', '10.0.0.5/33', '10.0.0.5/', '10.0.0/24', 'a.b.c.d', '0.0.0.0/0/0']) expect([bad, trustedProxyProblem(bad)]).not.toEqual([bad, null]);
  });
});

@Controller('probe')
class ProbeController {
  @Get('ip') ip(@Req() req: Request): { ip: string | undefined } { return { ip: req.ip }; }
  @Throttle({ reads: { limit: 2, ttl: 60_000 } }) @Get('limited') limited(): { ok: true } { return { ok: true }; }
}
async function appWith(setting: number | string[]): Promise<NestExpressApplication> {
  const mod = await Test.createTestingModule({ imports: [throttlerImport], controllers: [ProbeController], providers: [throttlerGuardProvider] }).compile();
  const app = mod.createNestApplication<NestExpressApplication>(); app.set('trust proxy', setting); await app.init(); return app;
}
// the test client connects from the loopback address, so "the configured proxy" is 127.0.0.1 and "some other server" is any list that leaves it out
const ipOf = async (app: NestExpressApplication, xff?: string): Promise<string | undefined> => (await request(app.getHttpServer()).get('/probe/ip').set(xff ? { 'X-Forwarded-For': xff } : {})).body.ip;
const peerOf = (ip: string | undefined): string => String(ip).replace('::ffff:', '');

describe('on a real Express app', () => {
  it('from the configured proxy the visitor address is read from X-Forwarded-For', async () => {
    const app = await appWith(['127.0.0.1', '::1']);
    try { expect(await ipOf(app, '203.0.113.9')).toBe('203.0.113.9'); expect(peerOf(await ipOf(app))).toBe('127.0.0.1'); } finally { await app.close(); }
  });
  it('from any OTHER peer the header is ignored, so nobody can choose their own address', async () => {
    const app = await appWith(['10.0.0.5']);
    try { expect(peerOf(await ipOf(app, '203.0.113.9'))).toBe('127.0.0.1'); expect(peerOf(await ipOf(app, '1.2.3.4, 5.6.7.8'))).toBe('127.0.0.1'); } finally { await app.close(); }
  });
  it('a chain through several configured proxies stops at the first address that is not one of them', async () => {
    const app = await appWith(['127.0.0.1', '198.51.100.0/24']);
    try { expect(await ipOf(app, '203.0.113.9, 198.51.100.7')).toBe('203.0.113.9'); expect(await ipOf(app, '9.9.9.9, 203.0.113.9, 198.51.100.7')).toBe('203.0.113.9'); } finally { await app.close(); }
  });
  it('the old behaviour is kept when only a hop count is set (it believes the peer one hop away)', async () => {
    const app = await appWith(1); try { expect(await ipOf(app, '203.0.113.9')).toBe('203.0.113.9'); } finally { await app.close(); }
  });
  it('THE POINT: behind the configured proxy each visitor has their own limit; from an unlisted peer, changing the header buys no extra requests', async () => {
    const trusted = await appWith(['127.0.0.1', '::1']);
    try {
      const hit = (v: string) => request(trusted.getHttpServer()).get('/probe/limited').set({ 'X-Forwarded-For': v });
      expect((await hit('203.0.113.1')).status).toBe(200); expect((await hit('203.0.113.1')).status).toBe(200); expect((await hit('203.0.113.1')).status).toBe(429);   // the same visitor is limited
      expect((await hit('203.0.113.2')).status).toBe(200); expect((await hit('203.0.113.3')).status).toBe(200);                                                           // another visitor is not
    } finally { await trusted.close(); }
    const unlisted = await appWith(['10.0.0.5']);
    try {
      const statuses: number[] = []; for (let i = 0; i < 4; i++) statuses.push((await request(unlisted.getHttpServer()).get('/probe/limited').set({ 'X-Forwarded-For': `203.0.113.${i + 10}` })).status);
      expect(statuses).toEqual([200, 200, 429, 429]);   // a new header each time does not dodge the limit
    } finally { await unlisted.close(); }
  });
  it('without the setting a shared proxy puts every visitor in one limit (the problem the gap describes)', async () => {
    const app = await appWith(0);
    try { const s: number[] = []; for (let i = 0; i < 3; i++) s.push((await request(app.getHttpServer()).get('/probe/limited').set({ 'X-Forwarded-For': `203.0.113.${i}` })).status); expect(s).toEqual([200, 200, 429]); } finally { await app.close(); }
  });
});
