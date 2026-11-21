import { ResolvedEntitlements } from '../../src/plans/entitlements/entitlement-engine';
import { AiAdminService } from '../../src/ai-studio/ai-admin.service';
import { AiGenerateService } from '../../src/ai-studio/ai-generate.service';
import { AiProvider, AiRequest, AiResponse } from '../../src/ai-studio/providers/ai-provider.port';
import { AiProviderGate } from '../../src/ai-studio/providers/ai-provider-gate';
import { AiSettings, DEFAULT_AI_SETTINGS } from '../../src/ai-studio/settings/ai-settings';
import { MemoryAiRepo } from './memory-ai-repo';

export const T0 = new Date('2026-11-05T10:00:00.000Z');
export const VENDOR = { type: 'VENDOR' as const, id: 'v1', ip: null };
export const SUPER = { type: 'STAFF' as const, id: 'super-1', ip: null };
export const GOOD = { section: 'tagline', businessName: 'Sri Ganesh Plumbing', category: 'plumber', keyPoints: 'fast and tidy' };

/** A provider double that records what it was asked and answers with a script. Used where the mock is not enough (a leaky or failing model). */
export class ScriptedProvider extends AiProvider {
  readonly mode = 'mock' as const; calls: AiRequest[] = []; reply: (r: AiRequest) => string | Error = () => 'A short, honest line about the business.';
  async generate(r: AiRequest): Promise<AiResponse> { this.calls.push(r); const out = this.reply(r); if (out instanceof Error) throw out; return { text: out, inputTokens: 10, outputTokens: 5 }; }
}

export interface AiWorld {
  repo: MemoryAiRepo; gate: AiProviderGate; svc: AiGenerateService; admin: AiAdminService; now: { t: Date }; settings: { over: Partial<AiSettings> }; ents: Map<string, ResolvedEntitlements>;
  scripted: ScriptedProvider; useScripted(): void; gen(over?: Partial<{ feature: string; input: unknown; idempotencyKey: string }>, vendorId?: string): ReturnType<AiGenerateService['generate']>;
}
export const aiEntitlement = (state: string, limit: number | null, upsellText: string | null = null): ResolvedEntitlements => ({
  mode: 'V3', plan: 'handyman_pro', subscribedPlan: 'handyman_pro', track: 'handyman', level: 'PRO', subscriptionStatus: 'ACTIVE', graceWarning: false, suspended: false,
  features: { 'ai.credits_included': { state: state as never, limit, enumValue: null, upsellText, overLimit: false, source: 'PLAN' as never } },
});

export function aiWorld(): AiWorld {
  const repo = new MemoryAiRepo(); const now = { t: new Date(T0) }; const settings = { over: {} as Partial<AiSettings> }; const ents = new Map<string, ResolvedEntitlements>();
  repo.clock = () => new Date(now.t);
  const settingsService = { get: async (): Promise<AiSettings> => ({ ...DEFAULT_AI_SETTINGS, ...settings.over }), invalidate: () => undefined } as never;
  const gate = new AiProviderGate(repo, settingsService);
  const entService = { resolve: async (v: string) => ents.get(v) ?? aiEntitlement('LIMITED', 5) } as never;
  const svc = new AiGenerateService(repo, settingsService, gate, entService); svc.clock = () => new Date(now.t);
  const admin = new AiAdminService(repo, gate, settingsService); admin.clock = () => new Date(now.t);
  const scripted = new ScriptedProvider(); let k = 0;
  const useScripted = (): void => { gate.resolve = async () => ({ provider: scripted, providerKey: 'mock' }); };
  const gen = (over: Partial<{ feature: string; input: unknown; idempotencyKey: string }> = {}, vendorId = 'v1') => svc.generate(vendorId, { feature: 'site_copy', input: { ...GOOD }, idempotencyKey: `ai-key-${++k}-abcdef`, ...over }, VENDOR);
  return { repo, gate, svc, admin, now, settings, ents, scripted, useScripted, gen };
}
