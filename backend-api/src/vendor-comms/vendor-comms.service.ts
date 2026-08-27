import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { VendorCommsSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateVendorCommsDto, AdminUpdateVendorCommsDto } from './dto/update-vendor-comms.dto';

/**
 * Effective communication identity for one vendor, after layering the vendor's
 * own settings over the platform defaults. Providers stay dumb: the caller
 * (Communication Hub / WhatsApp bot) resolves this and passes concrete values
 * down, so the shared Fast2SMS / Resend services never grow tenant logic.
 */
export interface CommsBranding {
  /** Display name for outgoing email — the address itself stays the platform's verified domain. */
  emailFromName: string;
  /** Where a customer's reply should land (the vendor's own inbox) — null = platform default. */
  emailReplyTo: string | null;
  /** Business name woven into SMS bodies (the DLT sender-ID itself is shared and unchangeable). */
  smsBusinessName: string;
  /** The vendor's own Fast2SMS routing id, or null to use the platform number. */
  waPhoneNumberId: string | null;
  /** The vendor's own approved WhatsApp template id, or null to use the platform template. */
  waTemplateId: string | null;
  /** Whether the vendor has switched their WhatsApp channel on. */
  waEnabled: boolean;
  waGreeting: string | null;
}

export interface VendorCommsView extends VendorCommsSettings {
  /** Lives on Vendor (unique routing key) — surfaced here so the UI has one payload. */
  waPhoneNumberId: string | null;
  /** Fallback shown as placeholder text when the vendor has set no branding overrides. */
  businessName: string;
}

/** Fields the VENDOR may set on themselves. `waPhoneNumberId` is handled separately
 *  (it lives on Vendor and is a unique routing key, so it needs a claim check). */
const VENDOR_EDITABLE = [
  'waEnabled',
  'waDisplayNumber',
  'waTemplateId',
  'waGreeting',
  'smsBusinessName',
  'emailFromName',
  'emailReplyTo',
] as const;

const WA_STATUSES = ['unverified', 'pending', 'verified'] as const;
type WaStatus = (typeof WA_STATUSES)[number];

@Injectable()
export class VendorCommsService {
  private readonly logger = new Logger(VendorCommsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The vendor's row, created on first read so the UI always has something to bind to. */
  async get(vendorId: string): Promise<VendorCommsView> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, businessName: true, waPhoneNumberId: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const settings =
      (await this.prisma.vendorCommsSettings.findUnique({ where: { vendorId } })) ??
      (await this.prisma.vendorCommsSettings.create({ data: { vendorId } }));

    return { ...settings, waPhoneNumberId: vendor.waPhoneNumberId, businessName: vendor.businessName };
  }

  /**
   * Vendor self-service save. Branding fields apply immediately; a change to the
   * WhatsApp routing id goes through the claim check and drops the channel back
   * to `pending` so admin re-confirms the number before outbound sending trusts it.
   */
  async updateSelf(vendorId: string, dto: UpdateVendorCommsDto): Promise<VendorCommsView> {
    if (dto.waPhoneNumberId !== undefined) {
      await this.claimWhatsappNumber(vendorId, dto.waPhoneNumberId);
    }
    return this.writeSettings(vendorId, dto, { resetVerification: dto.waPhoneNumberId !== undefined });
  }

  /**
   * Admin override — the admin-assist half of the pattern (mirrors
   * AdminDomainsController). Same service and same validation as self-service,
   * but admin may additionally set `waStatus`, which is the whole point of the
   * verification step: only an admin can mark a number as genuinely owned.
   */
  async updateAsAdmin(vendorId: string, dto: AdminUpdateVendorCommsDto): Promise<VendorCommsView> {
    if (dto.waStatus !== undefined && !WA_STATUSES.includes(dto.waStatus as WaStatus)) {
      throw new BadRequestException(`waStatus must be one of: ${WA_STATUSES.join(', ')}`);
    }
    if (dto.waPhoneNumberId !== undefined) {
      await this.claimWhatsappNumber(vendorId, dto.waPhoneNumberId, true);
    }
    return this.writeSettings(vendorId, dto, { resetVerification: false });
  }

  /**
   * Claim (or release) a Fast2SMS `phone_number_id` for a vendor.
   *
   * This id is the ONLY thing an inbound webhook matches on
   * (WhatsappBotService.resolveVendor), so whoever holds it receives that
   * number's conversations. `null`/'' releases the vendor's own id.
   *
   * Policy: a vendor may claim any id nobody else holds, but the claim only
   * reaches `pending` — outbound sending keeps using the platform number until
   * an admin marks it `verified`. An id already held by ANOTHER vendor is
   * refused for a vendor, but an admin may force-reassign it in one step (the
   * churn case: a number reprovisioned to a new vendor).
   */
  private async claimWhatsappNumber(vendorId: string, raw: string | null | undefined, isAdmin = false): Promise<void> {
    const value = (raw ?? '').trim() || null;

    if (value === null) {
      await this.prisma.vendor.update({ where: { id: vendorId }, data: { waPhoneNumberId: null } });
      return;
    }
    if (!/^\d{6,20}$/.test(value)) {
      throw new BadRequestException('WhatsApp phone_number_id must be 6-20 digits');
    }

    const holder = await this.prisma.vendor.findUnique({
      where: { waPhoneNumberId: value },
      select: { id: true, businessName: true },
    });

    if (holder && holder.id !== vendorId) {
      if (!isAdmin) {
        throw new ConflictException('That WhatsApp number is already linked to another account. Contact support.');
      }
      // Admin force-reassign — the churn case, where a number is reprovisioned to
      // a different vendor. Release and claim go in ONE transaction because
      // waPhoneNumberId is unique: the release must land first, and if the claim
      // then failed outside a transaction we'd have silently unlinked the old
      // holder for nothing.
      await this.prisma.$transaction([
        this.prisma.vendor.update({ where: { id: holder.id }, data: { waPhoneNumberId: null } }),
        // The old holder's `verified` flag now refers to a number they no longer
        // hold, so clear it — otherwise their outbound would keep claiming a
        // verified identity it lost. updateMany: they may have no settings row.
        this.prisma.vendorCommsSettings.updateMany({
          where: { vendorId: holder.id },
          data: { waStatus: 'unverified', waVerifiedAt: null },
        }),
        this.prisma.vendor.update({ where: { id: vendorId }, data: { waPhoneNumberId: value } }),
      ]);
      this.logger.warn(
        `WhatsApp number ${value} force-reassigned by admin from vendor ${holder.id} (${holder.businessName}) to vendor ${vendorId}`,
      );
      return;
    }

    await this.prisma.vendor.update({ where: { id: vendorId }, data: { waPhoneNumberId: value } });
    this.logger.log(`WhatsApp number ${value} claimed by vendor ${vendorId}${isAdmin ? ' (by admin)' : ''}`);
  }

  /** Upsert the whitelisted settings columns. Undefined keys are left untouched. */
  private async writeSettings(
    vendorId: string,
    dto: AdminUpdateVendorCommsDto,
    opts: { resetVerification: boolean },
  ): Promise<VendorCommsView> {
    const data: Record<string, unknown> = {};
    for (const field of VENDOR_EDITABLE) {
      const value = dto[field];
      if (value !== undefined) data[field] = value;
    }

    if (dto.waStatus !== undefined) {
      // Admin-only column.
      data.waStatus = dto.waStatus;
      data.waVerifiedAt = dto.waStatus === 'verified' ? new Date() : null;
    } else if (opts.resetVerification) {
      // A vendor who changes their own number must be re-verified by admin.
      data.waStatus = 'pending';
      data.waVerifiedAt = null;
    }

    await this.prisma.vendorCommsSettings.upsert({
      where: { vendorId },
      create: { vendorId, ...data },
      update: data,
    });
    return this.get(vendorId);
  }

  /**
   * Resolve the effective branding used at send time. Never throws and never
   * returns an empty display name — an unconfigured vendor falls back to their
   * business name, then to the platform name, so nothing is ever sent unbranded.
   */
  async resolveBranding(vendorId: string): Promise<CommsBranding> {
    const [vendor, settings] = await Promise.all([
      this.prisma.vendor
        .findUnique({ where: { id: vendorId }, select: { businessName: true, email: true, waPhoneNumberId: true } })
        .catch(() => null),
      this.prisma.vendorCommsSettings.findUnique({ where: { vendorId } }).catch(() => null),
    ]);
    const businessName = vendor?.businessName?.trim() || 'Get4Domain';

    return {
      emailFromName: settings?.emailFromName?.trim() || businessName,
      emailReplyTo: settings?.emailReplyTo?.trim() || vendor?.email || null,
      smsBusinessName: settings?.smsBusinessName?.trim() || businessName,
      // Only a VERIFIED number is used for outbound — an unverified claim must not
      // let a vendor send from a number they may not actually own.
      waPhoneNumberId: settings?.waStatus === 'verified' ? (vendor?.waPhoneNumberId ?? null) : null,
      waTemplateId: settings?.waTemplateId?.trim() || null,
      waEnabled: settings?.waEnabled ?? true,
      waGreeting: settings?.waGreeting?.trim() || null,
    };
  }
}
