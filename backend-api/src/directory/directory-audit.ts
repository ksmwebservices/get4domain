import { Injectable } from '@nestjs/common';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/** Where the directory slice writes its audit rows (g4d_audit_logs through the existing AuditService). Ids and masked values only; never a phone number, code, token or email. */
export abstract class DirectoryAudit {
  abstract record(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}

@Injectable()
export class PrismaDirectoryAudit extends DirectoryAudit {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) { super(); }
  async record(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown): Promise<void> {
    await this.prisma.$transaction((tx) => this.audit.record(tx, actor, action, entityType, entityId, before, after));
  }
}
