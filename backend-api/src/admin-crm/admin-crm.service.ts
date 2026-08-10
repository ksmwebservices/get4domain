import { Injectable, NotFoundException } from '@nestjs/common';
import { Lead, LeadCallLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAdminLeadDto } from './dto/update-lead.dto';
import { LogAdminCallDto } from './dto/log-call.dto';

// Shape consumed by the shared TeleCRM board (same as the vendor CRM lead).
interface TeleCrmLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  business: string;
  industry: string;
  interest: string;
  status: string;
  notes: string | null;
  followUpDate: Date | null;
  createdAt: Date;
  callLogs?: LeadCallLog[];
}

@Injectable()
export class AdminCrmService {
  constructor(private readonly prisma: PrismaService) {}

  // g4d_leads default to "pending"; the TeleCRM Kanban's first stage is "new".
  private toCrmLead(lead: Lead & { callLogs?: LeadCallLog[] }): TeleCrmLead {
    return {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      business: lead.business,
      industry: lead.industry,
      interest: lead.interest,
      status: lead.status === 'pending' ? 'new' : lead.status,
      notes: lead.notes,
      followUpDate: lead.followUpDate,
      createdAt: lead.createdAt,
      callLogs: lead.callLogs,
    };
  }

  async findAll(): Promise<TeleCrmLead[]> {
    const leads = await this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
    return leads.map((l) => this.toCrmLead(l));
  }

  async findOne(id: string): Promise<TeleCrmLead> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { callLogs: { orderBy: { createdAt: 'desc' } } },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.toCrmLead(lead);
  }

  async update(id: string, dto: UpdateAdminLeadDto): Promise<TeleCrmLead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        status: dto.status ?? lead.status,
        notes: dto.notes ?? lead.notes,
        assignedTo: dto.assignedTo ?? lead.assignedTo,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : lead.followUpDate,
      },
    });
    return this.toCrmLead(updated);
  }

  async logCall(id: string, calledBy: string, dto: LogAdminCallDto): Promise<LeadCallLog> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const log = await this.prisma.leadCallLog.create({
      data: {
        leadId: id,
        calledBy,
        duration: dto.duration,
        outcome: dto.outcome,
        notes: dto.notes,
        aiSummary: dto.aiSummary,
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
      },
    });

    // Advance a fresh enquiry to "contacted" and record any follow-up date.
    await this.prisma.lead.update({
      where: { id },
      data: {
        status: lead.status === 'pending' || lead.status === 'new' ? 'contacted' : lead.status,
        followUpDate: dto.followUpAt ? new Date(dto.followUpAt) : lead.followUpDate,
      },
    });

    return log;
  }
}
