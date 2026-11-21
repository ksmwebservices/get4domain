import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Vendor } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WalletService } from '../wallet/wallet.service';
import { AiService } from '../ai/ai.service';
import { DuplicatePath, phoneKeyOf } from '../v3-duplicates/core/duplicate-core';
import { DuplicateCheckService } from '../v3-duplicates/duplicate-check.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

// Default free wallet credit (paise) if the Trial tier amount isn't set in Pricing Manager.
const TRIAL_CREDIT_FALLBACK_PAISE = 10000; // ₹100

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly wallet: WalletService,
    private readonly ai: AiService,
    private readonly duplicates: DuplicateCheckService,
  ) {}

  findAll(): Promise<Vendor[]> {
    // Exclude Book-Demo sandbox vendors — they are throwaway demo accounts, not
    // real clients, and must never appear in admin vendor management.
    return this.prisma.vendor.findMany({ where: { isSandbox: false }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }
    return vendor;
  }

  /**
   * `opts.selfService` = the caller is a visitor registering (POST /auth/register), not staff. The e-mail refusal below is unchanged; the duplicate check (D1) then runs for every caller:
   * a strong match refuses, a medium match asks "Is this your business?" (self-service) or needs a staff override with a reason, and an answered-"different" business is created HELD for admin review.
   */
  async create(dto: CreateVendorDto, opts: { path?: DuplicatePath; actor?: { id: string; role: string } | null; selfService?: boolean } = {}): Promise<Vendor> {
    const existing = await this.prisma.vendor.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A vendor with this email already exists');
    }

    const selfService = opts.selfService === true;
    const decision = await this.duplicates.enforce(
      { email: dto.email, phone: dto.phone, gstin: dto.gstin, businessName: dto.businessName, city: dto.city, area: dto.area, pincode: dto.pincode, category: dto.industry, ownerName: dto.name, subdomain: dto.subdomain, customDomain: dto.customDomain },
      { path: opts.path ?? (selfService ? 'REGISTER' : 'ADMIN_VENDOR'), actor: opts.actor ?? null, overrideReason: dto.duplicateOverrideReason, confirmDistinct: dto.confirmDistinct, selfService },
    );

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // the vendor and, for a possible duplicate, the review row that holds its site go in ONE transaction: it can never exist unheld with its review lost
    const vendor = await this.prisma.$transaction(async (tx) => {
      const v = await tx.vendor.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          businessName: dto.businessName,
          phone: dto.phone,
          phoneKey: phoneKeyOf(dto.phone),
          industry: dto.industry,
          subdomain: dto.subdomain,
          customDomain: dto.customDomain,
        },
      });
      const review = this.duplicates.reviewData(decision, v.id);
      if (review) await tx.v3DuplicateReview.create({ data: review });
      return v;
    });
    await this.duplicates.record(decision, vendor.id);

    // Grant the Trial-plan free wallet credit (admin-editable in Pricing Manager).
    try {
      const creditPaise = await this.wallet.getRate('trial_free_credit', TRIAL_CREDIT_FALLBACK_PAISE);
      await this.wallet.grantCredit(vendor.id, creditPaise, 'Trial plan welcome credit', 'trial_credit');
    } catch (error) {
      this.logger.error(`Failed to grant trial credit to ${vendor.email}`, error instanceof Error ? error.stack : undefined);
    }

    try {
      await this.emailService.sendWelcomeEmail(vendor, dto.password);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${vendor.email}`, error instanceof Error ? error.stack : undefined);
    }

    // The website manager keeps every draft edit on this row, and the build ignores the draft when the row is missing (applyToSource), so every edit a new vendor made was silently dropped.
    // Created here, before the hero seed (which upserts the same row), with the schema defaults (siteStatus LIVE, the same as no row for the legacy site route). Never blocks creation.
    await this.ensureSiteContentRow(vendor);

    // Auto-seed the live site with an AI-generated hero banner (fire-and-forget so it
    // never slows or blocks account creation). It self-contains every failure and simply
    // does nothing when image gen / Supabase Storage isn't configured — the site then
    // falls back to the curated per-industry sample image as before.
    void this.seedSiteHero(vendor);

    return vendor;
  }

  /** Makes the vendor's site-content row (VendorCMS) if it does not exist yet. Failure is logged and never blocks the vendor's creation. */
  private async ensureSiteContentRow(vendor: Vendor): Promise<void> {
    try {
      await this.prisma.vendorCMS.upsert({ where: { vendorId: vendor.id }, create: { vendorId: vendor.id, businessName: vendor.businessName }, update: {} });
    } catch (error) {
      this.logger.warn(`Site content row not created for ${vendor.email}: ${error instanceof Error ? error.message : 'error'}`);
    }
  }

  /**
   * Best-effort: generate a durable hero banner for the new vendor's live site and store
   * it on their CMS. Runs detached from the create request; any error is swallowed here so
   * an image/storage failure can never affect vendor creation.
   */
  private async seedSiteHero(vendor: Vendor): Promise<void> {
    try {
      const hero = await this.ai.generateSiteHero(vendor.id, {
        businessName: vendor.businessName,
        industry: vendor.industry ?? 'business',
      });
      if (hero.status !== 'ok' || !hero.url) {
        if (hero.status === 'failed') {
          this.logger.warn(`Site hero not seeded for ${vendor.email}: ${hero.error ?? 'failed'}`);
        }
        return; // not_configured → silently skip (feature simply off until creds are set)
      }
      await this.prisma.vendorCMS.upsert({
        where: { vendorId: vendor.id },
        create: { vendorId: vendor.id, businessName: vendor.businessName, banner: hero.url },
        update: { banner: hero.url },
      });
      this.logger.log(`Seeded AI site hero for ${vendor.email}`);
    } catch (error) {
      this.logger.warn(`Site hero seed failed for ${vendor.email}: ${error instanceof Error ? error.message : 'error'}`);
    }
  }

  async update(id: string, dto: UpdateVendorDto): Promise<Vendor> {
    await this.findOne(id);
    return this.prisma.vendor.update({ where: { id }, data: 'phone' in dto ? { ...dto, phoneKey: phoneKeyOf(dto.phone) } : dto });
  }

  async remove(id: string): Promise<Vendor> {
    await this.findOne(id);
    try {
      return await this.prisma.vendor.delete({ where: { id } });
    } catch {
      throw new ConflictException(
        'Cannot delete vendor with existing subscriptions, invoices, tickets or CMS records — suspend instead',
      );
    }
  }

  async suspend(id: string): Promise<Vendor> {
    await this.findOne(id);
    return this.prisma.vendor.update({ where: { id }, data: { status: 'SUSPENDED' } });
  }

  async activate(id: string): Promise<Vendor> {
    await this.findOne(id);
    return this.prisma.vendor.update({ where: { id }, data: { status: 'ACTIVE' } });
  }
}
