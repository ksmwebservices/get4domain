// Shared local harness for the Full BOS work: the REAL NestJS API (compiled dist/) over an in-memory PGlite Postgres built from
// prisma/schema.prisma. Nothing here can reach a real database (it refuses any URL that is not the local PGlite port).
//
//   const h = await startHarness({ port: 3098, pgPort: 54330 });
//   const v = await h.createVendor({ key: 'shop', industry: 'retail', plan: 'WORKSPACE' });   // owner login ready
//   const r = await h.call('GET', '/stock/low', undefined, v.token);                         // { status, body, data }
//   await h.stop();
//
// Needs `npx nest build` first and @electric-sql/pglite + pglite-socket under %TEMP%\pgtest (or G4D_PGLITE_DIR).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const BE = path.join(__dirname, '..', '..');
const pgDir = process.env.G4D_PGLITE_DIR || path.join(os.tmpdir(), 'pgtest');

async function load(mod) {
  const dir = path.join(pgDir, 'node_modules', ...mod.split('/'));
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const entry = (pkg.exports && pkg.exports['.'] && (pkg.exports['.'].import?.default ?? pkg.exports['.'].import ?? pkg.exports['.'].default)) || pkg.module || pkg.main;
  return import(pathToFileURL(path.join(dir, typeof entry === 'string' ? entry : (entry.default ?? entry.import))).href);
}

/** True when PGlite is installed (suites SKIP instead of failing when it is not). */
async function available() {
  try { await load('@electric-sql/pglite'); await load('@electric-sql/pglite-socket'); return true; } catch { return false; }
}

async function startHarness({ port = 3098, pgPort = 54330, schemaSql } = {}) {
  const pgUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/postgres?sslmode=disable&connection_limit=1&pool_timeout=60&pgbouncer=true`;
  process.env.DATABASE_URL = pgUrl; process.env.DIRECT_URL = pgUrl;
  if (!process.env.DATABASE_URL.includes(`127.0.0.1:${pgPort}`)) throw new Error('REFUSING: not the local PGlite');
  process.env.PLATFORM_SETTINGS_KEY = process.env.PLATFORM_SETTINGS_KEY || 'local-key-local-key-local-key-0123456';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-jwt-secret-for-harness-only';
  process.env.THROTTLE_DISABLED = 'true';
  process.env.PUBLIC_API_URL = `http://127.0.0.1:${port}`;
  process.env.NODE_ENV = 'test';
  for (const k of ['RESEND_API_KEY', 'FAST2SMS_API_KEY', 'FAST2SMS_WHATSAPP_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']) delete process.env[k];
  process.chdir(BE);
  require('reflect-metadata');

  const { PGlite } = await load('@electric-sql/pglite');
  const { PGLiteSocketServer } = await load('@electric-sql/pglite-socket');
  const db = new PGlite();
  const sql = schemaSql ?? execFileSync(process.execPath, [path.join(BE, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(BE, 'prisma', 'schema.prisma'), '--script'], { cwd: BE, env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true' }, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  await db.exec(sql);
  const sockServer = new PGLiteSocketServer({ db, port: pgPort, host: '127.0.0.1' });
  await sockServer.start();

  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe } = require('@nestjs/common');
  const dist = (p) => require(path.join(BE, 'dist', 'src', p));
  const app = await NestFactory.create(dist('app.module').AppModule, { rawBody: true, logger: ['error'] });
  app.enableCors(dist('common/cors').buildCorsOptions());
  app.useGlobalPipes(dist('common/pipes/edit-validation.pipe').buildValidationPipe()); // the same pipe main.ts installs
  app.useGlobalInterceptors(new (dist('common/interceptors/transform.interceptor').TransformInterceptor)());
  app.useGlobalFilters(new (dist('common/filters/http-exception.filter').HttpExceptionFilter)());
  await app.listen(port, '127.0.0.1');
  const svc = (n, m) => app.get(dist(m)[n], { strict: false });
  const prisma = svc('PrismaService', 'prisma/prisma.service');
  const base = `http://127.0.0.1:${port}`;
  const { AuthService } = dist('auth/auth.service');
  const { provisionModules } = dist('registry/provisioning');

  async function call(method, urlPath, body, token, extraHeaders = {}) {
    const res = await fetch(base + urlPath, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed, data: parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed, text };
  }

  /** A throwaway vendor with an owner login, a billing term on `plan` and the modules that plan includes. Default switches: Dashboard v2 on. */
  async function createVendor({ key, industry = 'retail', plan = 'WORKSPACE', subdomain, state = 'Tamil Nadu', navV2 = true } = {}) {
    const password = `Local-${crypto.randomBytes(9).toString('base64url')}`;
    const email = `${key}@local.test`;
    const vendor = await prisma.vendor.create({ data: { name: `${key} owner`, email, password: await AuthService.hashPassword(password), businessName: `${key} business`, industry, subdomain: subdomain ?? key, phone: '9000000000' } });
    const now = new Date();
    if (plan) {
      await prisma.billingTerm.create({ data: { vendorId: vendor.id, planKey: plan, billingCycle: 'ANNUAL', cycleMonths: 12, listAmountPaise: 1198800, netAmountPaise: 1198800, gstMode: 'EXCLUSIVE', periodStart: now, periodEnd: new Date(now.getTime() + 365 * 86400000), status: 'ACTIVE', isCurrent: true, activatedAt: now, createdBy: 'harness' } });
      await prisma.$transaction(async (tx) => { await provisionModules(tx, vendor.id, plan, { actor: 'harness', reason: 'local harness' }); });
    }
    await prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: vendor.id, addonKey: 'nav_v2' } }, create: { vendorId: vendor.id, addonKey: 'nav_v2', enabled: navV2 }, update: { enabled: navV2 } });
    const login = await call('POST', '/auth/login', { email, password });
    const token = login.data?.accessToken ?? login.data?.access_token ?? login.body?.accessToken;
    return { id: vendor.id, email, password, token, subdomain: vendor.subdomain, state, login };
  }

  /** A platform admin login (role SUPER_ADMIN). */
  async function createAdmin({ key = 'admin' } = {}) {
    const password = `Local-${crypto.randomBytes(9).toString('base64url')}`;
    const email = `${key}@local.test`;
    await prisma.vendor.create({ data: { name: `${key} admin`, email, password: await AuthService.hashPassword(password), businessName: `${key} admin`, role: 'SUPER_ADMIN' } });
    const login = await call('POST', '/auth/login', { email, password });
    return { email, token: login.data?.accessToken ?? login.data?.access_token ?? login.body?.accessToken, login };
  }

  async function stop() {
    try { await app.close(); } catch { /* ignore */ }
    try { await sockServer.stop(); } catch { /* ignore */ }
    try { await db.close(); } catch { /* ignore */ }
  }

  return { app, prisma, svc, dist, call, createVendor, createAdmin, stop, base, db };
}

module.exports = { startHarness, available };
