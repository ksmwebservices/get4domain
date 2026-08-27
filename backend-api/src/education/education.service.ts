import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Batch, StudentEnrollment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto, UpdateBatchDto, CreateEnrollmentDto, UpdateEnrollmentDto } from './dto/education.dto';

export interface EducationSummary {
  activeStudents: number;
  feesCollected: number;
  feesPending: number;
  byBatch: { batchId: string | null; name: string; students: number; collected: number; pending: number }[];
}

@Injectable()
export class EducationService {
  constructor(private readonly prisma: PrismaService) {}

  // Batches
  listBatches(vendorId: string): Promise<Batch[]> {
    return this.prisma.batch.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { enrollments: true } } } });
  }
  createBatch(vendorId: string, dto: CreateBatchDto): Promise<Batch> {
    const { startDate, endDate, ...rest } = dto;
    return this.prisma.batch.create({ data: { vendorId, ...rest, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined } });
  }
  async updateBatch(vendorId: string, id: string, dto: UpdateBatchDto): Promise<Batch> {
    await this.ownBatch(vendorId, id);
    const { startDate, endDate, ...rest } = dto;
    return this.prisma.batch.update({
      where: { id },
      data: { ...rest, ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}), ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}) },
    });
  }
  async deleteBatch(vendorId: string, id: string): Promise<Batch> {
    await this.ownBatch(vendorId, id);
    return this.prisma.batch.delete({ where: { id } });
  }

  // Enrollments
  listEnrollments(vendorId: string): Promise<StudentEnrollment[]> {
    return this.prisma.studentEnrollment.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, include: { batch: { select: { id: true, name: true } } } });
  }
  async createEnrollment(vendorId: string, dto: CreateEnrollmentDto): Promise<StudentEnrollment> {
    await this.assertBatch(vendorId, dto.batchId);
    const { enrollDate, ...rest } = dto;
    return this.prisma.studentEnrollment.create({ data: { vendorId, ...rest, ...(enrollDate ? { enrollDate: new Date(enrollDate) } : {}) } });
  }
  async updateEnrollment(vendorId: string, id: string, dto: UpdateEnrollmentDto): Promise<StudentEnrollment> {
    await this.ownEnrollment(vendorId, id);
    await this.assertBatch(vendorId, dto.batchId);
    const { enrollDate, ...rest } = dto;
    return this.prisma.studentEnrollment.update({ where: { id }, data: { ...rest, ...(enrollDate !== undefined ? { enrollDate: new Date(enrollDate) } : {}) } });
  }
  async deleteEnrollment(vendorId: string, id: string): Promise<StudentEnrollment> {
    await this.ownEnrollment(vendorId, id);
    return this.prisma.studentEnrollment.delete({ where: { id } });
  }

  /** Accounts depth: active students, fees collected/pending, per batch. */
  async summary(vendorId: string): Promise<EducationSummary> {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { vendorId },
      select: { status: true, feeAmount: true, feePaid: true, batchId: true, batch: { select: { name: true } } },
    });
    const active = enrollments.filter((e) => e.status === 'enrolled' || e.status === 'ongoing');
    const feesCollected = enrollments.reduce((s, e) => s + e.feePaid, 0);
    const feesPending = enrollments.reduce((s, e) => s + Math.max(0, e.feeAmount - e.feePaid), 0);
    const map = new Map<string, { name: string; students: number; collected: number; pending: number }>();
    for (const e of enrollments) {
      const key = e.batchId ?? 'unassigned';
      const name = e.batch?.name ?? 'Unassigned';
      const cur = map.get(key) ?? { name, students: 0, collected: 0, pending: 0 };
      cur.students += 1; cur.collected += e.feePaid; cur.pending += Math.max(0, e.feeAmount - e.feePaid);
      map.set(key, cur);
    }
    const byBatch = [...map.entries()].map(([batchId, v]) => ({ batchId: batchId === 'unassigned' ? null : batchId, ...v }));
    return { activeStudents: active.length, feesCollected, feesPending, byBatch };
  }

  private async ownBatch(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.batch.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Batch not found');
  }
  private async ownEnrollment(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.studentEnrollment.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Enrollment not found');
  }
  private async assertBatch(vendorId: string, batchId?: string | null): Promise<void> {
    if (!batchId) return;
    const b = await this.prisma.batch.findFirst({ where: { id: batchId, vendorId }, select: { id: true } });
    if (!b) throw new BadRequestException('Batch not found');
  }
}
