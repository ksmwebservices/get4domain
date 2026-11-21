import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor, AuditService } from '../../plans/admin/audit.service';
import { TxHook } from './site.repository';

/** Builds the audit hook the repository runs inside its transaction, so a change and its g4d_audit_logs row are saved together or not at all. Ids and codes only. */
export abstract class SiteAudit {
  abstract hook(actor: Actor, action: string, entityId: string, after: Record<string, unknown>): TxHook;
}

@Injectable()
export class PrismaSiteAudit extends SiteAudit {
  constructor(private readonly audit: AuditService) { super(); }
  hook(actor: Actor, action: string, entityId: string, after: Record<string, unknown>): TxHook {
    return (tx) => this.audit.record(tx as Prisma.TransactionClient, actor, action, 'site', entityId, null, after);
  }
}
