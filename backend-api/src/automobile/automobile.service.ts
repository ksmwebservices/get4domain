import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceJob, JobLine, PartStock } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateJobDto, UpdateJobDto,
  CreateLineDto, UpdateLineDto,
  CreatePartDto, UpdatePartDto,
} from './dto/automobile.dto';

export interface AutomobileSummary {
  activeJobs: number;
  inService: number;
  ready: number;
  estimatedRevenue: number;
  lowStockParts: number;
  byStatus: { status: string; count: number }[];
}

const ACTIVE = ['received', 'in_service', 'ready'];

@Injectable()
export class AutomobileService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Jobs ──
  listJobs(vendorId: string): Promise<ServiceJob[]> {
    return this.prisma.serviceJob.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { lines: { orderBy: { createdAt: 'asc' } } },
    });
  }
  getJob(vendorId: string, id: string): Promise<ServiceJob> {
    return this.ownJob(vendorId, id, true);
  }
  createJob(vendorId: string, dto: CreateJobDto): Promise<ServiceJob> {
    const { promisedDate, ...rest } = dto;
    return this.prisma.serviceJob.create({
      data: { vendorId, ...rest, promisedDate: promisedDate ? new Date(promisedDate) : undefined },
      include: { lines: true },
    });
  }
  async updateJob(vendorId: string, id: string, dto: UpdateJobDto): Promise<ServiceJob> {
    await this.ownJob(vendorId, id);
    const { promisedDate, ...rest } = dto;
    return this.prisma.serviceJob.update({
      where: { id },
      data: { ...rest, ...(promisedDate !== undefined ? { promisedDate: promisedDate ? new Date(promisedDate) : null } : {}) },
      include: { lines: { orderBy: { createdAt: 'asc' } } },
    });
  }
  async deleteJob(vendorId: string, id: string): Promise<ServiceJob> {
    await this.ownJob(vendorId, id);
    return this.prisma.serviceJob.delete({ where: { id } });
  }

  // ── Job lines (parts / labor) ──
  async addLine(vendorId: string, jobId: string, dto: CreateLineDto): Promise<JobLine> {
    await this.ownJob(vendorId, jobId);
    return this.prisma.jobLine.create({ data: { vendorId, jobId, ...dto } });
  }
  async updateLine(vendorId: string, id: string, dto: UpdateLineDto): Promise<JobLine> {
    await this.ownLine(vendorId, id);
    return this.prisma.jobLine.update({ where: { id }, data: dto });
  }
  async deleteLine(vendorId: string, id: string): Promise<JobLine> {
    await this.ownLine(vendorId, id);
    return this.prisma.jobLine.delete({ where: { id } });
  }

  // ── Parts inventory ──
  listParts(vendorId: string): Promise<PartStock[]> {
    return this.prisma.partStock.findMany({ where: { vendorId }, orderBy: { name: 'asc' } });
  }
  createPart(vendorId: string, dto: CreatePartDto): Promise<PartStock> {
    return this.prisma.partStock.create({ data: { vendorId, ...dto } });
  }
  async updatePart(vendorId: string, id: string, dto: UpdatePartDto): Promise<PartStock> {
    await this.ownPart(vendorId, id);
    return this.prisma.partStock.update({ where: { id }, data: dto });
  }
  async deletePart(vendorId: string, id: string): Promise<PartStock> {
    await this.ownPart(vendorId, id);
    return this.prisma.partStock.delete({ where: { id } });
  }

  /** Accounts depth: active jobs, in-service/ready counts, estimated revenue, low-stock, by status. */
  async summary(vendorId: string): Promise<AutomobileSummary> {
    const [jobs, parts] = await Promise.all([
      this.prisma.serviceJob.findMany({ where: { vendorId }, select: { status: true, estimateAmount: true } }),
      this.prisma.partStock.findMany({ where: { vendorId }, select: { quantity: true, reorderLevel: true } }),
    ]);
    const active = jobs.filter((j) => ACTIVE.includes(j.status));
    const byStatusMap = new Map<string, number>();
    for (const j of active) byStatusMap.set(j.status, (byStatusMap.get(j.status) ?? 0) + 1);
    return {
      activeJobs: active.length,
      inService: byStatusMap.get('in_service') ?? 0,
      ready: byStatusMap.get('ready') ?? 0,
      estimatedRevenue: active.reduce((s, j) => s + j.estimateAmount, 0),
      lowStockParts: parts.filter((p) => p.quantity <= p.reorderLevel).length,
      byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
    };
  }

  // ── Guards ──
  private async ownJob(vendorId: string, id: string, withLines = false): Promise<ServiceJob> {
    const row = await this.prisma.serviceJob.findFirst({
      where: { id, vendorId },
      ...(withLines ? { include: { lines: { orderBy: { createdAt: 'asc' } } } } : {}),
    });
    if (!row) throw new NotFoundException('Job not found');
    return row;
  }
  private async ownLine(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.jobLine.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Line not found');
  }
  private async ownPart(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.partStock.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Part not found');
  }
}
