import * as fs from 'fs';
import * as path from 'path';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// @nestjs/schedule ships ES modules that the unit project cannot load (same limitation and same workaround as provisioning-wiring.spec.ts)
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined, CronExpression: { EVERY_30_SECONDS: '*/30 * * * * *' }, ScheduleModule: { forRoot: () => ({ module: class {} }) } }));

import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';
import { DirectoryModule } from '../src/directory/directory.module';
import { DirectoryAudit, PrismaDirectoryAudit } from '../src/directory/directory-audit';
import { DirectoryRepository } from '../src/directory/directory.repository';
import { PrismaDirectoryRepository } from '../src/directory/prisma-directory.repository';
import { ModeSmsAdapter, SmsAdapter } from '../src/directory/sms/sms-adapter';
import { B3SettingsModule } from '../src/b3-settings/b3-settings.module';
import { PlansModule } from '../src/plans/plans.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClaimOtpService } from '../src/provisioning/claims/claim-otp.service';
import { PROVISIONING_OPTIONAL_STEPS, PROVISIONING_STEPS } from '../src/provisioning/runner/job-runner.service';
import { CreateDirectoryProfileStep } from '../src/provisioning/steps/create-directory-profile.step';
import { ProvisioningModule } from '../src/provisioning/provisioning.module';
import { SiteDocModule } from '../src/site-doc/site-doc.module';
import { StarterService } from '../src/site-doc/starter.service';
import { findLegacyUse } from './support/legacy-scan';

@Module({ providers: [{ provide: StarterService, useValue: {} }], exports: [StarterService] })
class StubSiteDocModule {}

/** Slice 5.7 static checks: decision D1 (no legacy tables), naming (Directory, never Listing), pure core, raw SQL only in the repository, no password in the claim, no logging of codes, wiring. */
const src = path.resolve(__dirname, '../src');
const tsFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
const dirFiles = tsFiles(path.join(src, 'directory'));
const extra = [path.join(src, 'provisioning/claims/claim-otp.service.ts'), path.join(src, 'provisioning/claims/claim-otp.controller.ts'), path.join(src, 'provisioning/steps/create-directory-profile.step.ts')];
const files = [...dirFiles, ...extra];
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

describe('directory code and the legacy world (decision D1)', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(25); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, add-on, module or registry table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('the only legacy-adjacent tables touched are Vendor (read: id, name, phone, email) and nothing else; no write to Vendor at all', () => {
    for (const f of files) expect(code(f)).not.toMatch(/\.vendor\.(update|create|delete|upsert|updateMany|deleteMany)/);
    const touching = files.filter((f) => /\.vendor\./.test(code(f))).map(rel);
    expect(touching).toEqual(['directory/prisma-directory.repository.ts']);
  });
  it('directory objects are named Directory*, and nothing is called a Listing', () => {
    for (const f of files) expect([rel(f), /\bListing\b|\blisting[A-Z]|class \w*Listing/.test(code(f))]).toEqual([rel(f), false]);
    const schema = fs.readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    for (const m of schema.matchAll(/^model (V3\w+) \{[\s\S]*?^\}/gm)) if (/g4d_directory_/.test(m[0])) expect(m[1]).toMatch(/^V3Directory/);
  });
});

describe('purity and safety', () => {
  it.each(['slug.ts', 'search.ts', 'indexing.ts', 'otp.ts', 'removal.ts', 'masking.ts'])('core/%s has no clock, randomness, network, file system or database', (f) => {
    expect(code(path.join(src, 'directory/core', f))).not.toMatch(/Date\.now|new Date\(|Math\.random|randomInt|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|require\(|prisma|PrismaService/);
  });
  it('raw SQL appears only in the Prisma repository, only as tagged templates (never the Unsafe variants), with the search text passed as a bound parameter', () => {
    for (const f of files) {
      const c = code(f);
      expect(c).not.toMatch(/\$queryRawUnsafe|\$executeRawUnsafe/);
      if (/\$queryRaw|\$executeRaw/.test(c)) expect(rel(f)).toBe('directory/prisma-directory.repository.ts');
    }
    const repo = code(path.join(src, 'directory/prisma-directory.repository.ts'));
    expect(repo).toMatch(/to_tsquery\('simple', \$\{tsq\}\)/); expect(repo).toMatch(/similarity\("name", \$\{q\.text\}\)/);
  });
  it('the claim sets NO password and the OTP / removal / grant code never logs a code or a token', () => {
    expect(code(path.join(src, 'provisioning/claims/claim-otp.service.ts'))).not.toMatch(/password|bcrypt|argon/i);
    for (const f of files) expect(code(f)).not.toMatch(/console\.|Logger\b|logger\./);
  });
  it('the OTP code is generated with crypto randomInt and compared in constant time; Math.random is nowhere in the slice', () => {
    expect(code(path.join(src, 'provisioning/claims/claim-otp.service.ts'))).toMatch(/randomInt/);
    expect(code(path.join(src, 'directory/core/otp.ts'))).toMatch(/timingSafeEqual/);
    for (const f of files) expect(code(f)).not.toMatch(/Math\.random/);
  });
  it('no price in rupees, and none of the retired product names, in any seeded or generated text of the slice', () => {
    for (const f of [...files, path.resolve(__dirname, '../prisma/seed/v3-directory.seed.json')]) expect(fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/₹|\bRs\.?\s?\d|\bWorkspace\b|\bLeadSpace\b|Online Identity/);
  });
});

describe('tenant scope, cleanup and wiring', () => {
  it('the business is tenant scoped by its nullable vendorId; the setup grant is vendor scoped', () => { for (const m of ['V3DirectoryBusiness', 'V3AccountSetupGrant']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(true); });
  it('vendor-linked tables cascade from Vendor, and the staging cleanup removes the synthetic directory data', () => {
    const migration = fs.readdirSync(path.resolve(__dirname, '../prisma/migrations')).find((d) => /_v3_directory$/.test(d))!;
    const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8');
    for (const t of ['g4d_directory_businesses', 'g4d_account_setup_grants']) expect(sql).toMatch(new RegExp(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_vendorId_fkey"[^;]*ON DELETE CASCADE`));
    for (const t of ['g4d_directory_business_services', 'g4d_directory_business_media', 'g4d_directory_placements', 'g4d_directory_removal_requests', 'g4d_directory_claim_overrides']) expect(sql).toMatch(new RegExp(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_businessId_fkey"[^;]*ON DELETE CASCADE`));
    const cleanup = fs.readFileSync(path.resolve(__dirname, '../scripts/staging/test-tenant-cleanup.js'), 'utf8');
    for (const m of ['v3DirectoryBusiness', 'v3OtpChallenge', 'v3DirectoryCategory', 'v3DirectoryLocation']) expect(cleanup).toContain(`prisma.${m}.`);
  });
  it('the real modules compile; ports are bound to their real implementations; the optional step is registered apart from the five steps', async () => {
    process.env.EMAIL_MODE = 'test';
    const mod = await Test.createTestingModule({ imports: [PlansModule, B3SettingsModule, DirectoryModule, ProvisioningModule] }).overrideModule(SiteDocModule).useModule(StubSiteDocModule).overrideProvider(PrismaService).useValue({}).compile();
    expect(mod.get(DirectoryRepository)).toBeInstanceOf(PrismaDirectoryRepository); expect(mod.get(DirectoryAudit)).toBeInstanceOf(PrismaDirectoryAudit); expect(mod.get(SmsAdapter)).toBeInstanceOf(ModeSmsAdapter);
    expect(mod.get(ClaimOtpService)).toBeDefined();
    expect((mod.get(PROVISIONING_STEPS) as Array<{ key: string }>).map((s) => s.key)).not.toContain('CREATE_DIRECTORY_PROFILE');
    expect((mod.get(PROVISIONING_OPTIONAL_STEPS) as Array<{ key: string }>).map((s) => s.key)).toEqual(['CREATE_DIRECTORY_PROFILE']); expect(mod.get(CreateDirectoryProfileStep)).toBeDefined();
    await mod.close();
  });
});
