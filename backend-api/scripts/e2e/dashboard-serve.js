// LOCAL DASHBOARD HARNESS — real NestJS API on 127.0.0.1:3099 over an in-memory PGlite database seeded like Step N Rock
// (Workspace menu on, order-request checkout, stock, categories, an order request, notifications). Nothing touches production.
//
//   node scripts/e2e/dashboard-serve.js            (keeps running; Ctrl+C to stop)
//   then, in get4domain_mvp:  NEXT_PUBLIC_API_URL=http://127.0.0.1:3099 npx next dev -p 3020
// The login for the seeded vendor is written to <tmp>/g4d-dashboard-login.json (a throwaway local credential).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const BE = path.join(__dirname, '..', '..');
const pgDir = process.env.G4D_PGLITE_DIR || path.join(os.tmpdir(), 'pgtest');
if (fs.existsSync(path.join(BE, '.env.local'))) {
  for (const l of fs.readFileSync(path.join(BE, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
const PG_URL = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connection_limit=1&pool_timeout=60&pgbouncer=true';
process.env.DATABASE_URL = PG_URL; process.env.DIRECT_URL = PG_URL;
if (!process.env.DATABASE_URL.includes('127.0.0.1:54329')) { console.error('REFUSING: not the local PGlite'); process.exit(2); }
process.env.PLATFORM_SETTINGS_KEY = process.env.PLATFORM_SETTINGS_KEY || 'local-key-local-key-local-key-0123456';
process.env.THROTTLE_DISABLED = 'true';
process.env.PUBLIC_API_URL = 'http://127.0.0.1:3099';
for (const k of ['RESEND_API_KEY', 'FAST2SMS_API_KEY', 'FAST2SMS_WHATSAPP_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k];
process.chdir(BE);
require('reflect-metadata');

async function load(mod) {
  const dir = path.join(pgDir, 'node_modules', ...mod.split('/'));
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const entry = (pkg.exports && pkg.exports['.'] && (pkg.exports['.'].import?.default ?? pkg.exports['.'].import ?? pkg.exports['.'].default)) || pkg.module || pkg.main;
  return import(pathToFileURL(path.join(dir, typeof entry === 'string' ? entry : (entry.default ?? entry.import))).href);
}

(async () => {
  const { PGlite } = await load('@electric-sql/pglite');
  const { PGLiteSocketServer } = await load('@electric-sql/pglite-socket');
  const db = new PGlite();
  await db.exec(execFileSync(process.execPath, [path.join(BE, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(BE, 'prisma', 'schema.prisma'), '--script'], { cwd: BE, env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true' }, maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));
  await new PGLiteSocketServer({ db, port: 54329, host: '127.0.0.1' }).start();

  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe } = require('@nestjs/common');
  const dist = (p) => require(path.join(BE, 'dist', 'src', p));
  const app = await NestFactory.create(dist('app.module').AppModule, { rawBody: true, logger: ['error'] });
  app.enableCors(dist('common/cors').buildCorsOptions());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new (dist('common/interceptors/transform.interceptor').TransformInterceptor)());
  app.useGlobalFilters(new (dist('common/filters/http-exception.filter').HttpExceptionFilter)());
  await app.listen(3099, '127.0.0.1');
  const svc = (n, m) => app.get(dist(m)[n], { strict: false });
  const prisma = svc('PrismaService', 'prisma/prisma.service');
  const cms = svc('CmsService', 'cms/cms.service');
  const checkout = svc('PublicCheckoutService', 'engine/public-checkout.service');
  const notifications = svc('NotificationsService', 'notifications/notifications.service');
  const { AuthService } = dist('auth/auth.service');
  const { planAccess, applyAccess, readCurrent } = require('../set-vendor-access-lib');

  const password = `Local-${crypto.randomBytes(9).toString('base64url')}`;
  const email = 'suresh@local.test';
  const vendor = await prisma.vendor.create({ data: { name: 'Suresh', email, password: await AuthService.hashPassword(password), businessName: 'Step N Rock', industry: 'retail', subdomain: 'stepnrock', phone: '9360011107' } });
  await applyAccess(prisma, vendor.id, planAccess(await readCurrent(prisma, vendor.id)));
  const mk = (name, price, category, extra = {}) => cms.addProduct(vendor.id, { name, price, category, image: 'https://images.pexels.com/photos/1461048/pexels-photo-1461048.jpeg?auto=compress&cs=tinysrgb&h=300&w=300', ...extra }, 'owner');
  const aero = await mk('Aero Flight Sneakers', '1299', 'Sneakers', { trackStock: true, stockQty: 6, reorderLevel: 3, customFields: { sizes: ['8', '9'], colors: ['Black', 'Red'] } });
  await mk('Velocity Runner', '1899', 'Running', { trackStock: true, stockQty: 2, reorderLevel: 3 });
  await mk('Oxford Classic', '2499', 'Formal', { trackStock: true, stockQty: 0, reorderLevel: 2 });
  await mk('Canvas Sandal', '650', 'Sandals');
  await cms.createCategory(vendor.id, 'Kids');
  await checkout.placeOrderRequest(vendor.id, { items: [{ productId: aero.id, name: 'Aero Flight Sneakers — 9 / Black', qty: 2 }], name: 'Ravi Kumar', phone: '98765 43210', address: '12 Main Street, Vadapalani, Chennai 600026', idempotencyKey: 'seed-order-0001', note: 'Call after 6 pm' });
  await notifications.notifyVendor(vendor.id, 'website_enquiry', 'New website enquiry', 'Priya enquired (9000011111).', { priority: 'ACTION', actionType: 'view_lead' });

  fs.writeFileSync(path.join(os.tmpdir(), 'g4d-dashboard-login.json'), JSON.stringify({ email, password, vendorId: vendor.id }));
  console.log('READY  API http://127.0.0.1:3099 · seeded Step N Rock · login in', path.join(os.tmpdir(), 'g4d-dashboard-login.json'));
  process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
  setInterval(() => {}, 1 << 30);
})().catch((e) => { console.error(e); process.exit(1); });
