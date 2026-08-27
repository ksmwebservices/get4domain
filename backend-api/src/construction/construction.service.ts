import { Injectable, NotFoundException } from '@nestjs/common';
import { ConstructionProject, ProjectMilestone, ProjectMaterial } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProjectDto, UpdateProjectDto,
  CreateMilestoneDto, UpdateMilestoneDto,
  CreateMaterialDto, UpdateMaterialDto,
} from './dto/construction.dto';

export interface ConstructionSummary {
  activeProjects: number;
  contractValue: number;
  spent: number;
  openMilestones: number;
  byPhase: { phase: string; count: number; value: number }[];
}

const ACTIVE = ['planning', 'in_progress', 'on_hold'];

@Injectable()
export class ConstructionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Projects ──
  listProjects(vendorId: string): Promise<ConstructionProject[]> {
    return this.prisma.constructionProject.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { milestones: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    });
  }
  getProject(vendorId: string, id: string): Promise<ConstructionProject> {
    return this.ownProject(vendorId, id, true);
  }
  createProject(vendorId: string, dto: CreateProjectDto): Promise<ConstructionProject> {
    const { startDate, targetDate, ...rest } = dto;
    return this.prisma.constructionProject.create({
      data: { vendorId, ...rest, startDate: startDate ? new Date(startDate) : undefined, targetDate: targetDate ? new Date(targetDate) : undefined },
      include: { milestones: true },
    });
  }
  async updateProject(vendorId: string, id: string, dto: UpdateProjectDto): Promise<ConstructionProject> {
    await this.ownProject(vendorId, id);
    const { startDate, targetDate, ...rest } = dto;
    return this.prisma.constructionProject.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(targetDate !== undefined ? { targetDate: targetDate ? new Date(targetDate) : null } : {}),
      },
      include: { milestones: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    });
  }
  async deleteProject(vendorId: string, id: string): Promise<ConstructionProject> {
    await this.ownProject(vendorId, id);
    return this.prisma.constructionProject.delete({ where: { id } });
  }

  // ── Milestones ──
  async addMilestone(vendorId: string, projectId: string, dto: CreateMilestoneDto): Promise<ProjectMilestone> {
    await this.ownProject(vendorId, projectId);
    const { dueDate, ...rest } = dto;
    return this.prisma.projectMilestone.create({
      data: { vendorId, projectId, ...rest, dueDate: dueDate ? new Date(dueDate) : undefined },
    });
  }
  async updateMilestone(vendorId: string, id: string, dto: UpdateMilestoneDto): Promise<ProjectMilestone> {
    await this.ownMilestone(vendorId, id);
    const { dueDate, ...rest } = dto;
    const completedAt = dto.status === 'done' ? new Date() : dto.status ? null : undefined;
    return this.prisma.projectMilestone.update({
      where: { id },
      data: {
        ...rest,
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
      },
    });
  }
  async deleteMilestone(vendorId: string, id: string): Promise<ProjectMilestone> {
    await this.ownMilestone(vendorId, id);
    return this.prisma.projectMilestone.delete({ where: { id } });
  }

  // ── Materials ──
  listMaterials(vendorId: string): Promise<ProjectMaterial[]> {
    return this.prisma.projectMaterial.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }
  createMaterial(vendorId: string, dto: CreateMaterialDto): Promise<ProjectMaterial> {
    return this.prisma.projectMaterial.create({ data: { vendorId, ...dto } });
  }
  async updateMaterial(vendorId: string, id: string, dto: UpdateMaterialDto): Promise<ProjectMaterial> {
    await this.ownMaterial(vendorId, id);
    return this.prisma.projectMaterial.update({ where: { id }, data: dto });
  }
  async deleteMaterial(vendorId: string, id: string): Promise<ProjectMaterial> {
    await this.ownMaterial(vendorId, id);
    return this.prisma.projectMaterial.delete({ where: { id } });
  }

  /** Accounts depth: active projects, contract value vs spent, open milestones, by phase. */
  async summary(vendorId: string): Promise<ConstructionSummary> {
    const [projects, openMilestones] = await Promise.all([
      this.prisma.constructionProject.findMany({ where: { vendorId }, select: { status: true, phase: true, budget: true, spent: true } }),
      this.prisma.projectMilestone.count({ where: { vendorId, status: { in: ['pending', 'in_progress'] } } }),
    ]);
    const active = projects.filter((p) => ACTIVE.includes(p.status));
    const contractValue = active.reduce((s, p) => s + p.budget, 0);
    const spent = active.reduce((s, p) => s + p.spent, 0);
    const map = new Map<string, { count: number; value: number }>();
    for (const p of active) {
      const cur = map.get(p.phase) ?? { count: 0, value: 0 };
      cur.count += 1; cur.value += p.budget;
      map.set(p.phase, cur);
    }
    const byPhase = [...map.entries()].map(([phase, v]) => ({ phase, ...v }));
    return { activeProjects: active.length, contractValue, spent, openMilestones, byPhase };
  }

  // ── Guards ──
  private async ownProject(vendorId: string, id: string, withMilestones = false): Promise<ConstructionProject> {
    const row = await this.prisma.constructionProject.findFirst({
      where: { id, vendorId },
      ...(withMilestones ? { include: { milestones: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } } } : {}),
    });
    if (!row) throw new NotFoundException('Project not found');
    return row;
  }
  private async ownMilestone(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.projectMilestone.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Milestone not found');
  }
  private async ownMaterial(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.projectMaterial.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Material not found');
  }
}
