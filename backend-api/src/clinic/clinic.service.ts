import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Doctor, ClinicAppointment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDoctorDto, UpdateDoctorDto,
  CreateAppointmentDto, UpdateAppointmentDto,
} from './dto/clinic.dto';

export interface ClinicSummary {
  todayAppointments: number;
  upcoming: number;              // scheduled/confirmed in the future
  completedThisMonth: number;
  revenueThisMonth: number;      // completed-visit fees this month
  byDoctor: { doctorId: string | null; name: string; count: number; revenue: number }[];
}

@Injectable()
export class ClinicService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Doctors ──
  listDoctors(vendorId: string): Promise<Doctor[]> {
    return this.prisma.doctor.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }
  createDoctor(vendorId: string, dto: CreateDoctorDto): Promise<Doctor> {
    return this.prisma.doctor.create({ data: { vendorId, ...dto } });
  }
  async updateDoctor(vendorId: string, id: string, dto: UpdateDoctorDto): Promise<Doctor> {
    await this.ownDoctor(vendorId, id);
    return this.prisma.doctor.update({ where: { id }, data: dto });
  }
  async deleteDoctor(vendorId: string, id: string): Promise<Doctor> {
    await this.ownDoctor(vendorId, id);
    return this.prisma.doctor.delete({ where: { id } });
  }

  // ── Appointments ──
  listAppointments(vendorId: string): Promise<ClinicAppointment[]> {
    return this.prisma.clinicAppointment.findMany({
      where: { vendorId },
      orderBy: { startAt: 'desc' },
      include: { doctor: { select: { id: true, name: true, specialty: true } } },
    });
  }
  async createAppointment(vendorId: string, dto: CreateAppointmentDto): Promise<ClinicAppointment> {
    await this.assertDoctor(vendorId, dto.doctorId);
    const { startAt, followUpDate, ...rest } = dto;
    return this.prisma.clinicAppointment.create({
      data: { vendorId, ...rest, startAt: new Date(startAt), followUpDate: followUpDate ? new Date(followUpDate) : undefined },
      include: { doctor: { select: { id: true, name: true, specialty: true } } },
    });
  }
  async updateAppointment(vendorId: string, id: string, dto: UpdateAppointmentDto): Promise<ClinicAppointment> {
    await this.ownAppointment(vendorId, id);
    await this.assertDoctor(vendorId, dto.doctorId);
    const { startAt, followUpDate, ...rest } = dto;
    return this.prisma.clinicAppointment.update({
      where: { id },
      data: {
        ...rest,
        ...(startAt !== undefined ? { startAt: new Date(startAt) } : {}),
        ...(followUpDate !== undefined ? { followUpDate: followUpDate ? new Date(followUpDate) : null } : {}),
      },
      include: { doctor: { select: { id: true, name: true, specialty: true } } },
    });
  }
  async deleteAppointment(vendorId: string, id: string): Promise<ClinicAppointment> {
    await this.ownAppointment(vendorId, id);
    return this.prisma.clinicAppointment.delete({ where: { id } });
  }

  /** Accounts depth: today's appts, upcoming, completed + revenue this month, by doctor. */
  async summary(vendorId: string): Promise<ClinicSummary> {
    const now = new Date();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [todayAppointments, upcoming, completed] = await Promise.all([
      this.prisma.clinicAppointment.count({ where: { vendorId, startAt: { gte: dayStart, lt: dayEnd } } }),
      this.prisma.clinicAppointment.count({ where: { vendorId, status: { in: ['scheduled', 'confirmed'] }, startAt: { gte: now } } }),
      this.prisma.clinicAppointment.findMany({
        where: { vendorId, status: 'completed', startAt: { gte: monthStart } },
        select: { fee: true, doctorId: true, doctor: { select: { name: true } } },
      }),
    ]);
    const revenueThisMonth = completed.reduce((s, a) => s + a.fee, 0);
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const a of completed) {
      const key = a.doctorId ?? 'unassigned';
      const name = a.doctor?.name ?? 'Unassigned';
      const cur = map.get(key) ?? { name, count: 0, revenue: 0 };
      cur.count += 1; cur.revenue += a.fee;
      map.set(key, cur);
    }
    const byDoctor = [...map.entries()].map(([doctorId, v]) => ({ doctorId: doctorId === 'unassigned' ? null : doctorId, ...v }));
    return { todayAppointments, upcoming, completedThisMonth: completed.length, revenueThisMonth, byDoctor };
  }

  // ── Guards ──
  private async ownDoctor(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.doctor.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Doctor not found');
  }
  private async ownAppointment(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.clinicAppointment.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Appointment not found');
  }
  private async assertDoctor(vendorId: string, doctorId?: string | null): Promise<void> {
    if (!doctorId) return;
    const d = await this.prisma.doctor.findFirst({ where: { id: doctorId, vendorId }, select: { id: true } });
    if (!d) throw new BadRequestException('Doctor not found');
  }
}
