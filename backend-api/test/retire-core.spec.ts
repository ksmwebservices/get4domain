import * as fs from 'fs';
import * as path from 'path';
import { featureKeyOf, INDUSTRY_MODULES, retiredModuleOf } from '../src/v3-retire/core/retire-core';

const src = path.resolve(__dirname, '../src');
const controllersOf = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? controllersOf(path.join(dir, e.name)) : e.name.endsWith('.controller.ts') ? [path.join(dir, e.name)] : [])) : []);
const prefixesIn = (f: string): string[] => [...fs.readFileSync(f, 'utf8').matchAll(/@Controller\(\s*'([^']*)'/g)].map((m) => m[1].split('/')[0]);

describe('which routes belong to a retired industry module', () => {
  it.each(INDUSTRY_MODULES.map((m) => [m]))('%s: its routes are recognised, with or without a query string', (m) => {
    expect(retiredModuleOf(`/${m}`)).toBe(m); expect(retiredModuleOf(`/${m}/orders/abc`)).toBe(m); expect(retiredModuleOf(`/${m}/orders?x=1`)).toBe(m);
  });
  it('travel contracts belong to travel', () => { expect(retiredModuleOf('/travel/contracts/42')).toBe('travel'); });
  it('only the first path segment decides: a V3 route, a lookalike and the root are never retired', () => {
    for (const p of ['/v3/me/store/products', '/v3/me/retail', '/retailer', '/travelling', '/agriculture-news', '/', '', '/health', '/me/agriculture', '//agriculture']) expect([p, retiredModuleOf(p)]).toEqual([p, null]);
  });
  it('the entitlement key of a module is industry.<module>', () => { expect(featureKeyOf('restaurant')).toBe('industry.restaurant'); });
  it('there are twenty-one retired modules, no duplicates', () => { expect(INDUSTRY_MODULES).toHaveLength(21); expect(new Set(INDUSTRY_MODULES).size).toBe(21); });
});

describe('no legacy industry route can escape the list (static scan of the controllers)', () => {
  it('every controller of an industry folder uses a prefix on the list', () => {
    for (const m of INDUSTRY_MODULES) {
      const files = controllersOf(path.join(src, m)); expect([m, files.length > 0]).toEqual([m, true]);
      for (const f of files) for (const p of prefixesIn(f)) expect([m, p, (INDUSTRY_MODULES as readonly string[]).includes(p)]).toEqual([m, p, true]);
    }
  });
  it('no controller outside the industry folders uses one of those prefixes (the guard would hide it by mistake)', () => {
    const others = controllersOf(src).filter((f) => !INDUSTRY_MODULES.some((m) => f.startsWith(path.join(src, m) + path.sep)));
    const clash = others.flatMap((f) => prefixesIn(f).filter((p) => (INDUSTRY_MODULES as readonly string[]).includes(p)).map((p) => `${path.relative(src, f)}: ${p}`));
    expect(clash).toEqual([]);
  });
});
