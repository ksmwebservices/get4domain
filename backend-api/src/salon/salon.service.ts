import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Stylist, SalonChair, SalonAppointment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStylistDto, UpdateStylistDto, CreateChairDto, UpdateChairDto,
  CreateSalonAppointmentDto, UpdateSalonAppointmentDto,
} from './dto/salon.dto';

export interface SalonSummary {
  todayCount: number;
  upcomingCount: number;
  completedRevenue: number;
  byStylist: { stylistId: string | null; name: string; count: number; revenue: number }[];
}

@Injectable()
export class SalonService {
  constructor(private readonly prisma: PrismaService) {}

  // Stylists
  listStylists(vendorId: string): Promise<Stylist[]> {
    return this.prisma.stylist.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }
  createStylist(vendorId: string, dto: CreateStylistDto): Promise<Stylist> {
    return this.prisma.stylist.create({ data: { vendorId, ...dto } });
  }
  async updateStylist(vendorId: string, id: string, dto: UpdateStylistDto): Promise<Stylist> {
    await this.own('stylist', vendorId, id);
    return this.prisma.stylist.update({ where: { id }, data: dto });
  }
  async deleteStylist(vendorId: string, id: string): Promise<Stylist> {
    await this.own('stylist', vendorId, id);
    return this.prisma.stylist.delete({ where: { id } });
  }

  // Chairs
  listChairs(vendorId: string): Promise<SalonChair[]> {
    return this.prisma.salonChair.findMany({ where: { vendorId }, orderBy: { createdAt: 'asc' } });
  }
  createChair(vendorId: string, dto: CreateChairDto): Promise<SalonChair> {
    return this.prisma.salonChair.create({ data: { vendorId, ...dto } });
  }
  async updateChair(vendorId: string, id: string, dto: UpdateChairDto): Promise<SalonChair> {
    await this.own('salonChair', vendorId, id);
    return this.prisma.salonChair.update({ where: { id }, data: dto });
  }
  async deleteChair(vendorId: string, id: string): Promise<SalonChair> {
    await this.own('salonChair', vendorId, id);
    return this.prisma.salonChair.delete({ where: { id } });
  }

  // Appointments
  listAppointments(vendorId: string): Promise<SalonAppointment[]> {
    return this.prisma.salonAppointment.findMany({
      where: { vendorId },
      orderBy: { startAt: 'desc' },
      include: { stylist: { select: { id: true, name: true } }, chair: { select: { id: true, name: true } } },
    });
  }
  async createAppointment(vendorId: string, dto: CreateSalonAppointmentDto): Promise<SalonAppointment> {
    await this.assertRefs(vendorId, dto.stylistId, dto.chairId);
    const { startAt, ...rest } = dto;
    return this.prisma.salonAppointment.create({ data: { vendorId, ...rest, startAt: new Date(startAt) } });
  }
  async updateAppointment(vendorId: string, id: string, dto: UpdateSalonAppointmentDto): Promise<SalonAppointment> {
    await this.own('salonAppointment', vendorId, id);
    await this.assertRefs(vendorId, dto.stylistId, dto.chairId);
    const { startAt, ...rest } = dto;
    return this.prisma.salonAppointment.update({
      where: { id },
      data: { ...rest, ...(startAt !== undefined ? { startAt: new Date(startAt) } : {}) },
    });
  }
  async deleteAppointment(vendorId: string, id: string): Promise<SalonAppointment> {
    await this.own('salonAppointment', vendorId, id);
    return this.prisma.salonAppointment.delete({ where: { id } });
  }

  /** Accounts depth: today/upcoming counts, completed revenue, revenue by stylist. */
  async summary(vendorId: string): Promise<SalonSummary> {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endToday = new Date(startToday.getTime() + 86400000);
    const [todayCount, upcomingCount, completed, stylists] = await Promise.all([
      this.prisma.salonAppointment.count({ where: { vendorId, startAt: { gte: startToday, lt: endToday } } }),
      this.prisma.salonAppointment.count({ where: { vendorId, startAt: { gte: now }, status: { in: ['scheduled', 'confirmed'] } } }),
      this.prisma.salonAppointment.findMany({ where: { vendorId, status: 'completed' }, select: { stylistId: true, price: true, stylist: { select: { name: true } } } }),
      this.prisma.stylist.findMany({ where: { vendorId }, select: { id: true, name: true } }),
    ]);
    const completedRevenue = completed.reduce((s, a) => s + a.price, 0);
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const a of completed) {
      const key = a.stylistId ?? 'unassigned';
      const name = a.stylist?.name ?? 'Unassigned';
      const cur = map.get(key) ?? { name, count: 0, revenue: 0 };
      cur.count += 1; cur.revenue += a.price;
      map.set(key, cur);
    }
    const byStylist = [...map.entries()].map(([stylistId, v]) => ({ stylistId: stylistId === 'unassigned' ? null : stylistId, ...v }));
    return { todayCount, upcomingCount, completedRevenue, byStylist };
  }

  // Guards
  private async own(model: 'stylist' | 'salonChair' | 'salonAppointment', vendorId: string, id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (this.prisma[model] as any).findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Not found');
  }
  private async assertRefs(vendorId: string, stylistId?: string | null, chairId?: string | null): Promise<void> {
    if (stylistId) {
      const s = await this.prisma.stylist.findFirst({ where: { id: stylistId, vendorId }, select: { id: true } });
      if (!s) throw new BadRequestException('Stylist not found');
    }
    if (chairId) {
      const c = await this.prisma.salonChair.findFirst({ where: { id: chairId, vendorId }, select: { id: true } });
      if (!c) throw new BadRequestException('Chair not found');
    }
  }
}
