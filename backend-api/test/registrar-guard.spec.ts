import * as fs from 'fs';
import * as path from 'path';
import { RegistrarStartupGuard, REGISTRAR_PROVIDERS } from '../src/v3-registrar/registrar.module';
import { GatedRegistrarPort, RegistrarError, RegistrarPort } from '../src/v3-registrar/registrar.port';
import { HttpRequest, HttpResponse, RegistrarHttp, ResellerClubAdapter } from '../src/v3-registrar/resellerclub.adapter';

/** The safety rules of owner override 2: both live flags OFF by default, a startup guard, keys only from the environment, nothing live. */
const dir = path.resolve(__dirname, '../src/v3-registrar');
const tsFiles = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(d, e.name)) : e.name.endsWith('.ts') ? [path.join(d, e.name)] : []));
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const rel = (f: string): string => path.relative(dir, f).replace(/\\/g, '/');
const files = tsFiles(dir);

describe('the startup guard', () => {
  const guard = (env: Record<string, string | undefined>) => { const g = new RegistrarStartupGuard(); g.env = () => env; return g; };
  it('does nothing while both flags are off, whatever else is set', () => {
    expect(() => guard({}).onModuleInit()).not.toThrow(); expect(() => guard({ RESELLERCLUB_API_KEY: 'k' }).onModuleInit()).not.toThrow();
  });
  it('refuses to start live search or live purchase without both keys, and names only the missing variables', () => {
    expect(() => guard({ REGISTRAR_LIVE_SEARCH: 'true' }).onModuleInit()).toThrow('RESELLERCLUB_AUTH_USERID and RESELLERCLUB_API_KEY');
    expect(() => guard({ REGISTRAR_LIVE_PURCHASE: 'true', RESELLERCLUB_AUTH_USERID: '1' }).onModuleInit()).toThrow('RESELLERCLUB_API_KEY must be set');
    let message = ''; try { guard({ REGISTRAR_LIVE_PURCHASE: '1', RESELLERCLUB_API_KEY: 'topsecretvalue' }).onModuleInit(); } catch (e) { message = (e as Error).message; }
    expect(message).toContain('RESELLERCLUB_AUTH_USERID'); expect(message).not.toContain('topsecretvalue');
  });
  it('starts when a live flag is on and both keys exist', () => {
    expect(() => guard({ REGISTRAR_LIVE_SEARCH: 'true', RESELLERCLUB_AUTH_USERID: '1', RESELLERCLUB_API_KEY: 'k' }).onModuleInit()).not.toThrow();
  });
});

describe('the product binding', () => {
  class Recording extends RegistrarHttp { calls: HttpRequest[] = []; async send(r: HttpRequest): Promise<HttpResponse> { this.calls.push(r); return { status: 200, body: {} }; } }
  it('binds the gated ResellerClub adapter: with both flags off every call is refused and no request is ever built', async () => {
    const http = new Recording();
    const provider = REGISTRAR_PROVIDERS.find((p) => typeof p === 'object' && 'provide' in p && p.provide === RegistrarPort) as unknown as { useFactory: (h: RegistrarHttp) => RegistrarPort };
    expect(provider.useFactory).toBeDefined();
    const port = provider.useFactory(http);
    expect(port).toBeInstanceOf(GatedRegistrarPort);
    const calls: Array<() => Promise<unknown>> = [() => port.search('a', ['com']), () => port.costs(['com']), () => port.createCustomer({} as never), () => port.createContact('1', {} as never), () => port.register({} as never), () => port.renew('1', 1, new Date()), () => port.setPrivacy('1', true), () => port.setNameServers('1', []), () => port.orderInfo('a.com'), () => port.balance()];
    for (const c of calls) await expect(c()).rejects.toMatchObject({ code: 'REGISTRAR_LIVE_DISABLED' });
    expect(http.calls).toEqual([]);
  });
  it('even a gate that is open reaches the network only through the adapter and only with keys from the environment it was given', async () => {
    const http = new Recording(); const open = new GatedRegistrarPort(new ResellerClubAdapter(http, () => ({})), () => ({ REGISTRAR_LIVE_SEARCH: 'true' }));
    await expect(open.balance()).rejects.toBeInstanceOf(RegistrarError); expect(http.calls).toEqual([]);   // no keys: no request
  });
});

describe('static: nothing here can reach the network or read a key by accident', () => {
  it('only the adapter file calls fetch, and only the adapter and the guard name the key variables', () => {
    expect(files.filter((f) => /\bfetch\(/.test(code(f))).map(rel)).toEqual(['resellerclub.adapter.ts']);
    expect(files.filter((f) => /RESELLERCLUB_(AUTH_USERID|API_KEY)/.test(code(f))).map(rel).sort()).toEqual(['core/registrar-core.ts', 'resellerclub.adapter.ts']);
  });
  it('the key variables are never printed, logged or put in a thrown message', () => {
    for (const f of files) { const c = code(f); expect(c).not.toMatch(/(logger|console)\.\w+\([^)]*(API_KEY|apiKey|api-key|AUTH_USERID)/i); expect(c).not.toMatch(/new (RegistrarError|Error)\([^)]*(API_KEY|apiKey|AUTH_USERID)/); }
  });
  it('only the adapter and the settings read process.env; the store, the services and the controllers never do', () => {
    expect(files.filter((f) => /process\.env/.test(code(f))).map(rel).sort()).toEqual(['doc-crypto.ts', 'registrar.module.ts', 'registrar.port.ts', 'resellerclub.adapter.ts']);
  });
  it('the old ResellerClub service is never imported', () => {
    expect(files.filter((f) => /domains\/resellerclub\.service|ResellerClubService/.test(code(f))).map(rel)).toEqual([]);
  });
});
