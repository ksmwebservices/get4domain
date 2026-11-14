import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The one place the claim flow writes to a vendor's login (Amendment 13 B7): after a claim, the owner sets a password (and, for a business made on its behalf, the login email). It lives in its own module so the
 * provisioning and directory code keep their rule of never writing to Vendor (decision D1). Every method names the vendor; the email lookup is case-insensitive.
 */
export abstract class ClaimAccountStore {
  abstract vendorIdByEmail(email: string): Promise<string | null>;
  /** Sets the password hash and stamps passwordChangedAt (older sessions stop working); a null email keeps the one on file. */
  abstract setCredentials(vendorId: string, d: { passwordHash: string; email: string | null; at: Date }): Promise<void>;
}

@Injectable()
export class PrismaClaimAccountStore extends ClaimAccountStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async vendorIdByEmail(email: string): Promise<string | null> {
    return (await this.prisma.vendor.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }))?.id ?? null;
  }
  async setCredentials(vendorId: string, d: { passwordHash: string; email: string | null; at: Date }): Promise<void> {
    await this.prisma.vendor.update({ where: { id: vendorId }, data: { password: d.passwordHash, passwordChangedAt: d.at, ...(d.email ? { email: d.email } : {}) } });
  }
}
