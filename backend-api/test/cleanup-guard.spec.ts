import * as fs from 'fs';
import * as path from 'path';
import { runCleanup } from './support/cleanup-guard';

/** B2.0: the staging suites' cleanup must run every step even when an earlier one throws, and must still report the first failure. */
describe('runCleanup', () => {
  it('runs every step in order when all succeed', async () => {
    const seen: string[] = [];
    await runCleanup([async () => { seen.push('a'); }, async () => { seen.push('b'); }, async () => { seen.push('c'); }]);
    expect(seen).toEqual(['a', 'b', 'c']);
  });
  it('a failing step does not stop the later steps (the tenant cleanup still runs), and the first failure is rethrown at the end', async () => {
    const seen: string[] = [];
    await expect(runCleanup([
      async () => { seen.push('prices'); throw new Error('first'); },
      async () => { seen.push('tenants'); },
      async () => { seen.push('close'); throw new Error('second'); },
    ])).rejects.toThrow('first');
    expect(seen).toEqual(['prices', 'tenants', 'close']);
  });
  it('skips missing steps (a resource that never got created)', async () => {
    const seen: string[] = [];
    await runCleanup([undefined, null, async () => { seen.push('x'); }]);
    expect(seen).toEqual(['x']);
  });
  it('the 5.1 plans suites use it in afterAll (no bare cleanup call that an earlier error can skip)', () => {
    for (const f of ['plans-admin', 'plans-entitlements', 'plans-tenant']) {
      const src = fs.readFileSync(path.resolve(__dirname, `${f}.int.spec.ts`), 'utf8');
      expect(src).toContain('runCleanup(');
      expect(src).toContain('cleanupTenants');
    }
  });
});
