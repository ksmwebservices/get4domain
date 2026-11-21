import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { periodOf } from './core/credits';
import { FEATURE_KEYS, isFeatureKey } from './core/features';
import { validateTemplate } from './core/prompt';
import { aiError } from './ai-studio.errors';
import { AiStudioRepository, DuplicateProviderError, ProviderRow } from './ai-studio.repository';
import { AiProviderGate } from './providers/ai-provider-gate';
import { sealSecret } from './secret-box';
import { AiSettingsService } from './settings/ai-settings.service';

const PROVIDER_KEYS = ['openai', 'anthropic'];   // the two providers the platform already uses
const bad = (m: string): BadRequestException => new BadRequestException(aiError('AI_INVALID', m));
const need = (reason: unknown): string => { if (typeof reason !== 'string' || reason.trim().length < 3) throw bad('A reason of at least 3 characters is required.'); return reason.trim(); };

/** A provider as the API shows it: the secret is WRITE-ONLY. Only the last four characters and a yes/no are ever returned. */
export const providerView = (p: ProviderRow) => ({ id: p.id, key: p.key, kind: p.kind, displayName: p.displayName, status: p.status, model: p.model, hasSecret: !!p.secretCipher, secretLast4: p.secretLast4, settings: p.settings, createdAt: p.createdAt, updatedAt: p.updatedAt });

/** Staff side of AI Studio (slice 5.11): providers (secret write-only), prompt versions, credit grants, usage. Every write is audited with ids and non-secret fields only. */
@Injectable()
export class AiAdminService {
  clock: () => Date = () => new Date();
  constructor(private readonly repo: AiStudioRepository, private readonly gate: AiProviderGate, @Inject(AiSettingsService) private readonly settings: Pick<AiSettingsService, 'invalidate'>) {}

  // ───────────────────────────────────────────────────────────────────────────── providers
  async listProviders() { return (await this.repo.listProviders()).map(providerView); }

  async createProvider(i: { key: string; displayName: string; model: string; secret: string; status?: 'ACTIVE' | 'DISABLED'; settings?: Record<string, unknown> }, actor: Actor) {
    if (!PROVIDER_KEYS.includes(i.key)) throw bad(`key must be one of ${PROVIDER_KEYS.join(', ')}`);
    if (typeof i.secret !== 'string' || i.secret.trim().length < 8 || i.secret.length > 400) throw bad('The secret must be 8 to 400 characters.');
    if (typeof i.model !== 'string' || !/^[A-Za-z0-9._:-]{2,80}$/.test(i.model)) throw bad('Give the model name exactly as the provider names it.');
    const sealed = sealSecret(i.secret.trim());
    try {
      const row = await this.repo.createProvider({ key: i.key, displayName: String(i.displayName).trim().slice(0, 80) || i.key, status: i.status ?? 'DISABLED', secretCipher: sealed.cipher, secretIv: sealed.iv, secretTag: sealed.tag, secretLast4: sealed.last4, model: i.model, settings: i.settings ?? {}, createdByStaffId: actor.id });
      await this.repo.audit(actor, 'ai.provider.create', 'ai_provider', row.id, null, { key: row.key, status: row.status, model: row.model, secretLast4: row.secretLast4 });
      return providerView(row);
    } catch (e) { if (e instanceof DuplicateProviderError) throw new ConflictException(aiError('AI_PROVIDER_EXISTS', 'That provider is already set up; edit it instead.')); throw e; }
  }

  async updateProvider(id: string, p: { displayName?: string; model?: string; secret?: string; status?: 'ACTIVE' | 'DISABLED'; settings?: Record<string, unknown> }, actor: Actor) {
    const before = await this.repo.getProvider(id); if (!before) throw new NotFoundException(aiError('AI_PROVIDER_NOT_FOUND', 'That provider does not exist.'));
    const patch: Record<string, unknown> = {};
    if (p.displayName !== undefined) patch.displayName = String(p.displayName).trim().slice(0, 80);
    if (p.model !== undefined) { if (!/^[A-Za-z0-9._:-]{2,80}$/.test(p.model)) throw bad('Give the model name exactly as the provider names it.'); patch.model = p.model; }
    if (p.status !== undefined) patch.status = p.status;
    if (p.settings !== undefined) patch.settings = p.settings;
    if (p.secret !== undefined) { if (typeof p.secret !== 'string' || p.secret.trim().length < 8 || p.secret.length > 400) throw bad('The secret must be 8 to 400 characters.'); const s = sealSecret(p.secret.trim()); Object.assign(patch, { secretCipher: s.cipher, secretIv: s.iv, secretTag: s.tag, secretLast4: s.last4 }); }
    const row = await this.repo.updateProvider(id, patch);
    await this.repo.audit(actor, 'ai.provider.update', 'ai_provider', id, { status: before.status, model: before.model, secretLast4: before.secretLast4 }, { status: row.status, model: row.model, secretLast4: row.secretLast4, secretRotated: p.secret !== undefined });
    return providerView(row);
  }

  async testProvider(id: string, actor: Actor) {
    const row = await this.repo.getProvider(id); if (!row) throw new NotFoundException(aiError('AI_PROVIDER_NOT_FOUND', 'That provider does not exist.'));
    const r = await this.gate.test(row);
    await this.repo.audit(actor, 'ai.provider.test', 'ai_provider', id, null, { ok: r.ok, mode: r.mode });
    return r;
  }

  // ───────────────────────────────────────────────────────────────────────────── prompts
  async listPrompts(key?: string) { return this.repo.listPrompts(key && isFeatureKey(key) ? key : undefined); }

  async createPrompt(i: { key: string; template: string }, actor: Actor) {
    if (!isFeatureKey(i.key)) throw bad(`key must be one of ${FEATURE_KEYS.join(', ')}`);
    const problem = validateTemplate(i.template);
    if (problem) throw new BadRequestException(aiError('AI_PROMPT_INVALID', `The prompt cannot be saved: ${problem}.`));
    const row = await this.repo.createPrompt({ key: i.key, template: i.template, createdByStaffId: actor.id });
    await this.repo.audit(actor, 'ai.prompt.create', 'ai_prompt', row.id, null, { key: row.key, version: row.version, status: row.status });
    return row;
  }

  async activatePrompt(id: string, actor: Actor) {
    const before = await this.repo.getPrompt(id); if (!before) throw new NotFoundException(aiError('AI_PROMPT_NOT_FOUND', 'That prompt version does not exist.'));
    const prev = await this.repo.activePrompt(before.key);
    const row = await this.repo.activatePrompt(id);
    await this.repo.audit(actor, 'ai.prompt.activate', 'ai_prompt', id, { activeVersion: prev?.version ?? null }, { key: row.key, version: row.version });
    return row;
  }

  // ───────────────────────────────────────────────────────────────────────────── credits and usage
  async grantCredits(i: { vendorId: string; credits: number; reason: string }, actor: Actor) {
    const reason = need(i.reason);
    if (!Number.isInteger(i.credits) || i.credits < 1 || i.credits > 10_000) throw bad('credits must be a whole number from 1 to 10000.');
    if (typeof i.vendorId !== 'string' || !i.vendorId) throw bad('A vendor is required.');
    const row = await this.repo.addGrant({ vendorId: i.vendorId, credits: i.credits, reason, grantedByStaffId: actor.id ?? 'unknown', period: periodOf(this.clock()) });
    await this.repo.audit(actor, 'ai.credits.grant', 'vendor', i.vendorId, null, { credits: i.credits, period: row.period, reason });
    return { id: row.id, vendorId: row.vendorId, credits: row.credits, period: row.period, createdAt: row.createdAt };
  }

  async usageReport(q: { vendorId?: string; period?: string; skip: number; take: number }) {
    const period = q.period ?? periodOf(this.clock());
    const r = await this.repo.usageReport({ ...q, period });
    return { period, creditsUsed: r.creditsUsed, total: r.total, items: r.items.map((u) => ({ id: u.id, vendorId: u.vendorId, feature: u.featureKey, provider: u.providerKey, credits: u.credits, inputTokens: u.inputTokens, outputTokens: u.outputTokens, status: u.status, createdAt: u.createdAt })) };
  }
}
