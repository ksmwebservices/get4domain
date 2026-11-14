import { Injectable } from '@nestjs/common';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/** Where the SEO block writes its audit rows (g4d_audit_logs through the existing AuditService): the activity log of every staff change. Ids and keyword text only. */
export abstract class SeoAudit {
  abstract record(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}

@Injectable()
export class PrismaSeoAudit extends SeoAudit {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) { super(); }
  async record(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown): Promise<void> {
    await this.prisma.$transaction((tx) => this.audit.record(tx, actor, action, entityType, entityId, before, after));
  }
}
