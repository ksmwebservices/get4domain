import * as fs from 'fs';
import * as path from 'path';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// @nestjs/schedule ships ES modules that the unit project cannot load (same limitation and same workaround as provisioning-wiring.spec.ts)
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined, CronExpression: { EVERY_HOUR: '0 0 * * * *', EVERY_30_SECONDS: '*/30 * * * * *' }, ScheduleModule: { forRoot: () => ({ module: class {} }) } }));

import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';
import { PlansModule } from '../src/plans/plans.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PlanBillingModule } from '../src/plan-billing/plan-billing.module';
import { PlanBillingRepository } from '../src/plan-billing/plan-billing.repository';
import { PrismaPlanBillingRepository } from '../src/plan-billing/prisma-plan-billing.repository';
import { PaymentsGate } from '../src/plan-billing/razorpay/payments-gate';
import { ReminderMailer, SandboxReminderMailer } from '../src/plan-billing/renewal-reminder.service';
import { findLegacyUse } from './support/legacy-scan';

/** Slice 5.1b static checks: decision D1 (the legacy payment, billing, wallet and commercial code is untouched), pure core, secrets stay in the gate, raw SQL, tenant scope, wiring. */
const src = path.resolve(__dirname, '../src');
const tsFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
const files = tsFiles(path.join(src, 'plan-billing'));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
@Module({ providers: [], exports: [] })
class Unused {}
void Unused;

describe('plan billing and the legacy world (decision D1)', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(18); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, wallet, add-on or module table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('it never imports the legacy payment, billing, commercial, wallet, vendor-payments or razorpay code (no razorpay package either: the adapter uses plain HTTPS)', () => {
    for (const f of files) expect([rel(f), /from '(\.\.\/)+(payments|commercial|subscriptions|invoices|wallet|vendor-payments|leadspace|bos)\/|from 'razorpay'|require\('razorpay'\)/.test(code(f))]).toEqual([rel(f), false]);
  });
  it('the only existing tables it writes are Vendor-free: no write to Vendor, VendorCMS or any wallet / invoice table; the subscription goes through the slice 5.1 SubscriptionsService', () => {
    for (const f of files) expect(code(f)).not.toMatch(/\.(vendor|vendorCMS|wallet|walletTransaction|genericInvoice|invoice|subscription)\.(update|create|delete|upsert|updateMany|deleteMany|createMany)\b/);
    expect(code(path.join(src, 'plan-billing/prisma-plan-billing.repository.ts'))).toMatch(/subscriptions\.assignInTx\(/);
  });
});

describe('purity and safety', () => {
  it.each(['amounts.ts', 'order-state.ts', 'redact.ts'])('core/%s has no clock, randomness, network, file system, environment or database', (f) => {
    expect(code(path.join(src, 'plan-billing/core', f))).not.toMatch(/Date\.now|new Date\(\)|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|process\.env|prisma|PrismaService/);
  });
  it('the key and secret environment variables are read in ONE place (the gate), and nothing logs, returns or stores them', () => {
    const readers = files.filter((f) => /RAZORPAY_TEST_KEY_SECRET|RAZORPAY_TEST_WEBHOOK_SECRET/.test(code(f))).map(rel);
    expect(readers).toEqual(['plan-billing/razorpay/payments-gate.ts']);
    for (const f of files) expect([rel(f), /console\.|logger\.\w+\([^)]*(secret|key)/i.test(code(f))]).toEqual([rel(f), false]);
  });
  it('LIVE mode cannot be reached: the gate has no branch that builds a live adapter', () => {
    const gate = code(path.join(src, 'plan-billing/razorpay/payments-gate.ts'));
    expect(gate).toMatch(/mode === 'live'\) throw/); expect(gate).not.toMatch(/rzp_live/);
    expect(code(path.join(src, 'plan-billing/razorpay/razorpay.port.ts'))).toMatch(/rzp_test_/);
  });
  it('raw SQL only in the Prisma repository, as tagged templates, and only for the invoice counter', () => {
    for (const f of files) { const c = code(f); expect(c).not.toMatch(/\$queryRawUnsafe|\$executeRawUnsafe/); if (/\$queryRaw|\$executeRaw/.test(c)) expect(rel(f)).toBe('plan-billing/prisma-plan-billing.repository.ts'); }
    const repo = code(path.join(src, 'plan-billing/prisma-plan-billing.repository.ts')); expect(repo.match(/\$(queryRaw|executeRaw)/g)).toHaveLength(2); expect(repo).toMatch(/"lastNumber" = "lastNumber" \+ 1/);
  });
  it('the webhook verifies the RAW body (req.rawBody), never a re-serialised req.body', () => {
    const c = code(path.join(src, 'plan-billing/api/payments-webhook.controller.ts')); expect(c).toMatch(/req\.rawBody/); expect(c).not.toMatch(/JSON\.stringify\(req\.body\)|@Body\(/);
  });
  it('no amount in a float anywhere in the slice: amounts are integer paise (no toFixed, no parseFloat, no Number(...)/100 on money)', () => {
    for (const f of files) expect([rel(f), /toFixed\(|parseFloat\(|amount\w*\s*\/\s*100\b/.test(code(f))]).toEqual([rel(f), false]);
  });
});

describe('tenant scope, cleanup and wiring', () => {
  it('orders and invoices are tenant scoped', () => { for (const m of ['V3PlanOrder', 'V3PlanInvoice']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(true); });
  it('vendor-linked tables cascade from Vendor, and the staging cleanup removes the payment events and audit rows the tests caused', () => {
    const migration = fs.readdirSync(path.resolve(__dirname, '../prisma/migrations')).find((d) => /_v3_plan_billing$/.test(d))!;
    const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8');
    for (const t of ['g4d_plan_orders', 'g4d_plan_invoices']) expect(sql).toMatch(new RegExp(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_vendorId_fkey"[^;]*ON DELETE CASCADE`));
    expect(sql).toMatch(/ALTER TABLE "g4d_reminder_log" ADD CONSTRAINT "g4d_reminder_log_subscriptionId_fkey"[^;]*ON DELETE CASCADE/);
    const cleanup = fs.readFileSync(path.resolve(__dirname, '../scripts/staging/test-tenant-cleanup.js'), 'utf8'); expect(cleanup).toContain('prisma.v3PaymentEvent.');
  });
  it('the real module compiles; the port is bound to the Prisma repository; reminders use the SANDBOX mailer; the gate is the real one', async () => {
    const mod = await Test.createTestingModule({ imports: [PlansModule, PlanBillingModule] }).overrideProvider(PrismaService).useValue({}).compile();
    expect(mod.get(PlanBillingRepository)).toBeInstanceOf(PrismaPlanBillingRepository); expect(mod.get(ReminderMailer)).toBeInstanceOf(SandboxReminderMailer); expect(mod.get(PaymentsGate)).toBeInstanceOf(PaymentsGate);
    await mod.close();
  });
});
