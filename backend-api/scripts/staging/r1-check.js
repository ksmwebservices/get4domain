#!/usr/bin/env node
'use strict';
/**
 * R1 staging check (STAGING ONLY). The real integration settings service, the real platform settings table and the real activity log on the staging database; the registrar adapter with a SCRIPTED http port and
 * the integration probe replaced by a fake. NOTHING calls ResellerClub, Resend or Anthropic: no real provider is reachable from here. Secrets are made at run time. Everything it writes (the settings rows of the
 * integrations category and its audit rows) is removed again; it refuses to start if any integration setting already exists on staging.
 *
 *   node scripts/staging/r1-check.js
 */
const path = require('path');
const crypto = require('crypto');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
require('reflect-metadata');
const { loadStagingEnv } = require('./guard');
const BACKEND = path.resolve(__dirname, '..', '..');
const src = (p) => require(path.join(BACKEND, 'src', p));
const secret = () => crypto.randomBytes(18).toString('hex');

(async () => {
  const conn = loadStagingEnv();
  process.env.DATABASE_URL = conn.DATABASE_URL; process.env.DIRECT_URL = conn.DIRECT_URL;
  const ownKey = !conn.PLATFORM_SETTINGS_KEY;
  process.env.PLATFORM_SETTINGS_KEY = conn.PLATFORM_SETTINGS_KEY || secret();   // a random one for this run when staging has none: the rows are removed again
  for (const k of ['RESELLERCLUB_AUTH_USERID', 'RESELLERCLUB_API_KEY', 'RESELLERCLUB_API_BASE', 'REGISTRAR_LIVE_SEARCH', 'REGISTRAR_LIVE_PURCHASE', 'RESEND_API_KEY', 'CLAUDE_API_KEY']) delete process.env[k];
  process.env.NODE_ENV = 'test';
  const { Test } = require(path.join(BACKEND, 'node_modules/@nestjs/testing'));
  const { PrismaModule } = src('prisma/prisma.module'); const { V3ActivityModule } = src('v3-activity/activity.module');
  const { V3IntegrationsModule } = src('v3-integrations/integrations.module');
  const { IntegrationProbe } = src('v3-integrations/integration-probe');
  const { IntegrationSettingsService } = src('v3-integrations/integration-settings.service');
  const { INTEGRATION_CATEGORY } = src('v3-integrations/integrations-core');
  const { PrismaService } = src('prisma/prisma.service');
  const calls = []; let answer = 'OK';
  const fakeProbe = { probe: async (provider, values) => { calls.push({ provider, values }); return answer; } };
  const mod = await Test.createTestingModule({ imports: [PrismaModule, V3ActivityModule, V3IntegrationsModule] }).overrideProvider(IntegrationProbe).useValue(fakeProbe).compile();
  const app = mod.createNestApplication(); await app.init();
  const prisma = app.get(PrismaService); const svc = app.get(IntegrationSettingsService);
  let failed = 0; const check = (name, ok, extra = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); };
  const actor = { id: 'v3test-r1-super', ip: '10.9.9.9' };
  const before = await prisma.platformSetting.count({ where: { category: INTEGRATION_CATEGORY } });
  if (before > 0) { console.log(`REFUSED: ${before} integration setting row(s) already exist on staging; this check does not touch them.`); await app.close(); process.exit(3); }
  const out = []; const secrets = [];
  try {
    const rc = { resellerId: '88776655', apiKey: `rc-${secret()}`, mode: 'demo' }; secrets.push(rc.apiKey);
    const em = { apiKey: `re_${secret()}`, sender: 'Get4Domain <hello@example.com>' }; secrets.push(em.apiKey);
    const cl = { apiKey: `sk-ant-${secret()}`, monthlyCapRupees: 2500 }; secrets.push(cl.apiKey);

    const s1 = await svc.set('resellerclub', rc, actor); out.push(s1);
    check('ResellerClub saved: the status says SET with who and when, and the key reads only "set"', s1.state === 'SET' && s1.setBy === actor.id && s1.setAt instanceof Date && s1.fields.find((f) => f.field === 'apiKey').state === 'set' && !('value' in s1.fields.find((f) => f.field === 'apiKey')));
    const rows = await prisma.platformSetting.findMany({ where: { category: INTEGRATION_CATEGORY } });
    check('the rows are in their own category and encrypted at rest (no stored value equals or contains a secret or the reseller id)', rows.length === 3 && rows.every((r) => r.encrypted && r.value.split(':').length === 3 && !r.value.includes(rc.apiKey) && !r.value.includes(rc.resellerId)), `${rows.length} rows`);
    out.push(await svc.set('email', em, actor), await svc.set('claude', cl, actor));
    const all = await svc.status(); out.push(all);
    check('the list covers ResellerClub, e-mail, WhatsApp, SMS and Claude; WhatsApp and SMS are NOT_AVAILABLE', all.map((p) => p.provider).join() === 'resellerclub,email,whatsapp,sms,claude' && all.filter((p) => p.state === 'NOT_AVAILABLE').map((p) => p.provider).join() === 'whatsapp,sms');
    check('the Claude monthly cap is a plain setting that can be shown; its key is not', JSON.stringify(all.find((p) => p.provider === 'claude').fields).includes('2500') && !JSON.stringify(all).includes(cl.apiKey));
    check('the decrypted set reaches an adapter and nobody else', JSON.stringify(await svc.resolve('resellerclub')) === JSON.stringify(rc));

    // the registrar adapter reads the SAVED keys and the saved mode (a scripted http port: no network)
    const { RegistrarHttp, ResellerClubAdapter } = src('v3-registrar/resellerclub.adapter');
    const sent = [];
    class Scripted extends RegistrarHttp { async send(r) { sent.push(r); return { status: 200, body: { 'abc.com': { status: 'available' } } }; } }
    const adapter = new ResellerClubAdapter(new Scripted(), () => ({}), async () => { const v = await svc.resolve('resellerclub'); return v ? { userId: v.resellerId, apiKey: v.apiKey, mode: v.mode === 'live' ? 'live' : 'demo' } : null; });
    const hits = await adapter.search('abc', ['com']);
    check('the adapter uses the saved reseller id and key on the demo base, and reads "available" only because the (scripted) registrar said so', hits[0].status === 'AVAILABLE' && sent[0].base === 'https://test.httpapi.com/api' && sent[0].params.some(([k, v]) => k === 'auth-userid' && v === rc.resellerId) && sent[0].params.some(([k, v]) => k === 'api-key' && v === rc.apiKey));
    await svc.set('resellerclub', { ...rc, mode: 'live' }, actor);
    await adapter.search('abc', ['com']);
    check('after the mode is changed to live the adapter uses the production base', sent[1].base === 'https://httpapi.com/api');

    // the product port, with the domain-search switch off: refused before any request is built
    const { REGISTRAR_PROVIDERS } = src('v3-registrar/registrar.module'); const { RegistrarPort } = src('v3-registrar/registrar.port');
    const prov = REGISTRAR_PROVIDERS.find((p) => typeof p === 'object' && 'provide' in p && p.provide === RegistrarPort);
    const sent2 = []; class Scripted2 extends RegistrarHttp { async send(r) { sent2.push(r); return { status: 200, body: {} }; } }
    const port = prov.useFactory(new Scripted2(), svc);
    let refused = ''; try { await port.search('abc', ['com']); } catch (e) { refused = e.code; }
    check('the product registrar port, with the switch off, refuses a read and builds no request even with saved keys', refused === 'REGISTRAR_LIVE_DISABLED' && sent2.length === 0);
    process.env.REGISTRAR_LIVE_SEARCH = 'true';
    try { await port.search('abc', ['com']); } finally { delete process.env.REGISTRAR_LIVE_SEARCH; }
    check('with the switch on (scripted http, still no network) the product port uses the saved live keys', sent2.length === 1 && sent2[0].base === 'https://httpapi.com/api' && sent2[0].params.some(([k, v]) => k === 'api-key' && v === rc.apiKey));

    // the TEST route (fake probe) and the audit
    out.push(await svc.test('resellerclub', actor)); answer = 'REJECTED'; out.push(await svc.test('email', actor));
    check('TEST passes the saved set to the probe and returns a state and a sentence; WhatsApp is NOT_AVAILABLE without a call', calls.length === 2 && calls[0].provider === 'resellerclub' && (await svc.test('whatsapp', actor)).state === 'NOT_AVAILABLE' && calls.length === 2);
    const audits = await prisma.v3ActivityLog.findMany({ where: { entityType: 'Integration', actorId: actor.id } });
    check('every change and test left an audit row with field names or a state only', audits.length >= 7 && audits.some((a) => a.actionKey === 'integration.set') && audits.some((a) => a.actionKey === 'integration.tested') && secrets.every((s) => !JSON.stringify(audits).includes(s)) && !JSON.stringify(audits).includes(rc.resellerId), `${audits.length} rows`);
    check('no secret appears in anything the service answered', secrets.every((s) => !JSON.stringify(out).includes(s)));

    await svc.clear('claude', actor); await svc.clear('email', actor); await svc.clear('resellerclub', actor);
    check('clearing removes every row', (await prisma.platformSetting.count({ where: { category: INTEGRATION_CATEGORY } })) === 0 && (await svc.resolve('resellerclub')) === null);
  } catch (e) {
    failed += 1; console.log(`FAIL  unexpected error: ${conn.mask(String((e && e.stack) || e)).split('\n').slice(0, 4).join(' | ')}`);
  } finally {
    await prisma.platformSetting.deleteMany({ where: { category: INTEGRATION_CATEGORY } });
    const gone = await prisma.v3ActivityLog.deleteMany({ where: { entityType: 'Integration', actorId: actor.id } });
    console.log(`cleanup: integration rows removed, ${gone.count} audit rows removed${ownKey ? ' (a random master key was used for this run)' : ''}`);
    check('nothing is left on staging', (await prisma.platformSetting.count({ where: { category: INTEGRATION_CATEGORY } })) === 0 && (await prisma.v3ActivityLog.count({ where: { entityType: 'Integration', actorId: actor.id } })) === 0);
    await app.close();
  }
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(String((e && e.stack) || e).slice(0, 800)); process.exit(1); });
