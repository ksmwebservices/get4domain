import { Actor } from '../../src/plans/admin/audit.service';
import { AiStudioRepository, AiTx, DuplicateProviderError, DuplicateUsageError, GrantRow, NewProvider, PromptRow, ProviderPatch, ProviderRow, UsageRow, UsageStatus } from '../../src/ai-studio/ai-studio.repository';

const COUNTED: UsageStatus[] = ['RESERVED', 'DONE'];

/** In-memory twin of the Prisma AI Studio repository: unique keys, one ACTIVE prompt per key, per-vendor serialised reservations. */
export class MemoryAiRepo extends AiStudioRepository {
  providers = new Map<string, ProviderRow>(); usage = new Map<string, UsageRow>(); prompts = new Map<string, PromptRow>(); grants: GrantRow[] = [];
  audits: Array<{ actor: Actor; action: string; entityType: string; entityId: string | null; before: unknown; after: unknown }> = [];
  clock: () => Date = () => new Date();
  private n = 0; private chain: Promise<unknown> = Promise.resolve();
  private id(p: string): string { return `${p}-${++this.n}`; }

  async listProviders() { return [...this.providers.values()].map((p) => ({ ...p })); }
  async getProvider(id: string) { const p = this.providers.get(id); return p ? { ...p } : null; }
  async getProviderByKey(key: string) { const p = [...this.providers.values()].find((x) => x.key === key); return p ? { ...p } : null; }
  async activeProviders() { return [...this.providers.values()].filter((p) => p.status === 'ACTIVE').map((p) => ({ ...p })); }
  async createProvider(d: NewProvider) {
    if ([...this.providers.values()].some((p) => p.key === d.key)) throw new DuplicateProviderError();
    const now = this.clock(); const r: ProviderRow = { id: this.id('prov'), kind: 'TEXT_LLM', ...d, createdAt: now, updatedAt: now }; this.providers.set(r.id, r); return { ...r };
  }
  async updateProvider(id: string, p: ProviderPatch) { const r = this.providers.get(id)!; Object.assign(r, p, { updatedAt: this.clock() }); return { ...r }; }

  async activePrompt(key: string) { const p = [...this.prompts.values()].find((x) => x.key === key && x.status === 'ACTIVE'); return p ? { ...p } : null; }
  async listPrompts(key?: string) { return [...this.prompts.values()].filter((p) => !key || p.key === key).sort((a, b) => a.key.localeCompare(b.key) || b.version - a.version).map((p) => ({ ...p })); }
  async getPrompt(id: string) { const p = this.prompts.get(id); return p ? { ...p } : null; }
  async createPrompt(d: { key: string; template: string; createdByStaffId: string | null }) {
    const version = Math.max(0, ...[...this.prompts.values()].filter((p) => p.key === d.key).map((p) => p.version)) + 1;
    const r: PromptRow = { id: this.id('prm'), key: d.key, version, template: d.template, status: 'DRAFT', createdByStaffId: d.createdByStaffId, createdAt: this.clock() }; this.prompts.set(r.id, r); return { ...r };
  }
  async activatePrompt(id: string) { const p = this.prompts.get(id)!; for (const o of this.prompts.values()) if (o.key === p.key && o.status === 'ACTIVE' && o.id !== id) o.status = 'RETIRED'; p.status = 'ACTIVE'; return { ...p }; }

  async addGrant(d: { vendorId: string; credits: number; reason: string; grantedByStaffId: string; period: string }) { const g: GrantRow = { ...d, id: this.id('grant'), createdAt: this.clock() }; this.grants.push(g); return { ...g }; }
  async grantedCredits(v: string, period: string) { return this.grants.filter((g) => g.vendorId === v && g.period === period).reduce((n, g) => n + g.credits, 0); }
  async usedCredits(v: string, period: string) { return [...this.usage.values()].filter((u) => u.vendorId === v && u.period === period && COUNTED.includes(u.status)).reduce((n, u) => n + u.credits, 0); }
  async findUsageByKey(v: string, k: string) { const u = [...this.usage.values()].find((x) => x.vendorId === v && x.idempotencyKey === k); return u ? { ...u } : null; }
  async updateUsage(id: string, patch: { status?: UsageStatus; inputTokens?: number; outputTokens?: number; resultText?: string | null; providerKey?: string }) { Object.assign(this.usage.get(id)!, patch, { updatedAt: this.clock() }); }
  async listUsage(v: string, period: string, take: number) { return [...this.usage.values()].filter((u) => u.vendorId === v && u.period === period).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take).map((u) => ({ ...u })); }
  async usageReport(q: { vendorId?: string; period?: string; skip: number; take: number }) {
    const all = [...this.usage.values()].filter((u) => (!q.vendorId || u.vendorId === q.vendorId) && (!q.period || u.period === q.period));
    return { items: all.slice(q.skip, q.skip + q.take).map((u) => ({ ...u })), total: all.length, creditsUsed: all.filter((u) => COUNTED.includes(u.status)).reduce((n, u) => n + u.credits, 0) };
  }
  async transaction<T>(_v: string, fn: (tx: AiTx) => Promise<T>): Promise<T> {
    const run = this.chain.catch(() => undefined).then(() => fn({
      usedCredits: (v, p) => this.usedCredits(v, p), grantedCredits: (v, p) => this.grantedCredits(v, p), findUsageByKey: (v, k) => this.findUsageByKey(v, k),
      insertUsage: async (d) => {
        if ([...this.usage.values()].some((u) => u.vendorId === d.vendorId && u.idempotencyKey === d.idempotencyKey)) throw new DuplicateUsageError();
        const now = this.clock(); const u: UsageRow = { ...d, id: this.id('use'), inputTokens: 0, outputTokens: 0, status: 'RESERVED', resultText: null, createdAt: now, updatedAt: now }; this.usage.set(u.id, u); return { ...u };
      },
    }));
    this.chain = run.catch(() => undefined); return run;
  }
  async audit(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown) { this.audits.push({ actor, action, entityType, entityId, before, after }); }
}
