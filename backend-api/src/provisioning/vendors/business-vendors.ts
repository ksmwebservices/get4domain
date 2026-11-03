import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** A database uniqueness rule refused the write. `field` says which one when it is known. */
export class UniqueViolation extends Error {
  constructor(readonly field: 'email' | 'subdomain' | 'other') { super(`unique violation on ${field}`); this.name = 'UniqueViolation'; }
}

export interface NewBusinessVendor {
  name: string;
  email: string;
  password: string;          // an unusable random hash: the owner sets a password when they claim the business (slice 5.7)
  businessName: string;
  phone: string;
  industry: string;
  subdomain: string;
  status: 'PENDING';
  source: 'STAFF' | 'SYSTEM';
  registeredByStaffId: string | null;
}

/**
 * What CREATE_VENDOR needs from storage. The vendor row is created through here, NOT through VendorsService.create: that method sends a real welcome email
 * containing a plaintext password and grants wallet credit, which provisioning must never do (docs/v3/V3_S3_PROVISIONING.md decision D-2).
 */
export abstract class BusinessVendors {
  abstract findDuplicate(email: string, phoneKey: string): Promise<{ id: string; matched: 'email' | 'phone' } | null>;
  abstract subdomainTaken(subdomain: string): Promise<boolean>;
  abstract exists(vendorId: string): Promise<boolean>;
  /** Creates the vendor AND links it to the job in one transaction, so a crash can never leave a vendor the job does not know about. */
  abstract createForJob(jobId: string, data: NewBusinessVendor): Promise<{ id: string }>;
}

@Injectable()
export class PrismaBusinessVendors extends BusinessVendors {
  constructor(private readonly prisma: PrismaService) { super(); }

  async findDuplicate(email: string, key: string): Promise<{ id: string; matched: 'email' | 'phone' } | null> {
    const byEmail = await this.prisma.vendor.findUnique({ where: { email }, select: { id: true } });
    if (byEmail) return { id: byEmail.id, matched: 'email' };
    // phones are stored in many spellings: narrow by the last six digits, then compare the last ten after stripping punctuation
    const candidates = await this.prisma.vendor.findMany({ where: { phone: { contains: key.slice(-6) } }, select: { id: true, phone: true }, take: 50 });
    const hit = candidates.find((c) => c.phone && c.phone.replace(/\D/g, '').slice(-10) === key);
    return hit ? { id: hit.id, matched: 'phone' } : null;
  }

  async subdomainTaken(subdomain: string): Promise<boolean> {
    return (await this.prisma.vendor.findUnique({ where: { subdomain }, select: { id: true } })) !== null;
  }

  async exists(vendorId: string): Promise<boolean> {
    return (await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } })) !== null;
  }

  async createForJob(jobId: string, d: NewBusinessVendor): Promise<{ id: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const v = await tx.vendor.create({
          data: {
            name: d.name, email: d.email, password: d.password, businessName: d.businessName, phone: d.phone, industry: d.industry, subdomain: d.subdomain,
            status: d.status, source: d.source, registeredByStaffId: d.registeredByStaffId,
          },
          select: { id: true },
        });
        await tx.v3ProvisioningJob.update({ where: { id: jobId }, data: { vendorId: v.id } });
        return v;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = String((e.meta as { target?: unknown } | undefined)?.target ?? '');
        throw new UniqueViolation(/email/i.test(target) ? 'email' : /subdomain/i.test(target) ? 'subdomain' : 'other');
      }
      throw e;
    }
  }
}
