import * as fs from 'fs';
import * as path from 'path';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { DraftFieldDto } from '../src/v3-website/api/dto/website.dto';
import { WEBSITE_ERROR_CODES } from '../src/v3-website/website.errors';

/**
 * Two wiring facts the staging run found that the service-level unit tests could not see (they bypass the HTTP layer):
 * 1. the app-wide validation pipe refuses any DTO property that has no validator, so the field body must declare `value`;
 * 2. the exception filter passes a `code` through only when it is on a registered list, so every code this module emits must be on WEBSITE_ERROR_CODES.
 */
describe('Website manager wiring (HTTP layer)', () => {
  it('the field body {key, value} passes the global validation pipe, for text, lists and null alike', async () => {
    const pipe = buildValidationPipe();
    for (const value of ['V3TEST Plumbing you can trust', ['a', 'b'], null, 12]) {
      const out = (await pipe.transform({ key: 'hero.title', value }, { type: 'body', metatype: DraftFieldDto })) as DraftFieldDto;
      expect(out.key).toBe('hero.title');
      expect(out.value).toEqual(value);
    }
  });

  it('an unknown property on the field body is still refused (the whitelist stays strict)', async () => {
    await expect(buildValidationPipe().transform({ key: 'hero.title', value: 'x', extra: 1 }, { type: 'body', metatype: DraftFieldDto })).rejects.toBeDefined();
  });

  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));

  it('every error code the module throws is on the list the exception filter passes through', () => {
    const root = path.resolve(__dirname, '../src/v3-website');
    const thrown = new Set<string>();
    for (const f of walk(root)) {
      if (f.endsWith('website.errors.ts')) continue;
      const text = fs.readFileSync(f, 'utf8');
      // call sites that build an error body from a literal code, and the cores' `code: 'X'` problem objects
      for (const m of text.matchAll(/(?:wmBody|mediaProblem|fieldProblem|err)\(\s*(?:'(?:forbidden|conflict|notfound|unprocessable)',\s*)?'([A-Z][A-Z0-9_]{4,})'/g)) thrown.add(m[1]);
      for (const m of text.matchAll(/code:\s*'([A-Z][A-Z0-9_]{4,})'/g)) thrown.add(m[1]);
    }
    const errorsFile = fs.readFileSync(path.join(root, 'website.errors.ts'), 'utf8');
    for (const m of errorsFile.matchAll(/(?:wmBody|MEDIA_STATUS[^\n]*?)\(?'([A-Z][A-Z0-9_]{4,})'/g)) thrown.add(m[1]);
    expect(thrown.size).toBeGreaterThan(20);
    const listed = new Set<string>(WEBSITE_ERROR_CODES);
    const missing = [...thrown].filter((c) => !listed.has(c));
    expect(missing).toEqual([]);
  });
});
