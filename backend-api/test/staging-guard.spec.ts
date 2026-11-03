/* eslint-disable @typescript-eslint/no-require-imports */
// The staging guard is what stops db:staging:* (and later the Jest DB setup) from ever touching production.
// These tests use synthetic URLs only; no real credentials and no network.
const guard = require('../scripts/staging/guard');

const POOLER = 'postgresql://postgres.zzzzzzzzzzzzzzzzzzzz:S3cretP4ss@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
const DIRECT = 'postgresql://postgres:S3cretP4ss@db.zzzzzzzzzzzzzzzzzzzz.supabase.co:5432/postgres';

describe('staging guard', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.restoreAllMocks(); });

  it('extracts the project ref from pooler and direct URLs', () => {
    expect(guard.projectRef(POOLER)).toBe('zzzzzzzzzzzzzzzzzzzz');
    expect(guard.projectRef(DIRECT)).toBe('zzzzzzzzzzzzzzzzzzzz');
  });

  it('returns null for things that are not Supabase URLs', () => {
    expect(guard.projectRef('not a url')).toBeNull();
    expect(guard.projectRef('postgresql://u:p@localhost:5432/db')).toBeNull();
  });

  it('refuses a project that is not on the staging allow-list, without printing credentials', () => {
    process.env.STAGING_DATABASE_URL = POOLER;
    process.env.STAGING_DIRECT_URL = DIRECT;
    const exit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit:${code}`); }) as never);
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => guard.loadStagingEnv()).toThrow('exit:3');
    expect(exit).toHaveBeenCalledWith(3);
    const printed = err.mock.calls.flat().join(' ');
    expect(printed).toContain('STAGING GUARD REFUSED');
    expect(printed).not.toContain('S3cretP4ss');
    expect(printed).not.toContain('zzzzzzzzzzzzzzzzzzzz');
  });

  it('refuses when the URLs are missing', () => {
    delete process.env.STAGING_DATABASE_URL;
    delete process.env.STAGING_DIRECT_URL;
    // Only meaningful when no local .env.staging exists (CI); skip the assertion when a developer has one.
    if (guard.parseEnvFile(`${guard.REPO_ROOT}/.env.staging`).DATABASE_URL) return;
    jest.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit:${code}`); }) as never);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => guard.loadStagingEnv()).toThrow('exit:3');
  });

  it('mask() removes the URL, host, user and password from any text', () => {
    const mask = guard.maskWith(guard.secretsOf([POOLER, DIRECT]));
    const text = `failed at ${POOLER} using S3cretP4ss on aws-1-ap-south-1.pooler.supabase.com as postgres.zzzzzzzzzzzzzzzzzzzz`;
    const out = mask(text);
    for (const leak of ['S3cretP4ss', 'pooler.supabase.com', 'zzzzzzzzzzzzzzzzzzzz', 'postgresql://']) expect(out).not.toContain(leak);
  });

  it('the committed config stores hashes only, never URLs or refs', () => {
    const raw = JSON.stringify(require(guard.CONFIG));
    expect(raw).not.toMatch(/postgres(ql)?:\/\//);
    expect(raw).not.toMatch(/supabase\.(co|com)|pooler|aws-\d|@/i);   // no host, no user@host, no URL; the word "Supabase" in the note is fine
    expect(raw).toMatch(/[0-9a-f]{64}/);
  });
});
