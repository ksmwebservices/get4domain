// FIX 4: no password hash / invite token may ever appear in an API response.
// A real Nest HTTP server using the production JwtAuthGuard + JwtStrategy, the real TeamController,
// VendorsController, InvoicesController, SubscriptionsController and the real global
// TransformInterceptor/ValidationPipe, with only the database faked. Requests carry real signed JWTs.
//
// BASELINE mode: BASELINE_REV=<git rev> swaps in the PRE-PATCH team service, vendors controller and
// response interceptor (transpiled from git) so the same requests demonstrate the leak that existed before.
const { dist, ok, section, finish, recorder } = require('./harness');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Module, ValidationPipe } = require('@nestjs/common');
const { NestFactory, APP_GUARD } = require('@nestjs/core');
const { PassportModule } = require('@nestjs/passport');
const { JwtModule } = require('@nestjs/jwt');
const jwt = require('jsonwebtoken');

const { JwtAuthGuard } = dist('common/guards/jwt-auth.guard');
const { JwtStrategy } = dist('auth/jwt.strategy');
const { TransformInterceptor } = dist('common/interceptors/transform.interceptor');
const { PrismaService } = dist('prisma/prisma.service');
const { TeamController } = dist('team/team.controller');
const { TeamService } = dist('team/team.service');
const { VendorsController } = dist('vendors/vendors.controller');
const { VendorsService } = dist('vendors/vendors.service');
const { InvoicesController } = dist('invoices/invoices.controller');
const { InvoicesService } = dist('invoices/invoices.service');
const { SubscriptionsController } = dist('subscriptions/subscriptions.controller');
const { SubscriptionsService } = dist('subscriptions/subscriptions.service');
const { EmailService } = dist('email/email.service');
const { WhatsAppService } = dist('notifications/whatsapp.service');
const { WalletService } = dist('wallet/wallet.service');
const { AiService } = dist('ai/ai.service');
const { PaymentsService } = dist('payments/payments.service');
const { PlatformSettingsService } = dist('platform-settings/platform-settings.service');

const REV = process.env.BASELINE_REV;
const baselineFiles = [];
function oldModule(rel) {
  const ts = require('typescript');
  const src = execSync(`git show ${REV}:backend-api/src/${rel}.ts`, { cwd: path.join(__dirname, '..', '..', '..'), encoding: 'utf8' });
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true } }).outputText;
  const target = path.join(__dirname, '..', '..', 'dist', 'src', `${rel}.__baseline.js`);
  fs.writeFileSync(target, out);
  baselineFiles.push(target);
  return require(target);
}
const TeamServiceImpl = REV ? oldModule('team/team.service').TeamService : TeamService;
const VendorsControllerImpl = REV ? oldModule('vendors/vendors.controller').VendorsController : VendorsController;
const InterceptorImpl = REV ? oldModule('common/interceptors/transform.interceptor').TransformInterceptor : TransformInterceptor;

const HASH = '$2a$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ0123456';
const TOKEN = 'inviteTok_deadbeefcafebabe0123456789abcdef0123456789abcd';
const vendorRow = (id, extra = {}) => ({ id, name: `Owner ${id}`, email: `${id}@x.in`, password: HASH, businessName: `Biz ${id}`, role: 'VENDOR', status: 'ACTIVE', isSandbox: false, expiresAt: null, phone: '999', ...extra });
const members = [
  { id: 'm1', vendorId: 'vendorA', name: 'Asha', email: 'asha@x.in', phone: '1', role: 'Sales', department: 'Sales', modules: ['telecrm'], status: 'active', inviteToken: null, password: HASH, lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date() },
  { id: 'm2', vendorId: 'vendorA', name: 'Ben', email: 'ben@x.in', phone: '2', role: 'Support', department: 'Support', modules: ['communication'], status: 'invited', inviteToken: TOKEN, password: null, lastLogin: null, createdAt: new Date(), updatedAt: new Date() },
];

const prismaFake = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'vendor') return {
      findUnique: async ({ where: { id } }) => ({ vendorA: vendorRow('vendorA'), admin1: vendorRow('admin1', { role: 'SUPER_ADMIN' }) }[id] ?? null),
      findUniqueOrThrow: async ({ where: { id } }) => vendorRow(id),
      findMany: async () => [vendorRow('vendorA'), vendorRow('vendorB')],
    };
    if (prop === 'teamMember') return {
      findMany: async () => members.map((m) => ({ ...m })),
      findUnique: async ({ where: { id } }) => { const m = members.find((x) => x.id === id); return m ? { ...m } : null; },
      create: async ({ data }) => ({ id: 'm3', ...data, password: null, lastLogin: null, createdAt: new Date(), updatedAt: new Date() }),
      update: async ({ where: { id }, data }) => ({ ...members.find((x) => x.id === id), ...data }),
    };
    if (prop === 'invoice') return {
      findUnique: async () => ({ id: 'inv1', vendorId: 'vendorA', invoiceNumber: 'INV-1', totalAmount: 11800, status: 'PENDING', vendor: vendorRow('vendorA') }),
    };
    if (prop === 'subscription') return {
      findMany: async () => [{ id: 's1', vendorId: 'vendorA', product: 'DOMAIN_APP', plan: 'STARTUP', status: 'ACTIVE', amount: 1198800, vendor: vendorRow('vendorA') }],
    };
    if (prop === 'then') return undefined;
    return recorder(String(prop));
  },
});

class TestModule {}
Module({
  imports: [PassportModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [TeamController, VendorsControllerImpl, InvoicesController, SubscriptionsController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    JwtStrategy, { provide: TeamService, useClass: TeamServiceImpl }, VendorsService, InvoicesService, SubscriptionsService,
    { provide: PrismaService, useValue: prismaFake },
    ...[EmailService, WhatsAppService, WalletService, AiService, PaymentsService, PlatformSettingsService].map((c) => ({ provide: c, useValue: recorder(c.name) })),
  ],
})(TestModule);

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
const owner = sign({ sub: 'vendorA', email: 'vendorA@x.in', role: 'VENDOR' });
const restricted = sign({ sub: 'vendorA', email: 'asha@x.in', role: 'VENDOR', kind: 'team_member', memberId: 'm1' });
const admin = sign({ sub: 'admin1', email: 'admin1@x.in', role: 'SUPER_ADMIN' });

(async () => {
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new InterceptorImpl());
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', 'localhost');
  const call = async (method, url, token, body) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, text, json };
  };
  const hasSecret = (text) => text.includes('$2a$') || text.includes(TOKEN) || /"password"|"inviteToken"/.test(text);
  const clean = (label, r) => {
    const leaked = hasSecret(r.text);
    if (REV) {
      ok(`BASELINE ${REV}: ${label} -> ${r.status}, LEAKS a password hash / invite token`, leaked, 'no leak found in baseline');
      return;
    }
    ok(`${label} -> ${r.status}, response contains no password hash / invite token`, r.status < 400 && !leaked, leaked ? `LEAK: ${r.text.slice(0, 200)}` : `status ${r.status}: ${r.text.slice(0, 120)}`);
  };

  section('GET /team/members as a real vendor-owner session');
  let r = await call('GET', '/team/members', owner);
  clean('owner', r);
  if (!REV) {
    const rows = r.json?.data ?? [];
    ok('safe fields are still present (name, email, role, status, modules)', rows.length === 2 && rows[0].name === 'Asha' && rows[0].email === 'asha@x.in' && rows[0].role === 'Sales' && rows[0].status === 'active' && Array.isArray(rows[0].modules), JSON.stringify(rows[0]));
    ok('no password / inviteToken KEYS on any member', rows.every((m) => !('password' in m) && !('inviteToken' in m)));
  }

  section('GET /team/members as a RESTRICTED team member (the worst-case caller)');
  r = await call('GET', '/team/members', restricted);
  clean('restricted member', r);

  section('Other responses that return a TeamMember / Vendor row');
  clean('POST /team/invite (response)', await call('POST', '/team/invite', owner, { name: 'Cy', email: 'cy@x.in', role: 'Sales', modules: ['telecrm'] }));
  clean('PUT /team/members/:id', await call('PUT', '/team/members/m2', owner, { role: 'Support', modules: ['communication'] }));
  clean('DELETE /team/members/:id', await call('DELETE', '/team/members/m2', owner));
  clean('GET /vendors (admin list of Vendor rows)', await call('GET', '/vendors', admin));
  clean('GET /vendors/:id', await call('GET', '/vendors/vendorA', admin));
  r = await call('GET', '/invoices/inv1', owner);
  clean('GET /invoices/:id (invoice with nested vendor)', r);
  if (!REV) ok('nested vendor business data is still there', r.json?.data?.vendor?.businessName === 'Biz vendorA');
  clean('GET /subscriptions (nested vendor)', await call('GET', '/subscriptions', admin));

  if (!REV) {
    section('Access control unchanged');
    r = await call('GET', '/team/members', undefined);
    ok('no token → 401', r.status === 401, `status=${r.status}`);
  }

  await app.close();
  for (const f of baselineFiles) { try { fs.unlinkSync(f); } catch (_) { /* noop */ } }
  finish();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
