import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';
import { PlansModule } from '../src/plans/plans.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiStudioModule } from '../src/ai-studio/ai-studio.module';
import { AiStudioRepository } from '../src/ai-studio/ai-studio.repository';
import { PrismaAiStudioRepository } from '../src/ai-studio/prisma-ai-studio.repository';
import { AiProviderGate } from '../src/ai-studio/providers/ai-provider-gate';
import { findLegacyUse } from './support/legacy-scan';

/** Slice 5.11 static checks: decision D1 (the legacy ai, wallet and billing code is untouched), no real model unless the gate allows it, secrets only through the one helper, pure core, tenant scope, wiring. */
const src = path.resolve(__dirname, '../src');
const tsFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
const files = tsFiles(path.join(src, 'ai-studio'));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

describe('AI Studio and the legacy world (decision D1)', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(18); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, wallet, add-on or module table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('it does not use the legacy `ai` module, the wallet, the platform settings service or any SDK; the only borrowed code is the AES helper, in one file', () => {
    for (const f of files) {
      const c = code(f);
      expect([rel(f), /from '(\.\.\/)+ai\/|from '(\.\.\/)+wallet\/|from '(\.\.\/)+leadspace\/|from '(\.\.\/)+payments\/|platform-settings\.service|from 'openai'|from '@anthropic-ai/.test(c)]).toEqual([rel(f), false]);
    }
    expect(files.filter((f) => /platform-settings\/crypto\.util/.test(code(f))).map(rel)).toEqual(['ai-studio/secret-box.ts']);
  });
  it('no write to a legacy table', () => { for (const f of files) expect(code(f)).not.toMatch(/\.(vendor|wallet|walletTransaction|aiUsage|aiGeneration|platformSetting)\.(update|create|delete|upsert|updateMany|deleteMany)\b/); });
});

describe('no real model unless the gate says so', () => {
  it('the live adapters are constructed in ONE place (the gate), and only after aiLiveCalls is checked', () => {
    const users = files.filter((f) => /new (OpenAiTextAdapter|AnthropicTextAdapter)\(/.test(code(f))).map(rel); expect(users).toEqual(['ai-studio/providers/ai-provider-gate.ts']);
    const gate = code(path.join(src, 'ai-studio/providers/ai-provider-gate.ts')); expect(gate.indexOf('aiLiveCalls')).toBeGreaterThan(-1); expect(gate.indexOf('aiLiveCalls')).toBeLessThan(gate.indexOf('this.build(row)'));
  });
  it('fetch is called only inside the two adapters', () => { expect(files.filter((f) => /\bfetch\(/.test(code(f))).map(rel)).toEqual(['ai-studio/providers/ai-provider.port.ts']); });
  it('the secret is opened in the gate only; it is never logged, returned or put in an error message', () => {
    expect(files.filter((f) => /openSecret\(/.test(code(f))).map(rel).sort()).toEqual(['ai-studio/providers/ai-provider-gate.ts', 'ai-studio/secret-box.ts']);
    for (const f of files) { const c = code(f); expect([rel(f), /console\.|logger\.\w+\(/i.test(c)]).toEqual([rel(f), false]); }
    const port = code(path.join(src, 'ai-studio/providers/ai-provider.port.ts')); expect(port).not.toMatch(/throw new Error\([^)]*\$\{[^}]*(apiKey|key)/i);
  });
});

describe('purity and tenant scope', () => {
  it.each(['credits.ts', 'features.ts', 'prompt.ts', 'output-scan.ts'])('core/%s has no clock, randomness, network, file system, environment or database', (f) => {
    expect(code(path.join(src, 'ai-studio/core', f))).not.toMatch(/Date\.now|new Date\(\)|Math\.random|randomBytes|fetch\(|from 'fs'|process\.env|prisma|PrismaService/);
  });
  it('usage and grants are tenant scoped; the prompt text of a user is never concatenated into the instruction part (the only template substitution is the three safe placeholders)', () => {
    for (const m of ['V3AiUsage', 'V3AiCreditGrant']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(true);
    const p = code(path.join(src, 'ai-studio/core/prompt.ts')); expect(p).toMatch(/\(feature\|maxChars\|language\)/); expect(p).not.toMatch(/\+ *data|\$\{.*data\[/);
  });
  it('vendor-linked tables cascade from Vendor and the staging cleanup removes the providers and prompts that staff test accounts created', () => {
    const migration = fs.readdirSync(path.resolve(__dirname, '../prisma/migrations')).find((d) => /_v3_ai_studio$/.test(d))!;
    const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8');
    for (const t of ['g4d_ai_usage', 'g4d_ai_credit_grants']) expect(sql).toMatch(new RegExp(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_vendorId_fkey"[^;]*ON DELETE CASCADE`));
    const cleanup = fs.readFileSync(path.resolve(__dirname, '../scripts/staging/test-tenant-cleanup.js'), 'utf8'); expect(cleanup).toContain('prisma.v3AiProvider.'); expect(cleanup).toContain('prisma.v3AiPrompt.');
  });
  it('the real module compiles and binds the port to the Prisma repository', async () => {
    const mod = await Test.createTestingModule({ imports: [PlansModule, AiStudioModule] }).overrideProvider(PrismaService).useValue({}).compile();
    expect(mod.get(AiStudioRepository)).toBeInstanceOf(PrismaAiStudioRepository); expect(mod.get(AiProviderGate)).toBeInstanceOf(AiProviderGate); await mod.close();
  });
});
