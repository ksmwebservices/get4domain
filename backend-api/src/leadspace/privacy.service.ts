import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone, phoneHash } from './leadspace.types';
import { LeadspaceSettingsService } from './settings.service';

export const ERASED_NAME = 'Deleted customer';
export const ERASED_PHONE = '0000000000';

/**
 * DPDP: a customer can withdraw consent and ask for their data to be deleted, and data is not kept for ever. What is removed is personal data (name, number,
 * request text, notes, codes). What stays is what the law and the books need: the money ledger, the price charged, the dates, and a one-way hash of the number so a
 * repeat request cannot be charged twice and a withdrawal can be honoured. The number is also added to the do-not-contact list so no code is sent to it again.
 */
@Injectable()
export class LeadPrivacyService {
  constructor(private readonly prisma: PrismaService, private readonly settings: LeadspaceSettingsService) {}

  /** A customer's deletion request, run by an admin after checking who is asking. */
  async erase(phone: string, by: string): Promise<{ events: number; codes: number; blocked: boolean }> {
    const ten = normalizePhone(phone);
    if (!ten) throw new BadRequestException('Enter the customer\'s 10-digit mobile number.');
    const ph = phoneHash(ten);
    return this.prisma.$transaction(async (tx) => {
      const events = await tx.leadEvent.updateMany({ where: { phoneHash: ph, NOT: { customerName: ERASED_NAME } }, data: { customerName: ERASED_NAME, customerPhone: ERASED_PHONE, payload: {}, vendorNote: null } });
      const codes = await tx.leadOtp.deleteMany({ where: { phoneHash: ph } });
      await tx.leadBlockedPhone.upsert({ where: { phoneHash: ph }, create: { phoneHash: ph, reason: `Asked for deletion (${by})` }, update: {} });
      return { events: events.count, codes: codes.count, blocked: true };
    });
  }

  /** Anonymise leads older than the retention period. Dry run unless `apply`. Held leads are never touched: the vendor has not seen them yet. */
  async retentionSweep(apply: boolean): Promise<{ months: number; events: number; applied: boolean }> {
    const s = await this.settings.get();
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - s.retentionMonths);
    const where = { createdAt: { lt: cutoff }, status: { not: 'HELD' }, NOT: { customerName: ERASED_NAME } };
    if (!apply) return { months: s.retentionMonths, events: await this.prisma.leadEvent.count({ where }), applied: false };
    const r = await this.prisma.leadEvent.updateMany({ where, data: { customerName: ERASED_NAME, customerPhone: ERASED_PHONE, payload: {}, vendorNote: null } });
    await this.prisma.leadOtp.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return { months: s.retentionMonths, events: r.count, applied: true };
  }
}
