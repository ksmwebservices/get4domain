import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { VerifyDemoLeadDto } from './dto/verify-demo-lead.dto';
import { OtpService } from '../otp/otp.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
  ) {}

  /**
   * Book-Demo Phase 1: verify the mobile OTP, then create or update a "demo"
   * lead as VERIFIED. This is the retention safety net — admin can follow up with
   * anyone who verifies but doesn't finish the funnel (TeleCRM works g4d_leads).
   */
  async verifyDemoLead(dto: VerifyDemoLeadDto): Promise<Lead> {
    if (!this.otp.verify(dto.phone, dto.code)) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    const digits = dto.phone.replace(/\D/g, '');
    const existing = await this.prisma.lead.findFirst({
      where: { phone: { endsWith: digits.slice(-10) }, source: 'demo' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return this.prisma.lead.update({
        where: { id: existing.id },
        data: { name: dto.name, industry: dto.industry, status: 'verified' },
      });
    }
    return this.prisma.lead.create({
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
