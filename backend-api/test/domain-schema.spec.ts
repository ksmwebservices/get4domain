import { describeSchemaSlice, missingColumns, modelBlock } from './support/schema-checks';

/** B2 slice 5.6: subdomain rules and domain mapping. */
describeSchemaSlice('slice 5.6', {
  suffix: '_v3_domains', tables: ['g4d_domains', 'g4d_domain_verifications', 'g4d_redirects'], enums: ['V3DomainKind', 'V3DomainStatus', 'V3SslStatus'], fkTargets: ['Vendor'],
});

describe('slice 5.6 columns', () => {
  it('domains: unique hostname, kind, status, primary rule at database level, ssl status recorded only', () => {
    const b = modelBlock('g4d_domains');
    expect(b).toMatch(/hostname\s+String\s+@unique/);
    expect(missingColumns(b, ['kind', 'status', 'isPrimary', 'verifiedAt', 'sslStatus', 'createdByType', 'createdById', 'removedAt'])).toEqual([]);
    expect(b).toMatch(/primaryVendorId\s+String\?\s+@unique/);   // one primary per vendor, enforced by the database
  });
  it('verifications: method, expected value, attempts, last check, result', () => {
    const b = modelBlock('g4d_domain_verifications');
    expect(missingColumns(b, ['domainId', 'vendorId', 'method', 'expectedValue', 'lastCheckedAt', 'attempts', 'result'])).toEqual([]);
  });
  it('redirects: from and to host and path, status, source, active', () => {
    const b = modelBlock('g4d_redirects');
    expect(missingColumns(b, ['vendorId', 'fromHost', 'fromPath', 'toHost', 'toPath', 'status', 'source', 'active'])).toEqual([]);
    expect(b).toMatch(/@@unique\(\[fromHost, fromPath\]\)/);
  });
});
