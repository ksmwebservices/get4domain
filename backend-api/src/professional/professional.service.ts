import { Injectable, NotFoundException } from '@nestjs/common';
import { Engagement, EngagementDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEngagementDto,
  UpdateEngagementDto,
  CreateDocumentDto,
  UpdateDocumentDto,
} from './dto/professional.dto';

export interface ProfessionalSummary {
  activeEngagements: number;
  engagedValue: number;
  pendingDocs: number;
  byType: { type: string; count: number; value: number }[];
}

/**
 * The heart of "genuine depth" here: each engagement TYPE carries a real
 * document checklist a professional firm would actually collect. Seeded on
 * create, then tracked (pending → received → waived) per engagement.
 */
const DEFAULT_CHECKLISTS: Record<string, string[]> = {
  Consulting: ['Signed proposal', 'Scope of work', 'NDA', 'Kickoff brief'],
  Legal: ['Signed engagement letter', 'KYC / ID proof', 'Conflict check', 'Vakalatnama / authority', 'Case documents'],
  Advisory: ['Engagement letter', 'NDA', 'Latest financial statements', 'Board resolution'],
  Retainer: ['Signed retainer agreement', 'KYC / ID proof', 'SLA document'],
  Other: ['Signed agreement', 'KYC / ID proof'],
};

@Injectable()
export class ProfessionalService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Engagements ──
  listEngagements(vendorId: string): Promise<Engagement[]> {
    return this.prisma.engagement.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
  }

  getEngagement(vendorId: string, id: string): Promise<Engagement> {
    return this.ownEngagement(vendorId, id, true);
  }

  async createEngagement(vendorId: string, dto: CreateEngagementDto): Promise<Engagement> {
    const { startDate, dueDate, seedChecklist, ...rest } = dto;
    const type = rest.engagementType ?? 'Consulting';
    const checklist = seedChecklist === false ? [] : (DEFAULT_CHECKLISTS[type] ?? []);
    return this.prisma.engagement.create({
      data: {
        vendorId,
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        documents: {
          create: checklist.map((name) => ({ vendorId, name, required: true, status: 'pending' })),
        },
      },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async updateEngagement(vendorId: string, id: string, dto: UpdateEngagementDto): Promise<Engagement> {
    await this.ownEngagement(vendorId, id);
    const { startDate, dueDate, seedChecklist: _seed, ...rest } = dto;
    return this.prisma.engagement.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async deleteEngagement(vendorId: string, id: string): Promise<Engagement> {
    await this.ownEngagement(vendorId, id);
    return this.prisma.engagement.delete({ where: { id } });
  }

  // ── Documents (checklist items) ──
  listDocuments(vendorId: string): Promise<EngagementDocument[]> {
    return this.prisma.engagementDocument.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { engagement: { select: { id: true, title: true, clientName: true, engagementType: true } } },
    });
  }

  async addDocument(vendorId: string, engagementId: string, dto: CreateDocumentDto): Promise<EngagementDocument> {
    await this.ownEngagement(vendorId, engagementId);
    return this.prisma.engagementDocument.create({
      data: { vendorId, engagementId, ...dto },
    });
  }

  async updateDocument(vendorId: string, id: string, dto: UpdateDocumentDto): Promise<EngagementDocument> {
    await this.ownDocument(vendorId, id);
    // Stamp receivedAt when flipping to received; clear it otherwise.
    const receivedAt =
      dto.status === 'received' ? new Date() : dto.status && dto.status !== 'received' ? null : undefined;
    return this.prisma.engagementDocument.update({
      where: { id },
      data: { ...dto, ...(receivedAt !== undefined ? { receivedAt } : {}) },
    });
  }

  async deleteDocument(vendorId: string, id: string): Promise<EngagementDocument> {
    await this.ownDocument(vendorId, id);
    return this.prisma.engagementDocument.delete({ where: { id } });
  }

  /** Accounts depth: active engagements, engaged value, outstanding docs, by type. */
  async summary(vendorId: string): Promise<ProfessionalSummary> {
    const [engagements, pendingDocs] = await Promise.all([
      this.prisma.engagement.findMany({
        where: { vendorId },
        select: { status: true, engagementType: true, feeValue: true },
      }),
      this.prisma.engagementDocument.count({ where: { vendorId, status: 'pending', required: true } }),
    ]);
    const active = engagements.filter((e) => e.status === 'active' || e.status === 'proposal' || e.status === 'on_hold');
    const engagedValue = active.reduce((s, e) => s + e.feeValue, 0);
    const map = new Map<string, { count: number; value: number }>();
    for (const e of active) {
      const cur = map.get(e.engagementType) ?? { count: 0, value: 0 };
      cur.count += 1; cur.value += e.feeValue;
      map.set(e.engagementType, cur);
    }
    const byType = [...map.entries()].map(([type, v]) => ({ type, ...v }));
    return { activeEngagements: active.length, engagedValue, pendingDocs, byType };
  }

  // ── Ownership guards ──
  private async ownEngagement(vendorId: string, id: string, withDocs = false): Promise<Engagement> {
    const row = await this.prisma.engagement.findFirst({
      where: { id, vendorId },
      ...(withDocs ? { include: { documents: { orderBy: { createdAt: 'asc' } } } } : {}),
    });
    if (!row) throw new NotFoundException('Engagement not found');
    return row;
  }

  private async ownDocument(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.engagementDocument.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Document not found');
  }
}
