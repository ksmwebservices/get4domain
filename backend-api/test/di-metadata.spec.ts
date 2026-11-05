import 'reflect-metadata';
import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-compile-only-secret';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_compile_only';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'compile-only-secret';

/**
 * A constructor parameter typed as Pick<...>, an interface or a Record compiles to Object, which Nest cannot resolve. With @Optional() it does not even fail: the dependency is
 * silently undefined (this is how the serve-time listing-only strip never ran). Every injectable class must name such a parameter with @Inject(token).
 * Nest records @Inject under "self:paramtypes".
 */
const SRC = join(__dirname, '../src');
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') && !p.endsWith('.d.ts') && !p.endsWith(join('src', 'main.ts')) ? [p] : []; });

// Classes built by hand or by a factory (never resolved by type), with the reason.
const BY_HAND = new Set<string>([
  'provisioning/invites/email-adapter.ts#LiveEmailInviteAdapter',   // constructed by a factory in the invite module
  'common/pipes/edit-validation.pipe.ts#EditTolerantValidationPipe',   // built with new in buildValidationPipe(options)
]);

describe('dependency injection metadata', () => {
  it('no injectable constructor parameter compiles to Object without an @Inject token', () => {
    const bad: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).split(sep).join('/');
      let mod: Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      try { mod = require(file) as Record<string, unknown>; } catch { continue; }   // a file that needs the whole app to load is covered by the module compile specs
      for (const [name, cls] of Object.entries(mod)) {
        if (typeof cls !== 'function' || !Reflect.getMetadata('__injectable__', cls)) continue;
        if (BY_HAND.has(`${rel}#${name}`)) continue;
        const types = (Reflect.getMetadata('design:paramtypes', cls) ?? []) as unknown[];
        const self = (Reflect.getMetadata('self:paramtypes', cls) ?? []) as Array<{ index: number }>;
        types.forEach((t, i) => { if (t === Object && !self.some((s) => s.index === i)) bad.push(`${rel}#${name} parameter ${i}`); });
      }
    }
    expect(bad).toEqual([]);
  }, 120000);
});
