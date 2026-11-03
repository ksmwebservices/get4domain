import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { redactSecrets } from '../../common/utils/redact-secrets';
import { PageQueryDto, pageArgs, paged } from './plans-admin.common';

export interface Actor { type: 'STAFF' | 'VENDOR' | 'SYSTEM'; id: string | null; ip: string | null }

/** JSON-safe copy (dates become ISO strings) with credential-looking fields removed. Secrets never reach g4d_audit_logs. */
const clean = (v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull => (v === undefined || v === null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(redactSecrets(v))) as Prisma.InputJsonValue));

/** Append-only change log. `record` takes the open transaction, so a change and its audit row are saved together or not at all. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: Prisma.TransactionClient, actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown): Promise<void> {
    await tx.v3AuditLog.create({
      data: { actorType: actor.type, actorId: actor.id, action, entityType, entityId, beforeJson: clean(before), afterJson: clean(after), ip: actor.ip },
    });
  }

  async list(q: PageQueryDto & { entityType?: string; entityId?: string }) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const where: Prisma.V3AuditLogWhereInput = { ...(q.entityType ? { entityType: q.entityType } : {}), ...(q.entityId ? { entityId: q.entityId } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.v3AuditLog.findMany({ where, orderBy: { at: 'desc' }, skip, take }),
      this.prisma.v3AuditLog.count({ where }),
    ]);
    return paged(items, total, page, pageSize);
  }
}
