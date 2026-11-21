import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { b3Error } from '../b3-settings/b3-errors';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { cleanReason } from '../vendor-lifecycle/core/lifecycle-core';

export const INDEXING_KEY = 'seededSiteIndexingMode';

/**
 * The one setting that decides whether search engines may be offered seeded pages (owner rule 8: OFF by default, until counsel approves). It can only be changed here, by a SUPER_ADMIN
 * (the role matrix), with a REQUIRED reason, and every change leaves an audit row with before and after. The generic settings route does not own this key.
 */
@Injectable()
export class SeededSettingsService {
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService, @Inject(B3SettingsService) private readonly b3: Pick<B3SettingsService, 'get'> & { invalidate(): void }) {}

  async mode() { return { mode: (await this.b3.get()).seededSiteIndexingMode }; }

  async setMode(mode: unknown, reasonIn: unknown, actor: Actor) {
    if (mode !== 'OFF' && mode !== 'QUALITY') throw new BadRequestException(b3Error('SEEDED_INVALID', 'The mode must be OFF or QUALITY.'));
    const reason = cleanReason(reasonIn);
    if (!reason) throw new BadRequestException(b3Error('LIFECYCLE_REASON_REQUIRED', 'A reason of 5 to 300 characters is required.'));
    const before = await this.prisma.v3PlanSetting.findUnique({ where: { key: INDEXING_KEY } });
    await this.prisma.$transaction(async (tx) => {
      await tx.v3PlanSetting.upsert({ where: { key: INDEXING_KEY }, create: { key: INDEXING_KEY, valueJson: mode, description: 'Seeded sites: OFF = noindex, QUALITY = indexable only when the quality check passes' }, update: { valueJson: mode } });
      await this.audits.record(tx, actor, 'seeded.indexing_mode.set', 'plan_setting', INDEXING_KEY, { mode: before?.valueJson ?? 'OFF' }, { mode, reason });
    });
    this.b3.invalidate();
    return { mode };
  }
}
