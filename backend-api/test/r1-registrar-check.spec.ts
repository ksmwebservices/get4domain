import * as fs from 'fs';
import * as path from 'path';
import { checkDatabaseUrls } from '../src/common/startup-check';
import { RegistrarError } from '../src/v3-registrar/registrar.port';
import { createRequire } from 'module';
const nodeRequire = createRequire(__filename);   // CommonJS scripts under scripts/live: require() is not allowed by the lint rule, createRequire is the same load

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { liveSeedEnv } = nodeRequire('../scripts/live/live-env-lib');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { checkRegistrar, FIXED_NAME, STATE_OF } = nodeRequire('../scripts/live/registrar-check-lib');

/** R1.3: the registrar check is read only, prints PASS or the honest state, never a key, and refuses non-live databases. The registrar here is a fake: nothing calls ResellerClub. */
const KEY = 'SECRETKEY-r1-check-do-not-leak-9910';
const savedFacts = { status: { state: 'SET', setAt: new Date('2026-11-19T00:00:00Z'), fields: [{ field: 'mode', value: 'demo' }, { field: 'apiKey', state: 'set' }] }, envKeys: false, flagOn: false };
const notSaved = { status: { state: 'NOT_SET', setAt: null, fields: [] }, envKeys: false, flagOn: false };

describe('R1.3 registrar-check', () => {
  it('PASS: one availability read for the fixed name; the registrar word is printed, nothing else about the name', async () => {
    const calls: unknown[][] = [];
    const r = await checkRegistrar({ facts: savedFacts, search: async (...a: unknown[]) => { calls.push(a); return [{ domain: `${FIXED_NAME}.com`, status: 'AVAILABLE' }]; } });
    expect(r).toMatchObject({ pass: true, state: 'PASS' }); expect(calls).toEqual([[FIXED_NAME, ['com']]]);
    expect(r.lines.join('\n')).toContain('settings: saved in the integration settings (mode demo, saved 2026-11-19)'); expect(r.lines.join('\n')).toContain(`${FIXED_NAME}.com is AVAILABLE`);
  });
  it.each(Object.entries(STATE_OF))('the registrar failure %s prints the honest state %s and does not pass', async (c, state) => {
    const r = await checkRegistrar({ facts: savedFacts, search: async () => { throw new RegistrarError(c, false); } });
    expect(r).toMatchObject({ pass: false, state }); expect(r.lines[r.lines.length - 1].startsWith(`${state}:`)).toBe(true);
  });
  it('access denied says the IP address is probably not whitelisted yet', async () => {
    const r = await checkRegistrar({ facts: savedFacts, search: async () => { throw new RegistrarError('REGISTRAR_NOT_AUTHORISED', false); } });
    expect(r.lines.join('\n')).toMatch(/not whitelisted/);
  });
  it('nothing saved and nothing in the environment: NOT_CONFIGURED and no call at all', async () => {
    let called = 0; const r = await checkRegistrar({ facts: notSaved, search: async () => { called += 1; return []; } });
    expect(r).toMatchObject({ pass: false, state: 'NOT_CONFIGURED' }); expect(called).toBe(0);
  });
  it('environment keys alone are enough to make the call', async () => {
    const r = await checkRegistrar({ facts: { ...notSaved, envKeys: true }, search: async () => [{ domain: `${FIXED_NAME}.com`, status: 'TAKEN' }] });
    expect(r.pass).toBe(true); expect(r.lines.join('\n')).toContain('environment keys: present');
  });
  it('an answer without the fixed name, or an error it does not know, is UNKNOWN', async () => {
    expect((await checkRegistrar({ facts: savedFacts, search: async () => [] })).state).toBe('UNKNOWN');
    expect((await checkRegistrar({ facts: savedFacts, search: async () => { throw new Error(`boom ${KEY}`); } })).state).toBe('UNKNOWN');
  });
  it('no line of any outcome holds the key', async () => {
    const out: string[] = [];
    for (const search of [async () => [{ domain: `${FIXED_NAME}.com`, status: 'AVAILABLE' }], async () => { throw new RegistrarError('REGISTRAR_NOT_AUTHORISED', false); }, async () => { throw new Error(`boom ${KEY}`); }]) out.push(...(await checkRegistrar({ facts: { ...savedFacts, status: { ...savedFacts.status, fields: [...savedFacts.status.fields] } }, search })).lines);
    expect(out.join('\n')).not.toContain(KEY);
  });
  it('refuses a staging, test or local database and a placeholder (the live scripts own guard)', () => {
    for (const url of ['postgresql://u:p@localhost:5432/db', 'postgresql://u:p@db.example.test:5432/v3test', '', 'changeme']) expect(liveSeedEnv({ DATABASE_URL: url, DIRECT_URL: url }, checkDatabaseUrls).ok).toBe(false);
  });
  it('the script is read only, takes no arguments, has no staging mode, and checks the database before it connects', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../scripts/live/registrar-check.js'), 'utf8') + fs.readFileSync(path.resolve(__dirname, '../scripts/live/registrar-check-lib.js'), 'utf8');
    expect(src).not.toMatch(/\.(create|update|upsert|delete|deleteMany|updateMany|createMany|set|clear)\s*\(/);
    expect(src).not.toMatch(/register\(|renew\(|transferIn\(|createCustomer\(|createContact\(|setNameServers\(/);
    const s = fs.readFileSync(path.resolve(__dirname, '../scripts/live/registrar-check.js'), 'utf8');
    expect(s).toContain('process.argv.length > 2'); expect(s).not.toContain('loadStagingEnv'); expect(s.indexOf('liveSeedEnv(process.env')).toBeLessThan(s.indexOf('new PrismaClient'));
  });
});
