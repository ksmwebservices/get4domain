import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallLog, CampaignLead, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCrmLeadDto } from './dto/create-crm-lead.dto';
import { UpdateCrmLeadDto } from './dto/update-crm-lead.dto';
import { LogCallDto } from './dto/log-call.dto';

export interface LeadFilters {
  status?: string;
  source?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  findLeads(vendorId: string, filters: LeadFilters): Promise<CampaignLead[]> {
    const where: Prisma.CampaignLeadWhereInput = { vendorId };
    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    return this.prisma.campaignLead.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  createLead(vendorId: string, dto: CreateCrmLeadDto): Promise<CampaignLead> {
    return this.prisma.campaignLead.create({
      data: {
        vendorId,
        name: dto.name,
        phone: dto.phone,
        message: dto.message,
        source: dto.source ?? 'manual',
      },
    });
  }

  async findOne(id: string, vendorId: string): Promise<CampaignLead & { callLogs: CallLog[] }> {
    const lead = await this.prisma.campaignLead.findUnique({ where: { id }, include: { callLogs: { orderBy: { createdAt: 'desc' } } } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.vendorId !== vendorId) throw new ForbiddenException('You do not own this lead');
    return lead;
  }

  async update(id: string, vendorId: string, dto: UpdateCrmLeadDto): Promise<CampaignLead> {
    await this.findOne(id, vendorId);
    return this.prisma.campaignLead.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes,
        assignedTo: dto.assignedTo,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
      },
    });
  }

  async logCall(id: string, vendorId: string, calledBy: string, dto: LogCallDto): Promise<CallLog> {
    await this.findOne(id, vendorId);

    const callLog = await this.prisma.callLog.create({
      data: {
        leadId: id,
        vendorId,
        calledBy,
        duration: dto.duration,
        outcome: dto.outcome,
        notes: dto.notes,
        aiSummary: dto.aiSummary,
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
      },
    });

    await this.prisma.campaignLead.update({
      where: { id },
      data: {
        followUpDate: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
        status: dto.outcome === 'won' ? 'won' : dto.outcome === 'not_interested' ? 'lost' : 'contacted',
      },
    });

    return callLog;
  }

  async telecrmQueue(vendorId: string): Promise<CampaignLead[]> {
    const now = new Date();
    const leads = await this.prisma.campaignLead.findMany({
      where: {
        vendorId,
        status: { notIn: ['won', 'lost'] },
        OR: [{ status: 'new' }, { followUpDate: { lte: now } }],
      },
    });

    return leads.sort((a, b) => {
      if (a.status === 'new' && b.status !== 'new') return -1;
      if (b.status === 'new' && a.status !== 'new') return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  telecrmFollowups(vendorId: string): Promise<CampaignLead[]> {
    return this.prisma.campaignLead.findMany({
      where: { vendorId, followUpDate: { gt: new Date() }, status: { notIn: ['won', 'lost'] } },
      orderBy: { followUpDate: 'asc' },
    });
  }
}
