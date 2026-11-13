import * as fs from 'fs';
import * as path from 'path';
import { ArgumentsHost, ConflictException } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PACK_ERROR_CODES } from '../src/v3-packs/pack.errors';
import { ADMIN_ROLE_MATRIX, rolesFor } from '../src/auth/guards/admin-role-matrix';
import { findLegacyUse } from './support/legacy-scan';

/**
 * Static and wiring checks of the pack engine (Amendment 13 Part A): the engine never touches a legacy table or module, its pure cores have no clock, file system or database, nothing in it names a price,
 * every error code it throws goes through the real exception filter, every tenant query names the vendor, and the staff routes follow the role rules of the amendment.
 */
const src = path.resolve(__dirname, '../src');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
const files = walk(path.join(src, 'v3-packs'));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function passThrough(c: string): unknown {
  let body: Record<string, unknown> = {};
  const res = { status: () => ({ json: (b: Record<string, unknown>) => { body = b; } }) };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'POST', url: '/v3/test', headers: {} }) }) } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(new ConflictException({ message: 'x', code: c }), host);
  return body.code;
}

describe('the pack engine and the legacy world', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(8); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, add-on or module table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('nothing imports a legacy module folder, and the V2 CategoryPack model is untouched', () => {
    const LEGACY = 'crm|customer|domainapp|accounting|retail|restaurant|agriculture|diagnostics|hotel|clinic|salon|gym|events|travel|bos|wallet|domains|site-doc|themes|cms|engine|domain-campaign|leadspace|leads|admin-crm|demo|widget|quotes|campaigns|campaign-pages';
    expect(files.filter((f) => new RegExp(`from\\s+'(\\.\\./)+(${LEGACY})(/|')`).test(code(f))).map(rel)).toEqual([]);
    expect(files.filter((f) => /\bcategoryPack\b|\bprisma\.category\b/.test(code(f))).map(rel)).toEqual([]);
  });
  it('no Redis, BullMQ or queue library; no console output, raw SQL, live call or key read', () => {
    expect(files.filter((f) => /bullmq|from 'bull'|ioredis|from 'redis'/i.test(code(f))).map(rel)).toEqual([]);
    expect(files.filter((f) => /console\.(log|warn|error)|\$executeRaw|\$queryRaw/.test(code(f))).map(rel)).toEqual([]);
    expect(files.filter((f) => /\bfetch\(|process\.env|https?:\/\//.test(code(f))).map(rel)).toEqual([]);
  });
  it('no retired product name, rupee price or timeframe in any text this engine writes', () => {
    const FRAME = /\b(?:within|in|every|after|for)\s+(?:\d+|a|one|two|three|seven|thirty)\s*(?:hours?|days?|weeks?|months?|minutes?|years?)\b/i;
    expect(files.filter((f) => /\b(Workspace|BOS|LeadSpace)\b|₹\s*\d|Rs\.?\s*\d/.test(code(f)) || FRAME.test(code(f))).map(rel)).toEqual([]);
  });
  it('the pure cores have no clock, randomness, network, file system or database', () => {
    const cores = files.filter((x) => /\/core\//.test(x.replace(/\\/g, '/')));
    expect(cores.length).toBe(2);
    for (const f of cores) expect(code(f)).not.toMatch(/Date\.now|new Date\(|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|require\(|prisma|PrismaService|process\.env/);
  });
  it('every tenant query in the Prisma store names the vendor, and the reference queries never do', () => {
    const c = code(path.join(src, 'v3-packs/prisma-pack-engine.store.ts'));
    const tenant = [...c.matchAll(/this\.prisma\.(v3VendorPack|v3VendorCapability|v3VendorPackAddon)\.(\w+)\(([\s\S]*?)\)\s*;?\s*(?:\n|,|\))/g)];
    expect(tenant.length).toBeGreaterThanOrEqual(6);
    expect(tenant.filter((m) => !/vendorId/.test(m[3])).map((m) => `${m[1]}.${m[2]}`)).toEqual([]);
  });
  it('the Pharmacy online checkout and the gated packs switches default OFF in code and in the stored default', () => {
    const svc = fs.readFileSync(path.join(src, 'v3-packs/pack-engine.service.ts'), 'utf8');
    expect(svc).toMatch(/getSettingBool\(PACK_SETTING_KEYS\.onlineMedicineCheckout\)/);
    const store = fs.readFileSync(path.join(src, 'v3-packs/prisma-pack-engine.store.ts'), 'utf8');
    expect(store).toMatch(/valueJson === true/);
  });
});

describe('the HTTP layer', () => {
  it('every pack error code is registered with the exception filter (so a screen can switch on it)', () => {
    expect([...PACK_ERROR_CODES].filter((c) => passThrough(c) !== c)).toEqual([]);
  });
  it('every code the engine throws is on the registered list', () => {
    const thrown = new Set<string>();
    for (const f of files) { if (f.endsWith('pack.errors.ts')) continue; for (const m of fs.readFileSync(f, 'utf8').matchAll(/packError\(\s*\d{3},\s*'([A-Z][A-Z0-9_]{4,})'/g)) thrown.add(m[1]); }
    expect(thrown.size).toBeGreaterThan(5);
    expect([...thrown].filter((c) => !(PACK_ERROR_CODES as readonly string[]).includes(c))).toEqual([]);
  });
  it('the filter really drops a code that is not registered (so the guard above can fail)', () => { expect(passThrough('NOT_A_REGISTERED_CODE_XYZ')).toBeUndefined(); });
  it('every DTO field carries a validator decorator', () => {
    const dto = fs.readFileSync(path.join(src, 'v3-packs/api/pack.dto.ts'), 'utf8');
    for (const m of dto.matchAll(/^\s*((?:@\w+\([^\n]*?\)\s*)*)(\w+)[?!]?:\s*[^;\n]+;/gm)) expect([m[2], /@(Is|Matches|Min|Max|ArrayMax)\w*/.test(m[1])]).toEqual([m[2], true]);
  });
  it('every controller route has an ApiOperation and every controller an ApiTags', () => {
    const c = fs.readFileSync(path.join(src, 'v3-packs/api/pack.controllers.ts'), 'utf8');
    const routes = [...c.matchAll(/@(Get|Post|Put)\(/g)].length; const ops = [...c.matchAll(/@ApiOperation\(/g)].length;
    expect(routes).toBe(ops); expect([...c.matchAll(/@ApiTags\(/g)].length).toBe([...c.matchAll(/@Controller\(/g)].length);
  });
});

describe('the staff routes follow the role rules', () => {
  const READS = ['GET /v3/admin/pack-engine/packs', 'GET /v3/admin/pack-engine/packs/:key', 'GET /v3/admin/pack-engine/tabs', 'GET /v3/admin/pack-engine/categories', 'GET /v3/admin/pack-engine/tier-matrix', 'GET /v3/admin/pack-engine/addons', 'GET /v3/admin/pack-engine/settings', 'GET /v3/admin/pack-engine/vendors/:vendorId/navigation'];
  const WRITES = ['PUT /v3/admin/pack-engine/packs/:key', 'PUT /v3/admin/pack-engine/tabs', 'PUT /v3/admin/pack-engine/categories/:categoryKey', 'PUT /v3/admin/pack-engine/tier-matrix/:tier/:capabilityKey', 'PUT /v3/admin/pack-engine/vendors/:vendorId/addons/:addonKey', 'PUT /v3/admin/pack-engine/settings/:name'];
  it('reads: OPERATIONS and SUPER_ADMIN, never MARKETING', () => { for (const k of READS) expect([k, [...rolesFor(k)]]).toEqual([k, ['SUPER_ADMIN', 'OPERATIONS']]); });
  it('every change, the tier matrix and the two switches are SUPER_ADMIN only (the staff ADMIN role arrives with Part B)', () => { for (const k of WRITES) expect([k, [...rolesFor(k)]]).toEqual([k, ['SUPER_ADMIN']]); });
  it('every route of the controller has a matrix entry, and every entry is a real route', () => {
    const c = fs.readFileSync(path.join(src, 'v3-packs/api/pack.controllers.ts'), 'utf8');
    const admin = c.slice(c.indexOf("@Controller('v3/admin/pack-engine')"));
    const found = [...admin.matchAll(/@(Get|Put|Post)\('([^']*)'\)/g)].map((m) => `${m[1].toUpperCase()} /v3/admin/pack-engine/${m[2]}`.replace(/\/$/, ''));
    expect(found.sort()).toEqual([...READS, ...WRITES].sort());
    for (const k of found) expect(Object.keys(ADMIN_ROLE_MATRIX)).toContain(k);
  });
});
