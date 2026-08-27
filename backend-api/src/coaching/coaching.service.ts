import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CoachingBatch, CoachingEnrollment, CoachingSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBatchDto, UpdateBatchDto,
  CreateEnrollmentDto, UpdateEnrollmentDto,
  CreateSessionDto, UpdateSessionDto,
} from './dto/coaching.dto';

export interface CoachingSummary {
  activeStudents: number;
  feesCollected: number;
  feesPending: number;
  sessionsThisWeek: number;
  byBatch: { batchId: string | null; name: string; students: number; collected: number; pending: number }[];
}

@Injectable()
export class CoachingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Batches (with sessions) ──
  listBatches(vendorId: string): Promise<CoachingBatch[]> {
    return this.prisma.coachingBatch.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { enrollments: true } }, sessions: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] } },
    });
  }
  getBatch(vendorId: string, id: string): Promise<CoachingBatch> {
    return this.ownBatch(vendorId, id, true);
  }
  createBatch(vendorId: string, dto: CreateBatchDto): Promise<CoachingBatch> {
    const { startDate, ...rest } = dto;
    return this.prisma.coachingBatch.create({ data: { vendorId, ...rest, startDate: startDate ? new Date(startDate) : undefined } });
  }
  async updateBatch(vendorId: string, id: string, dto: UpdateBatchDto): Promise<CoachingBatch> {
    await this.ownBatch(vendorId, id);
    const { startDate, ...rest } = dto;
    return this.prisma.coachingBatch.update({
      where: { id },
      data: { ...rest, ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}) },
    });
  }
  async deleteBatch(vendorId: string, id: string): Promise<CoachingBatch> {
    await this.ownBatch(vendorId, id);
    return this.prisma.coachingBatch.delete({ where: { id } });
  }

  // ── Sessions (scheduled within a batch) ──
  async addSession(vendorId: string, batchId: string, dto: CreateSessionDto): Promise<CoachingSession> {
    await this.ownBatch(vendorId, batchId);
    const { date, ...rest } = dto;
    return this.prisma.coachingSession.create({ data: { vendorId, batchId, ...rest, date: date ? new Date(date) : undefined } });
  }
  async updateSession(vendorId: string, id: string, dto: UpdateSessionDto): Promise<CoachingSession> {
    await this.ownSession(vendorId, id);
    const { date, ...rest } = dto;
    return this.prisma.coachingSession.update({
      where: { id },
      data: { ...rest, ...(date !== undefined ? { date: date ? new Date(date) : null } : {}) },
    });
  }
  async deleteSession(vendorId: string, id: string): Promise<CoachingSession> {
    await this.ownSession(vendorId, id);
    return this.prisma.coachingSession.delete({ where: { id } });
  }

  // ── Enrollments ──
  listEnrollments(vendorId: string): Promise<CoachingEnrollment[]> {
    return this.prisma.coachingEnrollment.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { batch: { select: { id: true, name: true } } },
    });
  }
  async createEnrollment(vendorId: string, dto: CreateEnrollmentDto): Promise<CoachingEnrollment> {
    await this.assertBatch(vendorId, dto.batchId);
    const { enrollDate, ...rest } = dto;
    return this.prisma.coachingEnrollment.create({ data: { vendorId, ...rest, ...(enrollDate ? { enrollDate: new Date(enrollDate) } : {}) } });
  }
  async updateEnrollment(vendorId: string, id: string, dto: UpdateEnrollmentDto): Promise<CoachingEnrollment> {
    await this.ownEnrollment(vendorId, id);
    await this.assertBatch(vendorId, dto.batchId);
    const { enrollDate, ...rest } = dto;
    return this.prisma.coachingEnrollment.update({ where: { id }, data: { ...rest, ...(enrollDate !== undefined ? { enrollDate: new Date(enrollDate) } : {}) } });
  }
  async deleteEnrollment(vendorId: string, id: string): Promise<CoachingEnrollment> {
    await this.ownEnrollment(vendorId, id);
    return this.prisma.coachingEnrollment.delete({ where: { id } });
  }

  /** Accounts depth: active students, fees collected/pending, sessions this week, per batch. */
  async summary(vendorId: string): Promise<CoachingSummary> {
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    const now = new Date();
    const [enrollments, sessionsThisWeek] = await Promise.all([
      this.prisma.coachingEnrollment.findMany({
        where: { vendorId },
        select: { status: true, feeAmount: true, feePaid: true, batchId: true, batch: { select: { name: true } } },
      }),
      this.prisma.coachingSession.count({ where: { vendorId, status: 'scheduled', date: { gte: now, lte: weekEnd } } }),
    ]);
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
    return { activeStudents: active.length, feesCollected, feesPending, sessionsThisWeek, byBatch };
  }

  // ── Guards ──
  private async ownBatch(vendorId: string, id: string, withSessions = false): Promise<CoachingBatch> {
    const row = await this.prisma.coachingBatch.findFirst({
      where: { id, vendorId },
      ...(withSessions ? { include: { sessions: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }, _count: { select: { enrollments: true } } } } : {}),
    });
    if (!row) throw new NotFoundException('Batch not found');
    return row;
  }
  private async ownSession(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.coachingSession.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Session not found');
  }
  private async ownEnrollment(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.coachingEnrollment.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Enrollment not found');
  }
  private async assertBatch(vendorId: string, batchId?: string | null): Promise<void> {
    if (!batchId) return;
    const b = await this.prisma.coachingBatch.findFirst({ where: { id: batchId, vendorId }, select: { id: true } });
    if (!b) throw new BadRequestException('Batch not found');
  }
}
