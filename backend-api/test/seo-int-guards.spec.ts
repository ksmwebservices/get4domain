import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { SeoPublicController } from '../src/seo-directory/api/seo-public.controller';

/**
 * Guards around test/seo-directory.int.spec.ts, which cannot run without staging: what the badge route answers for the URLs that suite expects to be 404, that every non-JSON read in the
 * suite reads text explicitly, that its afterAll restores every setting it touches even after a failure, and that the read-only staging checker never writes.
 */
const read = (...p: string[]) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
const fakeRes = () => { const r = { headers: {} as Record<string, string>, code: 0, body: '' as unknown, set(h: Record<string, string>) { Object.assign(r.headers, h); return r; }, status(c: number) { r.code = c; return r; }, send(b: unknown) { r.body = b; } }; return r; };
const controller = (known: string[]) => new SeoPublicController({} as never, { badge: async (id: string) => (known.includes(id) ? '<svg xmlns="http://www.w3.org/2000/svg"></svg>' : null) } as never, { get: async () => ({ directoryCacheSeconds: 300 }) } as never);

describe('the badge route answers what the staging suite expects', () => {
  it('a listed business gets 200 with the sandboxed SVG headers; the body is the SVG string', async () => {
    const res = fakeRes(); await controller(['b1']).badge('b1.svg', res as never);
    expect(res.code).toBe(200); expect(res.headers['Content-Type']).toBe('image/svg+xml; charset=utf-8'); expect(res.headers['Content-Security-Policy']).toContain("default-src 'none'"); expect(String(res.body).startsWith('<svg ')).toBe(true);
  });
  it.each(['nope.png', '../x.svg', 'a b.svg', 'b1', '.svg', 'b1.svg.png', `${'x'.repeat(65)}.svg`, '', 'b1.SVG'])('%j is a 404 (the file name must be {id}.svg), and the service is not even asked for a bad name', async (file) => {
    let asked = 0; const c = new SeoPublicController({} as never, { badge: async () => { asked++; return null; } } as never, { get: async () => ({ directoryCacheSeconds: 1 }) } as never);
    await expect(c.badge(file, fakeRes() as never)).rejects.toBeInstanceOf(NotFoundException);
    if (!/^[A-Za-z0-9_-]{1,64}\.svg$/.test(file)) expect(asked).toBe(0);
  });
  it('a removed, draft or unknown business is the same 404 (the service answers null)', async () => { await expect(controller([]).badge('gone.svg', fakeRes() as never)).rejects.toBeInstanceOf(NotFoundException); });
  it('the encoded form the suite sends, ..%2Fx.svg, reaches the route as "../x.svg" and is refused (and if the router never matched it, that is a 404 too)', async () => {
    expect(decodeURIComponent('..%2Fx.svg')).toBe('../x.svg'); await expect(controller(['x']).badge(decodeURIComponent('..%2Fx.svg'), fakeRes() as never)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('the staging suite file', () => {
  const src = read('test/seo-directory.int.spec.ts');
  it('reads every non-JSON answer as text, explicitly (the SVG and the XML would otherwise be a Buffer with no text)', () => {
    expect(src).toContain('.buffer(true).parse(');
    expect(src.split(String.fromCharCode(10)).filter((l) => /await get\([`'][^`']*(badge\/\$\{clickBiz\}|sitemaps\/(index|directory-))/.test(l))).toEqual([]);   // the success reads of the SVG and the XML never go through the plain get (the 404 checks may: their body is JSON)
    expect(src).not.toMatch(/badge\.text/); expect(src).not.toMatch(/chunk\.text|idx\.text/);
  });
  it('remembers every setting BEFORE it can be touched, and afterAll puts them back as its own step, so a failed test cannot leave one changed', () => {
    expect(src).toMatch(/for \(const k of \['seoPageTemplates', 'seoCrawlerAgents', 'seoKeywordModifiers'\]\) await remember\(k\)/);
    expect(src.indexOf("await remember(k)")).toBeLessThan(src.indexOf("await setSetting('directoryPagesIndexable', true)"));
    expect(src).toContain("await setSetting('directoryPagesIndexable', true); await setSetting('directoryThinPageMinBusinesses', 3);");   // setSetting remembers first
    expect(src).toMatch(/const setSetting = async \(k: string, v: unknown\) => \{ await remember\(k\);/);
    const after = src.slice(src.indexOf('afterAll(')); expect(after).toContain("del('settings'"); expect(after).toContain('await runCleanup([');
    expect(after).toMatch(/if \(p\.existed\) await prisma\.v3PlanSetting\.update\(\{ where: \{ key: k \}, data: \{ valueJson: p\.value as never \} \}\); else await prisma\.v3PlanSetting\.deleteMany\(\{ where: \{ key: k \} \}\)/);
    expect(src).not.toMatch(/restore.*inside the test|finally \{ await setSetting/);   // nothing relies on a test reaching its own restore line
  });
});

describe('runCleanup, which afterAll uses, runs every step even when one throws', () => {
  it('the settings step still runs after an earlier step fails, and the first failure is rethrown', async () => {
    const { runCleanup } = await import('./support/cleanup-guard'); const ran: string[] = [];
    await expect(runCleanup([async () => { ran.push('targets'); throw new Error('boom'); }, async () => { ran.push('settings'); }, async () => { ran.push('close'); }])).rejects.toThrow('boom');
    expect(ran).toEqual(['targets', 'settings', 'close']);
  });
});

describe('the read-only staging checker', () => {
  const s = read('scripts/seo-staging-check.js');
  it('only reads: one findMany on the settings table, no write of any kind, and it uses the staging guard', () => {
    expect(s).toContain('loadStagingEnv()'); expect(s).toContain('v3PlanSetting.findMany');
    expect(s).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$execute|\$queryRaw|\$transaction/);
  });
  it('exits 1 when directoryPagesIndexable is ON and 0 when it is OFF or never stored, and prints no connection string', () => {
    expect(s).toContain('process.exitCode = on ? 1 : 0'); expect(s).toContain("idx.valueJson === true"); expect(s).toContain('env.mask(');
    expect(s).not.toMatch(/console\.log\([^)]*DATABASE_URL|DIRECT_URL/);
  });
  it('the syntax is valid', () => { expect(() => new Function(s.replace(/^#!.*\n/, '').replace(/require\(/g, '(()=>({}))('))).not.toThrow(); });
});
