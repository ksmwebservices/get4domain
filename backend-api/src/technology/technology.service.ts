import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TechProject, ProjectTask } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProjectDto, UpdateProjectDto,
  CreateTaskDto, UpdateTaskDto,
} from './dto/technology.dto';

export interface TechnologySummary {
  activeProjects: number;
  contractValue: number;
  openTasks: number;
  doneTasks: number;
  byStatus: { status: string; count: number; value: number }[];
}

const ACTIVE = ['proposal', 'in_progress', 'testing'];

@Injectable()
export class TechnologyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Projects ──
  listProjects(vendorId: string): Promise<TechProject[]> {
    return this.prisma.techProject.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { tasks: true } } },
    });
  }
  createProject(vendorId: string, dto: CreateProjectDto): Promise<TechProject> {
    const { deadline, ...rest } = dto;
    return this.prisma.techProject.create({ data: { vendorId, ...rest, deadline: deadline ? new Date(deadline) : undefined } });
  }
  async updateProject(vendorId: string, id: string, dto: UpdateProjectDto): Promise<TechProject> {
    await this.ownProject(vendorId, id);
    const { deadline, ...rest } = dto;
    return this.prisma.techProject.update({
      where: { id },
      data: { ...rest, ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}) },
    });
  }
  async deleteProject(vendorId: string, id: string): Promise<TechProject> {
    await this.ownProject(vendorId, id);
    return this.prisma.techProject.delete({ where: { id } });
  }

  // ── Tasks ──
  listTasks(vendorId: string): Promise<ProjectTask[]> {
    return this.prisma.projectTask.findMany({
      where: { vendorId },
      orderBy: [{ createdAt: 'desc' }],
      include: { project: { select: { id: true, name: true } } },
    });
  }
  async createTask(vendorId: string, dto: CreateTaskDto): Promise<ProjectTask> {
    await this.assertProject(vendorId, dto.projectId);
    const { dueDate, ...rest } = dto;
    return this.prisma.projectTask.create({ data: { vendorId, ...rest, dueDate: dueDate ? new Date(dueDate) : undefined } });
  }
  async updateTask(vendorId: string, id: string, dto: UpdateTaskDto): Promise<ProjectTask> {
    await this.ownTask(vendorId, id);
    await this.assertProject(vendorId, dto.projectId);
    const { dueDate, ...rest } = dto;
    return this.prisma.projectTask.update({
      where: { id },
      data: { ...rest, ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}) },
    });
  }
  async deleteTask(vendorId: string, id: string): Promise<ProjectTask> {
    await this.ownTask(vendorId, id);
    return this.prisma.projectTask.delete({ where: { id } });
  }

  /** Accounts depth: active projects, contract value, open/done tasks, by status. */
  async summary(vendorId: string): Promise<TechnologySummary> {
    const [projects, openTasks, doneTasks] = await Promise.all([
      this.prisma.techProject.findMany({ where: { vendorId }, select: { status: true, contractValue: true } }),
      this.prisma.projectTask.count({ where: { vendorId, status: { not: 'done' } } }),
      this.prisma.projectTask.count({ where: { vendorId, status: 'done' } }),
    ]);
    const active = projects.filter((p) => ACTIVE.includes(p.status));
    const contractValue = active.reduce((s, p) => s + p.contractValue, 0);
    const map = new Map<string, { count: number; value: number }>();
    for (const p of active) {
      const cur = map.get(p.status) ?? { count: 0, value: 0 };
      cur.count += 1; cur.value += p.contractValue;
      map.set(p.status, cur);
    }
    const byStatus = [...map.entries()].map(([status, v]) => ({ status, ...v }));
    return { activeProjects: active.length, contractValue, openTasks, doneTasks, byStatus };
  }

  // ── Guards ──
  private async ownProject(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.techProject.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Project not found');
  }
  private async ownTask(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.projectTask.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Task not found');
  }
  private async assertProject(vendorId: string, projectId?: string | null): Promise<void> {
    if (!projectId) return;
    const p = await this.prisma.techProject.findFirst({ where: { id: projectId, vendorId }, select: { id: true } });
    if (!p) throw new BadRequestException('Project not found');
  }
}
