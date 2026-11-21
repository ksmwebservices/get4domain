import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Owner rule 9 (B3.0b): the only state that hides a site or listing is REMOVED. The public directory and by-host paths must never consult the vendor's status.
 * A static guard, so a later change cannot quietly bring back "suspended = hidden".
 */
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const read = (p: string): string => readFileSync(p, 'utf8');

describe('B3.0b status policy (static)', () => {
  it('the public directory code never reads the vendor status', () => {
    const offenders = walk(join(__dirname, '..', 'src', 'directory')).filter((f) => /vendor\.status|vendor\?\.status|status:\s*['"]SUSPENDED['"]\s*\}\s*\}.*vendor/.test(read(f)));
    expect(offenders).toEqual([]);
  });
  it('the by-host resolvers do not refuse on SUSPENDED', () => {
    for (const f of ['src/site-domains/host-directory.ts', 'src/site-publish/publish/prisma-site.repository.ts']) {
      const code = read(join(__dirname, '..', f)).split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/**'));
      expect(code.filter((l) => /status\s*[!=]==?\s*'SUSPENDED'/.test(l))).toEqual([]);
    }
  });
});
