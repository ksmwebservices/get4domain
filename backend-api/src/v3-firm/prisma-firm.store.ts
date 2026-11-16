import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FIRM_DEFAULTS, FirmProfile } from './core/firm-core';
import { FirmStore } from './firm.store';

export const FIRM_ROW_ID = 'platform';
type Row = { legalName: string; registeredAddress: string; gstin: string | null; pan: string | null; registeredEmail: string | null; registeredPhone: string | null };
const toProfile = (r: Row): FirmProfile => ({ legalName: r.legalName, registeredAddress: r.registeredAddress, gstin: r.gstin, pan: r.pan, registeredEmail: r.registeredEmail, registeredPhone: r.registeredPhone });

/** Platform data: one row, no vendor id. */
@Injectable()
export class PrismaFirmStore extends FirmStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async get(): Promise<FirmProfile | null> {
    const r = await this.prisma.v3FirmProfile.findUnique({ where: { id: FIRM_ROW_ID } });
    return r ? toProfile(r) : null;
  }
  async update(patch: Partial<FirmProfile>, staffId: string | null): Promise<FirmProfile> {
    const r = await this.prisma.v3FirmProfile.upsert({
      where: { id: FIRM_ROW_ID }, update: { ...patch, updatedByStaffId: staffId },
      create: { id: FIRM_ROW_ID, ...FIRM_DEFAULTS, ...patch, updatedByStaffId: staffId },
    });
    return toProfile(r);
  }
}
