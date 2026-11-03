import { Injectable } from '@nestjs/common';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProvisioningAudit } from './runner/job-runner.service';

/** Writes provisioning events to the slice 5.1 audit log (g4d_audit_logs). Ids and codes only; AuditService also strips credential-looking fields. */
@Injectable()
export class PrismaProvisioningAudit extends ProvisioningAudit {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) { super(); }

  async record(actor: Actor, action: string, entityType: string, entityId: string | null, after: unknown): Promise<void> {
    await this.prisma.$transaction((tx) => this.audit.record(tx, actor, action, entityType, entityId, null, after));
  }
}
