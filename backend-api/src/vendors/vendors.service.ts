import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Vendor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AuthService } from '../auth/auth.service';
import { WalletService } from '../wallet/wallet.service';
import { AiService } from '../ai/ai.service';
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

  async create(dto: CreateVendorDto): Promise<Vendor> {
    const existing = await this.prisma.vendor.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A vendor with this email already exists');
    }

    const hashedPassword = await AuthService.hashPassword(dto.password);

    const vendor = await this.prisma.vendor.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        businessName: dto.businessName,
        phone: dto.phone,
        industry: dto.industry,
        subdomain: dto.subdomain,
        customDomain: dto.customDomain,
      },
    });

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

    // Auto-seed the live site with an AI-generated hero banner (fire-and-forget so it
    // never slows or blocks account creation). It self-contains every failure and simply
    // does nothing when image gen / Supabase Storage isn't configured — the site then
    // falls back to the curated per-industry sample image as before.
    void this.seedSiteHero(vendor);

    return vendor;
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
    return this.prisma.vendor.update({ where: { id }, data: dto });
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
