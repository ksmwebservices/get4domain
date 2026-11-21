import * as fs from 'fs';
import * as path from 'path';
import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';
import { scopeArgs } from '../src/common/tenant/scope-args';
import { findLegacyUse } from './support/legacy-scan';

/** S53.8 (static part): the new modules obey decision D1 (no legacy table or module), the tenant rules cover the new tables, and the staging cleanup knows them. */
const src = path.resolve(__dirname, '../src');
const tsFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
const provisioningFiles = tsFiles(path.join(src, 'provisioning'));
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('provisioning code never touches a legacy table or module (decision D1)', () => {
  it('there is provisioning code to scan', () => { expect(provisioningFiles.length).toBeGreaterThan(20); });

  it('no file under src/provisioning imports or queries a legacy billing, BOS, commercial, add-on, module or registry table or constant', () => {
    const offenders = provisioningFiles.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((hit) => `${path.relative(src, f)}: ${hit}`));
    expect(offenders).toEqual([]);
  });

  it('it never creates a vendor through VendorsService (real welcome email with a plaintext password, wallet credit) or the registration path', () => {
    const bad = provisioningFiles.filter((f) => /vendors\/vendors\.service|auth\/auth\.service|sendWelcomeEmail|grantCredit|wallet\//.test(code(f)));
    expect(bad.map((f) => path.relative(src, f))).toEqual([]);
  });

  it('only the guarded live adapter and the unit that wraps it reach the mail service; nothing else in provisioning sends mail', () => {
    const users = provisioningFiles.filter((f) => /sendPlainText|EmailService/.test(code(f))).map((f) => path.relative(src, f).replace(/\\/g, '/')).sort();
    expect(users).toEqual([
      'provisioning/claims/claims.service.ts',          // passes the service to the shared delivery code
      'provisioning/invites/email-adapter.ts',          // the adapters (live is guarded OFF)
      'provisioning/invites/invite-service.ts',
      'provisioning/steps/send-invite.step.ts',
    ]);
  });

  it('no raw token is ever passed to a logger or an audit call by name', () => {
    for (const f of provisioningFiles) {
      const c = code(f);
      expect({ file: path.relative(src, f), hit: /(logger|Logger)\.\w+\([^)]*(rawToken|token\b)/.test(c) }).toEqual({ file: path.relative(src, f), hit: false });
      expect({ file: path.relative(src, f), hit: /audit\.record\([^;]*rawToken/.test(c) }).toEqual({ file: path.relative(src, f), hit: false });
    }
  });
});

describe('tenant rules cover the new tables', () => {
  const opts = { vendorId: 'A', vendorModels: VENDOR_SCOPED_MODELS, sharedModels: new Set<string>() };
  it('claim tokens, invites and jobs carry a vendorId and are tenant-scoped', () => {
    for (const m of ['V3ClaimToken', 'V3Invite', 'V3ProvisioningJob']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(true);
  });
  it('a tenant-scoped read is confined to the caller and a cross-vendor read or write is refused', () => {
    expect(scopeArgs('V3Invite', 'findMany', {}, opts)).toEqual({ where: { vendorId: 'A' } });
    expect(scopeArgs('V3ClaimToken', 'findMany', { where: { status: 'ACTIVE' } }, opts)).toEqual({ where: { status: 'ACTIVE', vendorId: 'A' } });
    expect(() => scopeArgs('V3Invite', 'findMany', { where: { vendorId: 'B' } }, opts)).toThrow();
    expect(() => scopeArgs('V3ClaimToken', 'create', { data: { vendorId: 'B', tokenHash: 'x' } }, opts)).toThrow();
  });
  it('the steps table has no vendor and is refused to a tenant client', () => {
    expect(VENDOR_SCOPED_MODELS.has('V3ProvisioningStep')).toBe(false);
    expect(() => scopeArgs('V3ProvisioningStep', 'findMany', {}, opts)).toThrow();
  });
});

describe('the staging cleanup removes what the provisioning tests create', () => {
  const cleanup = fs.readFileSync(path.resolve(__dirname, '../scripts/staging/test-tenant-cleanup.js'), 'utf8');
  it.each(['v3ProvisioningJob', 'v3Invite', 'v3ClaimToken', 'vendorCMS', 'v3AuditLog'])('test-tenant-cleanup.js deletes %s', (model) => {
    expect(cleanup).toContain(`prisma.${model}.`);
  });
});
