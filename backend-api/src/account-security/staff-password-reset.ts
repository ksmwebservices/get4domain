import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { isPlaceholderOwnerEmail } from '../provisioning/claims/claims.service';
import { PasswordService } from './password.service';

export class StaffResetDto { @IsString() @MinLength(3) @MaxLength(400) reason!: string }
export interface StaffResetAnswer { requested: true; sentTo: string; note: string }

/** `ravi.kumar@gmail.com` -> `r***@gmail.com`: staff see where it went, never the whole address. */
export const maskEmail = (e: string): string => { const [u, d] = e.split('@'); return `${(u ?? '').slice(0, 1)}***@${d ?? ''}`; };

/**
 * Staff help a vendor who cannot sign in (Website Manager lane A). Staff NEVER set, see or choose a password: this only asks for the normal reset link to be e-mailed to the owner's own
 * address. The link is made and sent by the same service as "forgot password" (one use, short life, older links voided, hourly cap per account) and is never returned to staff.
 * The activity interceptor records the call against the vendor with the staff member as actor; the written reason is part of the request.
 */
@Injectable()
export class StaffPasswordResetService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: Pick<PasswordService, 'requestReset'>) {}

  async send(vendorId: string, ip?: string): Promise<StaffResetAnswer> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: String(vendorId).slice(0, 64) }, select: { email: true } });
    if (!vendor) throw new NotFoundException({ code: 'UNKNOWN_VENDOR', message: 'That business does not exist.' });
    if (!vendor.email || isPlaceholderOwnerEmail(vendor.email)) throw new ConflictException({ code: 'OWNER_EMAIL_MISSING', message: 'This business has no owner e-mail address yet. Send the claim link instead.' });
    this.passwords.requestReset(vendor.email, ip);
    return { requested: true, sentTo: maskEmail(vendor.email), note: 'The owner gets a reset link by e-mail. It works once and expires soon. You never see the link or a password.' };
  }
}
