import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { advisoryXactLock } from '../common/db-lock';
import { KeyedQueue } from '../common/keyed-queue';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiStudioRepository, AiTx, DuplicateProviderError, DuplicateUsageError, GrantRow, NewProvider, PromptRow, ProviderPatch, ProviderRow, UsageRow, UsageStatus } from './ai-studio.repository';

const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
type Db = Prisma.TransactionClient | PrismaService;
const toProvider = (p: Prisma.V3AiProviderGetPayload<Record<string, never>>): ProviderRow => ({ id: p.id, key: p.key, kind: p.kind, displayName: p.displayName, status: p.status, secretCipher: p.secretCipher, secretIv: p.secretIv, secretTag: p.secretTag, secretLast4: p.secretLast4, model: p.model, settings: obj(p.settingsJson), createdByStaffId: p.createdByStaffId, createdAt: p.createdAt, updatedAt: p.updatedAt });
const toUsage = (u: Prisma.V3AiUsageGetPayload<Record<string, never>>): UsageRow => ({ ...u });
const toPrompt = (p: Prisma.V3AiPromptGetPayload<Record<string, never>>): PromptRow => ({ id: p.id, key: p.key, version: p.version, template: p.template, status: p.status, createdByStaffId: p.createdByStaffId, createdAt: p.createdAt });
const COUNTED: UsageStatus[] = ['RESERVED', 'DONE'];

const used = async (db: Db, vendorId: string, period: string): Promise<number> => (await db.v3AiUsage.aggregate({ where: { vendorId, period, status: { in: COUNTED } }, _sum: { credits: true } }))._sum.credits ?? 0;
const granted = async (db: Db, vendorId: string, period: string): Promise<number> => (await db.v3AiCreditGrant.aggregate({ where: { vendorId, period }, _sum: { credits: true } }))._sum.credits ?? 0;

@Injectable()
export class PrismaAiStudioRepository extends AiStudioRepository {
  /** Waiting for a vendor's turn happens here, in memory, NOT inside a transaction (see keyed-queue.ts: pool starvation). */
  private readonly queue = new KeyedQueue();
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService) { super(); }

  async listProviders() { return (await this.prisma.v3AiProvider.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(toProvider); }
  async getProvider(id: string) { const p = await this.prisma.v3AiProvider.findUnique({ where: { id } }); return p ? toProvider(p) : null; }
  async getProviderByKey(key: string) { const p = await this.prisma.v3AiProvider.findUnique({ where: { key } }); return p ? toProvider(p) : null; }
  async activeProviders() { return (await this.prisma.v3AiProvider.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(toProvider); }
  async createProvider(d: NewProvider) {
    try { return toProvider(await this.prisma.v3AiProvider.create({ data: { key: d.key, displayName: d.displayName, status: d.status, secretCipher: d.secretCipher, secretIv: d.secretIv, secretTag: d.secretTag, secretLast4: d.secretLast4, model: d.model, settingsJson: d.settings as Prisma.InputJsonValue, createdByStaffId: d.createdByStaffId } })); }
    catch (e) { if (isUnique(e)) throw new DuplicateProviderError(); throw e; }
  }
  async updateProvider(id: string, p: ProviderPatch) { const { settings, ...rest } = p; return toProvider(await this.prisma.v3AiProvider.update({ where: { id }, data: { ...rest, ...(settings !== undefined ? { settingsJson: settings as Prisma.InputJsonValue } : {}) } })); }

  async activePrompt(key: string) { const p = await this.prisma.v3AiPrompt.findUnique({ where: { activeKey: key } }); return p ? toPrompt(p) : null; }
  async listPrompts(key?: string) { return (await this.prisma.v3AiPrompt.findMany({ where: key ? { key } : {}, orderBy: [{ key: 'asc' }, { version: 'desc' }] })).map(toPrompt); }
  async getPrompt(id: string) { const p = await this.prisma.v3AiPrompt.findUnique({ where: { id } }); return p ? toPrompt(p) : null; }
  async createPrompt(d: { key: string; template: string; createdByStaffId: string | null }) {
    return this.prisma.$transaction(async (tx) => {
      await advisoryXactLock(tx, `ai-prompt:${d.key}`);
      const max = await tx.v3AiPrompt.aggregate({ where: { key: d.key }, _max: { version: true } });
      return toPrompt(await tx.v3AiPrompt.create({ data: { key: d.key, version: (max._max.version ?? 0) + 1, template: d.template, status: 'DRAFT', createdByStaffId: d.createdByStaffId } }));
    });
  }
  async activatePrompt(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.v3AiPrompt.findUniqueOrThrow({ where: { id } });
      await advisoryXactLock(tx, `ai-prompt:${p.key}`);
      await tx.v3AiPrompt.updateMany({ where: { key: p.key, status: 'ACTIVE', id: { not: id } }, data: { status: 'RETIRED', activeKey: null } });
      return toPrompt(await tx.v3AiPrompt.update({ where: { id }, data: { status: 'ACTIVE', activeKey: p.key } }));
    });
  }

  async addGrant(d: { vendorId: string; credits: number; reason: string; grantedByStaffId: string; period: string }): Promise<GrantRow> { return this.prisma.v3AiCreditGrant.create({ data: d }); }
  grantedCredits(vendorId: string, period: string) { return granted(this.prisma, vendorId, period); }
  usedCredits(vendorId: string, period: string) { return used(this.prisma, vendorId, period); }

  async findUsageByKey(vendorId: string, key: string) { const u = await this.prisma.v3AiUsage.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } } }); return u ? toUsage(u) : null; }
  async updateUsage(id: string, patch: { status?: UsageStatus; inputTokens?: number; outputTokens?: number; resultText?: string | null; providerKey?: string }) { await this.prisma.v3AiUsage.update({ where: { id }, data: patch }); }
  async listUsage(vendorId: string, period: string, take: number) { return (await this.prisma.v3AiUsage.findMany({ where: { vendorId, period }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take })).map(toUsage); }
  async usageReport(q: { vendorId?: string; period?: string; skip: number; take: number }) {
    const where: Prisma.V3AiUsageWhereInput = { ...(q.vendorId ? { vendorId: q.vendorId } : {}), ...(q.period ? { period: q.period } : {}) };
    const [rows, total, sum] = await Promise.all([this.prisma.v3AiUsage.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: q.skip, take: q.take }), this.prisma.v3AiUsage.count({ where }), this.prisma.v3AiUsage.aggregate({ where: { ...where, status: { in: COUNTED } }, _sum: { credits: true } })]);
    return { items: rows.map(toUsage), total, creditsUsed: sum._sum.credits ?? 0 };
  }

  transaction<T>(vendorId: string, fn: (tx: AiTx) => Promise<T>): Promise<T> {
    return this.queue.run(`ai-credits:${vendorId}`, () => this.prisma.$transaction(async (db) => {
      await advisoryXactLock(db, `ai-credits:${vendorId}`);
      const tx: AiTx = {
        usedCredits: (v, p) => used(db, v, p), grantedCredits: (v, p) => granted(db, v, p),
        findUsageByKey: async (v, k) => { const u = await db.v3AiUsage.findUnique({ where: { vendorId_idempotencyKey: { vendorId: v, idempotencyKey: k } } }); return u ? toUsage(u) : null; },
        insertUsage: async (d) => { try { return toUsage(await db.v3AiUsage.create({ data: { ...d, status: 'RESERVED' } })); } catch (e) { if (isUnique(e)) throw new DuplicateUsageError(); throw e; } },
      };
      return fn(tx);
    }, { timeout: 20_000, maxWait: 15_000 }));
  }

  async audit(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown) { await this.prisma.$transaction((tx) => this.audits.record(tx, actor, action, entityType, entityId, before, after)); }
}
