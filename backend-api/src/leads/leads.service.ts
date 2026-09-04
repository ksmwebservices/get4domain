import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { VerifyDemoLeadDto } from './dto/verify-demo-lead.dto';
import { DemoVisitResult } from './dto/demo-visit.dto';
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

  private static readonly DEMO_VISIT_CAP = 3;

  /**
   * Record a demo view against the visitor's existing OTP-gate lead (by phone) and
   * decide whether to show the demo. Additive tracking on the SAME lead — not a new
   * system. Rules (dispatch 28-Aug-2026):
   *  - First view locks the lead to that MAIN category.
   *  - Sub-categories within the locked category are free; switching to a DIFFERENT
   *    main category is blocked (→ warm sales page).
   *  - Distinct (category | category/sub) views are capped at 3; the 4th → sales page.
   *  - Re-viewing an already-seen demo never counts again and is always allowed.
   */
  async recordDemoVisit(phone: string, category: string, sub?: string): Promise<DemoVisitResult> {
    const digits = phone.replace(/\D/g, '');
    const last10 = digits.slice(-10);
    const key = sub ? `${category}/${sub}` : category;

    const lead = last10
      ? await this.prisma.lead.findFirst({
          where: { phone: { endsWith: last10 }, source: 'demo' },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    // No gated lead yet (shouldn't happen — the OTP gate creates it first). Allow the
    // view rather than blocking a prospect on a tracking miss; nothing to record.
    if (!lead) return { allowed: true, reason: 'ungated', lockedCategory: null, count: 0 };

    const locked = lead.demoCategory ?? null;
    const seen = (lead.demoVisitKeys ?? '').split(',').map((k) => k.trim()).filter(Boolean);

    // Different main category than the one they're scoped to → block (warm lead).
    if (locked && locked !== category) {
      return { allowed: false, reason: 'category_locked', lockedCategory: locked, count: lead.demoVisitCount };
    }

    // Re-view of a demo already seen → always allowed, no new count.
    if (seen.includes(key)) {
      return { allowed: true, reason: 'ok', lockedCategory: locked ?? category, count: lead.demoVisitCount };
    }

    // A new distinct view. If they've already used their 3, this 4th → sales page.
    if (seen.length >= LeadsService.DEMO_VISIT_CAP) {
      return { allowed: false, reason: 'cap_reached', lockedCategory: locked ?? category, count: lead.demoVisitCount };
    }

    const nextKeys = [...seen, key];
    const updated = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        demoCategory: locked ?? category,
        demoVisitKeys: nextKeys.join(','),
        demoVisitCount: nextKeys.length,
      },
    });
    return { allowed: true, reason: 'ok', lockedCategory: updated.demoCategory, count: updated.demoVisitCount };
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
