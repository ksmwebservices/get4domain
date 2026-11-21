import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { planError } from '../plans/plans.errors';
import { canSpend, creditAllowance, periodOf, remainingCredits } from './core/credits';
import { FeatureKey, isFeatureKey, validateFeatureInput } from './core/features';
import { scanOutput } from './core/output-scan';
import { buildMessages, DEFAULT_TEMPLATES } from './core/prompt';
import { AI_LABEL, aiError } from './ai-studio.errors';
import { AiStudioRepository, DuplicateUsageError, UsageRow } from './ai-studio.repository';
import { AiProviderGate } from './providers/ai-provider-gate';
import { AiSettingsService } from './settings/ai-settings.service';

export interface GenerateInput { feature: string; input: unknown; idempotencyKey: string }
export type GenerateResult =
  | { aiGenerated: true; label: string; feature: string; blocked: false; text: string; credits: { cost: number; remaining: number | null }; usageId: string; replayed: boolean }
  | { aiGenerated: true; label: string; feature: string; blocked: true; reasons: string[]; credits: { cost: 0; remaining: number | null }; usageId: string; replayed: boolean };

const FEATURE_ENTITLEMENT = 'ai.credits_included';

/**
 * AI suggestions for the vendor (slice 5.11). Order of play: validate the input, check the plan (FEATURE_LOCKED with the upsell text if AI is not part of it), RESERVE credits under a per-vendor
 * lock (so two requests cannot overspend), call the model OUTSIDE the lock, scan the answer, then settle: DONE, or FAILED / REFUNDED (the credits come back). The same idempotency key never
 * charges twice. The text is always labelled AI-generated, length capped, scanned for banned words, prices and personal data, and NEVER published: the vendor accepts it into a draft
 * field through the normal APIs. User text goes into the DATA block of the prompt only (see core/prompt.ts).
 * GAP (recorded): wallet-purchased credits are not included. The wallet code is legacy (decision D1) and cannot be reused without touching legacy tables, so only the plan's included credits
 * and credits staff grant are counted.
 */
@Injectable()
export class AiGenerateService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly repo: AiStudioRepository, @Inject(AiSettingsService) private readonly settings: Pick<AiSettingsService, 'get'>, private readonly gate: AiProviderGate,
    @Inject(EntitlementsService) private readonly entitlements: Pick<EntitlementsService, 'resolve'>,
  ) {}

  private async plan(vendorId: string) {
    const f = (await this.entitlements.resolve(vendorId)).features[FEATURE_ENTITLEMENT];
    return { state: f?.state ?? 'HIDDEN', limit: f?.limit ?? null, upsellText: f?.upsellText ?? null };
  }

  async generate(vendorId: string, i: GenerateInput, _actor: Actor): Promise<GenerateResult> {
    const s = await this.settings.get();
    if (!isFeatureKey(i.feature)) throw new BadRequestException(aiError('AI_INVALID', 'That is not an AI feature.'));
    const key = String(i.idempotencyKey ?? '');
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new BadRequestException(aiError('AI_INVALID', 'idempotencyKey must be 8 to 80 letters, digits, dash or underscore.'));
    const v = validateFeatureInput(i.feature, i.input, s.aiMaxInputChars);
    if (!v.ok) throw new BadRequestException(aiError('AI_INVALID', `The request is not valid: ${v.problem}.`));
    const feature: FeatureKey = i.feature; const now = this.clock(); const period = periodOf(now);
    const cost = s.aiCreditCosts[feature];

    const prior = await this.repo.findUsageByKey(vendorId, key);
    if (prior) return this.replay(prior, feature, vendorId, period);

    const plan = await this.plan(vendorId);
    const grants = await this.repo.grantedCredits(vendorId, period);
    const allowance = creditAllowance(plan, grants);
    if (!allowance.allowed) throw new ForbiddenException(planError('FEATURE_LOCKED', 'AI suggestions are not part of your plan.', { feature: FEATURE_ENTITLEMENT, upsellText: plan.upsellText }));

    // reserve under the vendor lock: check what is left and write the reservation in one step
    let usage: UsageRow; let created = true;
    try {
      const r = await this.repo.transaction(vendorId, async (tx) => {
        const existing = await tx.findUsageByKey(vendorId, key); if (existing) return { row: existing, created: false };
        const used = await tx.usedCredits(vendorId, period); const g = await tx.grantedCredits(vendorId, period);
        if (!canSpend(creditAllowance(plan, g), used, cost)) throw new ForbiddenException(planError('LIMIT_REACHED', `Your plan includes ${plan.limit ?? 0} AI credits this month and you have used them.`, { feature: FEATURE_ENTITLEMENT, upsellText: plan.upsellText, limit: plan.limit }));
        return { row: await tx.insertUsage({ vendorId, featureKey: feature, providerKey: 'pending', credits: cost, idempotencyKey: key, period }), created: true };
      });
      usage = r.row; created = r.created;
    } catch (e) {
      if (e instanceof DuplicateUsageError) { const again = await this.repo.findUsageByKey(vendorId, key); if (again) return this.replay(again, feature, vendorId, period); }
      throw e;
    }
    if (!created) return this.replay(usage, feature, vendorId, period);   // another request with this key got there first: never call the model twice for one key

    const maxChars = s.aiOutputMaxChars[feature];
    const template = (await this.repo.activePrompt(feature))?.template ?? DEFAULT_TEMPLATES[feature];
    const language = (v.data.language === 'ta' ? 'ta' : 'en') as 'en' | 'ta';
    let resolvedKey = 'mock';
    try {
      const messages = buildMessages(template, feature, v.data, { language, maxChars });
      const r = await this.gate.resolve(); resolvedKey = r.providerKey;
      const out = await r.provider.generate({ system: messages.system, user: messages.user, maxOutputTokens: Math.min(1000, Math.ceil(maxChars / 2)) });
      const scanned = scanOutput(out.text, { maxChars, bannedWords: s.aiBannedWords });
      if (!scanned.ok) {
        await this.repo.updateUsage(usage.id, { status: 'REFUNDED', providerKey: resolvedKey, inputTokens: out.inputTokens, outputTokens: out.outputTokens });
        return { aiGenerated: true, label: AI_LABEL, feature, blocked: true, reasons: scanned.flags, credits: { cost: 0, remaining: await this.remaining(vendorId, period, plan, null) }, usageId: usage.id, replayed: false };
      }
      await this.repo.updateUsage(usage.id, { status: 'DONE', providerKey: resolvedKey, inputTokens: out.inputTokens, outputTokens: out.outputTokens, resultText: scanned.text });
      return { aiGenerated: true, label: AI_LABEL, feature, blocked: false, text: scanned.text, credits: { cost, remaining: await this.remaining(vendorId, period, plan, null) }, usageId: usage.id, replayed: false };
    } catch (e) {
      await this.repo.updateUsage(usage.id, { status: 'FAILED', providerKey: resolvedKey }).catch(() => undefined);   // the credits come back
      if (e instanceof ConflictException || e instanceof BadRequestException || e instanceof ForbiddenException) throw e;
      throw new ConflictException(aiError('AI_PROVIDER_ERROR', 'The suggestion could not be made. You have not been charged; please try again.'));
    }
  }

  private async remaining(vendorId: string, period: string, plan: { state: string; limit: number | null }, _x: null): Promise<number | null> {
    return remainingCredits(creditAllowance(plan, await this.repo.grantedCredits(vendorId, period)), await this.repo.usedCredits(vendorId, period));
  }

  private async replay(u: UsageRow, feature: FeatureKey, vendorId: string, period: string): Promise<GenerateResult> {
    if (u.featureKey !== feature) throw new ConflictException(aiError('AI_IDEMPOTENCY_CONFLICT', 'That request key was already used for a different request.'));
    const plan = await this.plan(vendorId); const remaining = await this.remaining(vendorId, u.period || period, plan, null);
    if (u.status === 'DONE' && u.resultText) return { aiGenerated: true, label: AI_LABEL, feature, blocked: false, text: u.resultText, credits: { cost: u.credits, remaining }, usageId: u.id, replayed: true };
    if (u.status === 'REFUNDED') return { aiGenerated: true, label: AI_LABEL, feature, blocked: true, reasons: ['BLOCKED'], credits: { cost: 0, remaining }, usageId: u.id, replayed: true };
    throw new ConflictException(aiError(u.status === 'FAILED' ? 'AI_PROVIDER_ERROR' : 'AI_IDEMPOTENCY_CONFLICT', u.status === 'FAILED' ? 'That request failed earlier and was not charged. Please send it again with a new key.' : 'That request is still being worked on.'));
  }

  async usage(vendorId: string) {
    const s = await this.settings.get(); const period = periodOf(this.clock()); const plan = await this.plan(vendorId);
    const granted = await this.repo.grantedCredits(vendorId, period); const used = await this.repo.usedCredits(vendorId, period); const a = creditAllowance(plan, granted);
    const rows = await this.repo.listUsage(vendorId, period, 50);
    return {
      period, allowed: a.allowed, unlimited: a.unlimited, included: a.allowed && !a.unlimited ? Math.max(0, (plan.limit ?? 0)) : null, granted, used, remaining: remainingCredits(a, used), costs: s.aiCreditCosts,
      recent: rows.map((r) => ({ id: r.id, feature: r.featureKey, credits: r.credits, status: r.status, createdAt: r.createdAt })), upsellText: a.allowed ? null : plan.upsellText,
    };
  }
}
