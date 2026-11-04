import { Actor } from '../plans/admin/audit.service';

export type ProviderStatus = 'ACTIVE' | 'DISABLED';
export type UsageStatus = 'RESERVED' | 'DONE' | 'FAILED' | 'REFUNDED';
export type PromptStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';

export interface ProviderRow {
  id: string; key: string; kind: 'TEXT_LLM'; displayName: string; status: ProviderStatus; secretCipher: string | null; secretIv: string | null; secretTag: string | null; secretLast4: string | null;
  model: string; settings: Record<string, unknown>; createdByStaffId: string | null; createdAt: Date; updatedAt: Date;
}
export type NewProvider = Pick<ProviderRow, 'key' | 'displayName' | 'status' | 'secretCipher' | 'secretIv' | 'secretTag' | 'secretLast4' | 'model' | 'settings' | 'createdByStaffId'>;
export type ProviderPatch = Partial<Pick<ProviderRow, 'displayName' | 'status' | 'secretCipher' | 'secretIv' | 'secretTag' | 'secretLast4' | 'model' | 'settings'>>;
export interface UsageRow {
  id: string; vendorId: string; featureKey: string; providerKey: string; credits: number; inputTokens: number; outputTokens: number; idempotencyKey: string; status: UsageStatus; period: string;
  resultText: string | null; createdAt: Date; updatedAt: Date;
}
export interface PromptRow { id: string; key: string; version: number; template: string; status: PromptStatus; createdByStaffId: string | null; createdAt: Date }
export interface GrantRow { id: string; vendorId: string; credits: number; reason: string; grantedByStaffId: string; period: string; createdAt: Date }

export class DuplicateUsageError extends Error { constructor() { super('duplicate usage'); } }
export class DuplicateProviderError extends Error { constructor() { super('duplicate provider'); } }

/** The writes that must be serialised per vendor: check the credits left and reserve them in one step. */
export interface AiTx {
  usedCredits(vendorId: string, period: string): Promise<number>;
  grantedCredits(vendorId: string, period: string): Promise<number>;
  findUsageByKey(vendorId: string, key: string): Promise<UsageRow | null>;
  insertUsage(d: { vendorId: string; featureKey: string; providerKey: string; credits: number; idempotencyKey: string; period: string }): Promise<UsageRow>;
}

export abstract class AiStudioRepository {
  abstract listProviders(): Promise<ProviderRow[]>;
  abstract getProvider(id: string): Promise<ProviderRow | null>;
  abstract getProviderByKey(key: string): Promise<ProviderRow | null>;
  abstract activeProviders(): Promise<ProviderRow[]>;
  abstract createProvider(d: NewProvider): Promise<ProviderRow>;
  abstract updateProvider(id: string, p: ProviderPatch): Promise<ProviderRow>;

  abstract activePrompt(key: string): Promise<PromptRow | null>;
  abstract listPrompts(key?: string): Promise<PromptRow[]>;
  abstract getPrompt(id: string): Promise<PromptRow | null>;
  abstract createPrompt(d: { key: string; template: string; createdByStaffId: string | null }): Promise<PromptRow>;
  /** makes this version the one ACTIVE version of its key (the previous one is RETIRED), atomically */
  abstract activatePrompt(id: string): Promise<PromptRow>;

  abstract addGrant(d: { vendorId: string; credits: number; reason: string; grantedByStaffId: string; period: string }): Promise<GrantRow>;
  abstract grantedCredits(vendorId: string, period: string): Promise<number>;

  abstract usedCredits(vendorId: string, period: string): Promise<number>;
  abstract findUsageByKey(vendorId: string, key: string): Promise<UsageRow | null>;
  abstract updateUsage(id: string, patch: { status?: UsageStatus; inputTokens?: number; outputTokens?: number; resultText?: string | null; providerKey?: string }): Promise<void>;
  abstract listUsage(vendorId: string, period: string, take: number): Promise<UsageRow[]>;
  abstract usageReport(q: { vendorId?: string; period?: string; skip: number; take: number }): Promise<{ items: UsageRow[]; total: number; creditsUsed: number }>;
  /** one transaction per vendor at a time (advisory lock) */
  abstract transaction<T>(vendorId: string, fn: (tx: AiTx) => Promise<T>): Promise<T>;

  abstract audit(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}
