import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { VerifyDemoLeadDto } from './dto/verify-demo-lead.dto';
import { OtpService } from '../otp/otp.service';
import { DemoService } from '../demo/demo.service';
import { AuthService } from '../auth/auth.service';
import { CustomerService } from '../customer/customer.service';

export interface SandboxSession {
  vendorId: string;
  token: string;
  expiresAt: Date | null;
  industry: string;
  /** Opaque customer-portal session token for a seeded contact (Phase 4 tour). */
  customerToken?: string | null;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly demo: DemoService,
    private readonly auth: AuthService,
    private readonly customer: CustomerService,
  ) {}

  /**
   * Book-Demo Phase 1: verify the mobile OTP, then create or update a "demo"
   * lead as VERIFIED. This is the retention safety net — admin can follow up with
   * anyone who verifies but doesn't finish the funnel (TeleCRM works g4d_leads).
   */
  async verifyDemoLead(dto: VerifyDemoLeadDto): Promise<{ lead: Lead; sandbox: SandboxSession | null }> {
    if (!this.otp.verify(dto.phone, dto.code)) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    const digits = dto.phone.replace(/\D/g, '');
    const existing = await this.prisma.lead.findFirst({
      where: { phone: { endsWith: digits.slice(-10) }, source: 'demo' },
      orderBy: { createdAt: 'desc' },
    });
    const lead = existing
      ? await this.prisma.lead.update({
          where: { id: existing.id },
          data: { name: dto.name, industry: dto.industry, status: 'verified' },
        })
      : await this.prisma.lead.create({
          data: {
            name: dto.name,
            phone: dto.phone,
            business: dto.name,
            industry: dto.industry,
            interest: 'Book a Demo',
            source: 'demo',
            status: 'verified',
          },
        });

    // Provision a per-lead sandbox for the interactive tour (Phase 4). Best-effort:
    // a failure here must not fail the verified lead (the retention safety net).
    let sandbox: SandboxSession | null = null;
    try {
      const vendor = await this.demo.provisionSandbox(dto.industry, dto.name, dto.phone);
      const customerSession = await this.customer.createSandboxSession(vendor.id);
      sandbox = {
        vendorId: vendor.id,
        token: this.auth.mintSandboxToken(vendor.id, vendor.email),
        expiresAt: vendor.expiresAt,
        industry: dto.industry,
        customerToken: customerSession?.token ?? null,
      };
    } catch (err) {
      this.logger.error(`Sandbox provisioning failed for ${dto.name}: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    return { lead, sandbox };
  }

  create(dto: CreateLeadDto): Promise<Lead> {
    const { preferredDate, ...rest } = dto;
    return this.prisma.lead.create({
      data: {
        ...rest,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
      },
    });
  }

  findAll(): Promise<Lead[]> {
    return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updateStatus(id: string, status: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return this.prisma.lead.update({ where: { id }, data: { status } });
  }
}
