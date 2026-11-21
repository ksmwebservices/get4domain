import { connectHostFor, dnsRecordsFor, lapseRedirectFor, nextConnection, registrarSteps, REGISTRARS, redirectTargetFor } from '../src/v3-domain-automation/core/connection-core';

describe('connect host: www first, the bare domain is flagged', () => {
  it('a www host connects as it is and is not bare', () => {
    expect(connectHostFor('www.example.in')).toEqual({ connectHost: 'www.example.in', apex: 'example.in', bareDomain: false, label: 'www' });
  });
  it('a bare domain connects through its www host and is flagged as needing the Cloudflare option', () => {
    expect(connectHostFor('example.in')).toEqual({ connectHost: 'www.example.in', apex: 'example.in', bareDomain: true, label: 'www' });
    expect(connectHostFor('example.co.in')).toMatchObject({ connectHost: 'www.example.co.in', bareDomain: true });
  });
  it('a subdomain connects as it is', () => {
    expect(connectHostFor('shop.example.in')).toEqual({ connectHost: 'shop.example.in', apex: 'example.in', bareDomain: false, label: 'shop' });
    expect(connectHostFor('shop.example.co.in')).toMatchObject({ apex: 'example.co.in', label: 'shop', bareDomain: false });
  });
});

describe('the records a vendor must create', () => {
  const r = dnsRecordsFor({ hostname: 'example.in', txtName: '_g4d-verify.example.in', txtValue: 'g4d-verify=abc', cnameTarget: 'edge.get4domain.test' });
  it('lists type, host and value for the ownership check and the connection', () => {
    expect(r.records).toEqual([
      { purpose: 'OWNERSHIP', type: 'TXT', host: '_g4d-verify.example.in', hostLabel: '_g4d-verify', value: 'g4d-verify=abc' },
      { purpose: 'CONNECT', type: 'CNAME', host: 'www.example.in', hostLabel: 'www', value: 'edge.get4domain.test' },
    ]);
    expect(r.bareDomain?.needsCloudflareOption).toBe(true);
    expect(r.bareDomain?.text).toMatch(/bare/i);
  });
  it('omits the connection record, and says why, while the connection target is not set', () => {
    const n = dnsRecordsFor({ hostname: 'www.example.in', txtName: '_g4d-verify.www.example.in', txtValue: 'v', cnameTarget: null });
    expect(n.records.map((x) => x.purpose)).toEqual(['OWNERSHIP']);
    expect(n.connectNotice).toMatch(/not.*ready/i);
    expect(n.bareDomain).toBeNull();
  });
});

describe('per-registrar steps', () => {
  it('has steps for every listed registrar and a generic one, with no timeframe and no retired name', () => {
    expect(REGISTRARS).toEqual(expect.arrayContaining(['GODADDY', 'NAMECHEAP', 'HOSTINGER', 'BIGROCK', 'OTHER']));
    for (const k of REGISTRARS) {
      const s = registrarSteps(k, { bareDomain: true });
      expect(s.length).toBeGreaterThan(2);
      const text = s.join(' ');
      expect(text).not.toMatch(/\b(within|in|after)\s+\d+\s*(minutes?|hours?|days?)\b/i);
      expect(text).not.toMatch(/Workspace|BOS|LeadSpace/);
    }
  });
  it('GoDaddy steps say a bare domain cannot take a CNAME and point the vendor to the www host', () => {
    expect(registrarSteps('GODADDY', { bareDomain: true }).join(' ')).toMatch(/bare domain.*(cannot|can not|does not).*CNAME/i);
  });
});

describe('the connection state machine', () => {
  it('moves PENDING to VERIFYING when the hostname is created, then to ACTIVE when the certificate is active', () => {
    expect(nextConnection('PENDING', 'HOSTNAME_CREATED')).toBe('VERIFYING');
    expect(nextConnection('VERIFYING', 'CERT_PENDING')).toBe('VERIFYING');
    expect(nextConnection('VERIFYING', 'CERT_ACTIVE')).toBe('ACTIVE');
  });
  it('a failed certificate or an exhausted retry needs attention, and a retry can start again', () => {
    expect(nextConnection('VERIFYING', 'CERT_FAILED')).toBe('NEEDS_ATTENTION');
    expect(nextConnection('PENDING', 'GAVE_UP')).toBe('NEEDS_ATTENTION');
    expect(nextConnection('NEEDS_ATTENTION', 'RETRY')).toBe('PENDING');
  });
  it('refuses a move that makes no sense', () => {
    expect(nextConnection('ACTIVE', 'HOSTNAME_CREATED')).toBeNull();
    expect(nextConnection('PENDING', 'CERT_ACTIVE')).toBeNull();
  });
  it('an active connection can lose its certificate and then needs attention', () => {
    expect(nextConnection('ACTIVE', 'CERT_FAILED')).toBe('NEEDS_ATTENTION');
  });
});

describe('forward mode', () => {
  it('redirects to the subdomain, keeping a plain address', () => {
    expect(redirectTargetFor('FORWARD', 'www.example.in', 'shop.get4domain.test')).toEqual({ fromHost: 'www.example.in', toHost: 'shop.get4domain.test', status: 301 });
    expect(redirectTargetFor('CONNECT', 'www.example.in', 'shop.get4domain.test')).toBeNull();
  });
});

describe('plan expiry (owner answer Q11)', () => {
  it('an active connection lapses with the plan and comes back checking its certificate when Pro returns', () => {
    expect(nextConnection('ACTIVE', 'PLAN_LAPSED')).toBe('LAPSED');
    expect(nextConnection('LAPSED', 'PLAN_RESTORED')).toBe('VERIFYING');
  });
  it('a lapsed connection takes no certificate news and cannot lapse again', () => {
    expect(nextConnection('LAPSED', 'CERT_ACTIVE')).toBeNull();
    expect(nextConnection('LAPSED', 'PLAN_LAPSED')).toBeNull();
    expect(nextConnection('VERIFYING', 'PLAN_RESTORED')).toBeNull();
  });
  it('a lapsed connection redirects to the subdomain with a temporary redirect', () => {
    expect(lapseRedirectFor('www.example.in', 'shop.get4domain.test')).toEqual({ fromHost: 'www.example.in', toHost: 'shop.get4domain.test', status: 302 });
  });
});
