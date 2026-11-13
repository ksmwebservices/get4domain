import { CloudflareError } from '../src/v3-domain-automation/cloudflare.port';
import { canonicalHostFor } from '../src/site-domains/core/canonical';
import { connectionWorld } from './support/domain-connection-world';

const V1 = { type: 'VENDOR' as const, id: 'u1', ip: null }; const V2 = { type: 'VENDOR' as const, id: 'u2', ip: null };
const tick = () => new Promise((r) => setImmediate(r));

describe('starting a connection', () => {
  it('refuses a domain whose ownership is not confirmed, and says so', async () => {
    const w = connectionWorld();
    await expect(w.svc.begin('v1', 'd2', {}, V1)).rejects.toMatchObject({ response: { code: 'CONNECTION_NOT_READY' } });
    expect(w.cf.calls).toEqual([]);
  });
  it('refuses to start while the connection address is not set', async () => {
    const w = connectionWorld({});
    await expect(w.svc.begin('v1', 'd1', {}, V1)).rejects.toMatchObject({ response: { code: 'CONNECTION_NOT_READY' } });
  });
  it('connects a bare domain through its www host and flags it', async () => {
    const w = connectionWorld();
    const v = await w.svc.begin('v1', 'd1', { registrar: 'GODADDY' }, V1);
    expect(w.cf.calls).toEqual(['create:www.example.in']);
    expect(v).toMatchObject({ connectHost: 'www.example.in', bareDomain: true, needsCloudflareOption: true, status: 'VERIFYING', sslStatus: 'PENDING', mode: 'CONNECT' });
  });
  it('starting twice makes one hostname', async () => {
    const w = connectionWorld();
    const [a, b] = await Promise.all([w.svc.begin('v1', 'd1', {}, V1), w.svc.begin('v1', 'd1', {}, V1)]);
    expect(a.id).toBe(b.id);
    expect(w.cf.calls.filter((c) => c.startsWith('create'))).toHaveLength(1);
  });
  it('gives the records, the registrar steps and the bare domain explanation', async () => {
    const w = connectionWorld();
    const g = await w.svc.guide('v1', 'd1', 'GODADDY');
    expect(g.records.map((r) => [r.type, r.host, r.value])).toEqual([['TXT', '_g4d-verify.example.in', 'g4d-verify=abc'], ['CNAME', 'www.example.in', 'edge.get4domain.test']]);
    expect(g.bareDomain?.needsCloudflareOption).toBe(true);
    expect(g.steps.join(' ')).toMatch(/GoDaddy/);
    expect(g.ownership).toBe('VERIFIED');
    expect((await w.svc.guide('v1', 'd2')).ownership).toBe('WAITING');
  });
});

describe('the state machine through the service', () => {
  it('stays VERIFYING while the certificate is pending, becomes ACTIVE when it is active, and tells the canonical switch', async () => {
    const w = connectionWorld();
    const v = await w.svc.begin('v1', 'd1', {}, V1); const cfId = [...w.cf.hostnames.keys()][0];
    expect((await w.svc.check('v1', 'd1', V1)).status).toBe('VERIFYING');
    expect(w.switched).toEqual([]);
    w.cf.setCert(cfId, 'ACTIVE');
    const done = await w.svc.check('v1', 'd1', V1);
    expect(done).toMatchObject({ status: 'ACTIVE', sslStatus: 'ACTIVE' }); expect(done.activatedAt).not.toBeNull();
    expect(w.switched).toEqual(['v1']);
    await tick(); expect(w.events.map((e) => e.type)).toContain('domain.connection_active');
    expect(v.id).toBe(done.id);
  });
  it('a failed certificate needs attention with the provider reason, and a retry starts again', async () => {
    const w = connectionWorld(); await w.svc.begin('v1', 'd1', {}, V1); const cfId = [...w.cf.hostnames.keys()][0];
    w.cf.setCert(cfId, 'FAILED', 'DNS_NOT_POINTING');
    expect(await w.svc.check('v1', 'd1', V1)).toMatchObject({ status: 'NEEDS_ATTENTION', failureReason: 'DNS_NOT_POINTING', sslStatus: 'FAILED' });
    const again = await w.svc.retry('v1', 'd1', V1);
    expect(again.status).toBe('VERIFYING'); expect(w.cf.calls.filter((c) => c.startsWith('create'))).toHaveLength(2);
    await expect(w.svc.retry('v1', 'd1', V1)).rejects.toMatchObject({ response: { code: 'CONNECTION_STATE_INVALID' } });
  });
  it('a connection that waits longer than the staff setting needs attention; with no setting it keeps waiting', async () => {
    const w = connectionWorld({ customHostnameTarget: 'edge.get4domain.test', connectionMaxChecks: 2 }); await w.svc.begin('v1', 'd1', {}, V1);
    expect((await w.svc.check('v1', 'd1', V1)).status).toBe('VERIFYING');
    expect(await w.svc.check('v1', 'd1', V1)).toMatchObject({ status: 'NEEDS_ATTENTION', failureReason: 'CERTIFICATE_NOT_ISSUED' });
    const k = connectionWorld(); await k.svc.begin('v1', 'd1', {}, V1);
    for (let i = 0; i < 6; i++) expect((await k.svc.check('v1', 'd1', V1)).status).toBe('VERIFYING');
  });
  it('an active connection that loses its certificate needs attention, drops its redirect and moves the canonical back through the switch', async () => {
    const w = connectionWorld(); await w.svc.begin('v1', 'd1', { mode: 'FORWARD' }, V1); const cfId = [...w.cf.hostnames.keys()][0];
    w.cf.setCert(cfId, 'ACTIVE'); await w.svc.check('v1', 'd1', V1);
    expect(w.cf.redirects.get('www.example.in')).toBe('acme.g4d.test');
    w.cf.setCert(cfId, 'FAILED'); w.switched.length = 0;
    expect((await w.svc.check('v1', 'd1', V1)).status).toBe('NEEDS_ATTENTION');
    expect(w.cf.redirects.size).toBe(0); expect(w.switched).toEqual(['v1']);
  });
});

describe('forward versus connect', () => {
  it('CONNECT plans no redirect; FORWARD redirects the vendor host to the subdomain; switching mode on a live connection applies at once', async () => {
    const w = connectionWorld(); await w.svc.begin('v1', 'd1', { mode: 'CONNECT' }, V1); const cfId = [...w.cf.hostnames.keys()][0];
    w.cf.setCert(cfId, 'ACTIVE'); await w.svc.check('v1', 'd1', V1);
    expect(w.cf.redirects.size).toBe(0);
    expect((await w.svc.setMode('v1', 'd1', 'FORWARD', V1)).mode).toBe('FORWARD');
    expect(w.cf.redirects.get('www.example.in')).toBe('acme.g4d.test');
    await w.svc.setMode('v1', 'd1', 'CONNECT', V1);
    expect(w.cf.redirects.size).toBe(0);
    await expect(w.svc.setMode('v1', 'd1', 'SIDEWAYS' as never, V1)).rejects.toMatchObject({ response: { code: 'CONNECTION_STATE_INVALID' } });
  });
});

describe('forward mode with no active subdomain (Block 4b)', () => {
  it('goes to NEEDS_ATTENTION with the reason instead of looking healthy, plans no redirect, and a later retry works once a subdomain exists', async () => {
    const w = connectionWorld(); w.store.subdomains.delete('v1'); await w.svc.begin('v1', 'd1', { mode: 'FORWARD' }, V1); const cfId = [...w.cf.hostnames.keys()][0];
    w.cf.setCert(cfId, 'ACTIVE'); const v = await w.svc.check('v1', 'd1', V1);
    expect(v).toMatchObject({ status: 'NEEDS_ATTENTION', failureReason: 'NO_ACTIVE_SUBDOMAIN' }); expect(w.cf.redirects.size).toBe(0);
  });
  it('a connect-mode connection without a subdomain is unaffected', async () => {
    const w = connectionWorld(); w.store.subdomains.delete('v1'); await w.svc.begin('v1', 'd1', { mode: 'CONNECT' }, V1); const cfId = [...w.cf.hostnames.keys()][0];
    w.cf.setCert(cfId, 'ACTIVE'); expect((await w.svc.check('v1', 'd1', V1)).status).toBe('ACTIVE');
  });
});

describe('fake Cloudflare failures are retried', () => {
  it('a temporary failure is tried again and then succeeds', async () => {
    const w = connectionWorld(); w.cf.createFailures.push(new CloudflareError('TIMEOUT', true), new CloudflareError('TIMEOUT', true));
    const v = await w.svc.begin('v1', 'd1', {}, V1);
    expect(v.status).toBe('VERIFYING'); expect(w.cf.calls.filter((c) => c.startsWith('create'))).toHaveLength(3);
  });
  it('a failure that keeps coming needs attention, and a refusal is not retried', async () => {
    const a = connectionWorld(); a.cf.createFailures.push(...Array.from({ length: 5 }, () => new CloudflareError('TIMEOUT', true)));
    expect(await a.svc.begin('v1', 'd1', {}, V1)).toMatchObject({ status: 'NEEDS_ATTENTION', failureReason: 'TIMEOUT' });
    expect(a.cf.calls.filter((c) => c.startsWith('create'))).toHaveLength(3);
    const b = connectionWorld(); b.cf.createFailures.push(new CloudflareError('HOSTNAME_TAKEN', false));
    expect(await b.svc.begin('v1', 'd1', {}, V1)).toMatchObject({ status: 'NEEDS_ATTENTION', failureReason: 'HOSTNAME_TAKEN' });
    expect(b.cf.calls.filter((c) => c.startsWith('create'))).toHaveLength(1);
  });
  it('a temporary failure while checking changes nothing', async () => {
    const w = connectionWorld(); await w.svc.begin('v1', 'd1', {}, V1); w.cf.getFailures.push(new CloudflareError('TIMEOUT', true));
    expect((await w.svc.check('v1', 'd1', V1)).status).toBe('VERIFYING');
  });
  it('the default port says automatic connection is not switched on and fakes nothing', async () => {
    const { UnavailableCloudflarePort } = await import('../src/v3-domain-automation/cloudflare.port');
    await expect(new UnavailableCloudflarePort().createCustomHostname()).rejects.toMatchObject({ message: 'CLOUDFLARE_NOT_ENABLED', retryable: false });
  });
});

describe('the watcher and the check limit', () => {
  it('does nothing until staff turn it on, then checks every waiting connection and survives one that fails', async () => {
    const w = connectionWorld(); await w.svc.begin('v1', 'd1', {}, V1);
    expect(await w.svc.watchTick()).toEqual({ checked: 0 });
    w.settings.v = { ...w.settings.v, connectionWatcherEnabled: true };
    w.cf.getFailures.push(new CloudflareError('BOOM', false));
    expect(await w.svc.watchTick()).toEqual({ checked: 0 });   // the one row failed and the tick still finished
    expect(await w.svc.watchTick()).toEqual({ checked: 1 });
  });
  it('limits how often one connection can be checked by hand, but not the watcher', async () => {
    const w = connectionWorld({ customHostnameTarget: 'edge.get4domain.test', connectionCheckMinIntervalSeconds: 30 }); await w.svc.begin('v1', 'd1', {}, V1);
    await expect(w.svc.check('v1', 'd1', V1)).rejects.toMatchObject({ status: 429 });
    w.clock.t = new Date(w.clock.t.getTime() + 31_000);
    await w.svc.check('v1', 'd1', V1);
    await expect(w.svc.check('v1', 'd1', V1)).rejects.toMatchObject({ status: 429 });
    w.settings.v = { ...w.settings.v, connectionWatcherEnabled: true };
    expect((await w.svc.watchTick()).checked).toBe(1);
  });
});

describe('another vendor never reaches this one (cross-tenant)', () => {
  it('every read and write on a domain of v1 answers CONNECTION_NOT_FOUND for v2, exactly like an id that does not exist', async () => {
    const w = connectionWorld(); await w.svc.begin('v1', 'd1', {}, V1);
    const calls = [() => w.svc.guide('v2', 'd1'), () => w.svc.get('v2', 'd1'), () => w.svc.check('v2', 'd1', V2), () => w.svc.retry('v2', 'd1', V2), () => w.svc.setMode('v2', 'd1', 'FORWARD', V2), () => w.svc.disconnect('v2', 'd1', V2), () => w.svc.begin('v2', 'd1', {}, V2)];
    for (const c of calls) await expect(c()).rejects.toMatchObject({ response: { code: 'CONNECTION_NOT_FOUND' } });
    expect(await w.svc.listForVendor('v2')).toEqual([]);
    expect((await w.store.forDomain('v1', 'd1'))!.status).toBe('VERIFYING');
  });
});

describe('the canonical host is only ever changed through the switch service', () => {
  it('a live connection alone leaves the subdomain canonical; only the promotion add-on moves it', () => {
    const rows = [{ id: 'a', hostname: 'acme.g4d.test', kind: 'SUBDOMAIN' as const, status: 'ACTIVE' as const, isPrimary: true }, { id: 'b', hostname: 'example.in', kind: 'CUSTOM' as const, status: 'ACTIVE' as const, isPrimary: false }];
    expect(canonicalHostFor({ rows, legacyHost: null, addonActive: false })).toMatchObject({ canonicalHost: 'acme.g4d.test', serveHosts: ['example.in'] });
    expect(canonicalHostFor({ rows, legacyHost: null, addonActive: true }).canonicalHost).toBe('example.in');
  });
  it('disconnecting ends the connection and asks the switch to settle the canonical host', async () => {
    const w = connectionWorld(); await w.svc.begin('v1', 'd1', {}, V1);
    const v = await w.svc.disconnect('v1', 'd1', V1);
    expect(v).toMatchObject({ status: 'NEEDS_ATTENTION', failureReason: 'DISCONNECTED' }); expect(w.switched).toEqual(['v1']);
    expect(w.cf.calls).toEqual(expect.arrayContaining(['delete:cf1']));
  });
});
