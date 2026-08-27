import { Injectable, NotFoundException } from '@nestjs/common';
import { GymClass, Membership } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGymClassDto, UpdateGymClassDto, CreateMembershipDto, UpdateMembershipDto } from './dto/gym.dto';

export interface GymSummary {
  activeCount: number;
  expiringCount: number;   // active + endDate within 7 days
  expiredCount: number;    // active status but endDate past
  monthlyRevenue: number;  // sum of price for currently-active memberships
  byPlan: { plan: string; count: number; revenue: number }[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class GymService {
  constructor(private readonly prisma: PrismaService) {}

  // Classes
  listClasses(vendorId: string): Promise<GymClass[]> {
    return this.prisma.gymClass.findMany({ where: { vendorId }, orderBy: { createdAt: 'asc' } });
  }
  createClass(vendorId: string, dto: CreateGymClassDto): Promise<GymClass> {
    return this.prisma.gymClass.create({ data: { vendorId, ...dto } });
  }
  async updateClass(vendorId: string, id: string, dto: UpdateGymClassDto): Promise<GymClass> {
    await this.ownClass(vendorId, id);
    return this.prisma.gymClass.update({ where: { id }, data: dto });
  }
  async deleteClass(vendorId: string, id: string): Promise<GymClass> {
    await this.ownClass(vendorId, id);
    return this.prisma.gymClass.delete({ where: { id } });
  }

  // Memberships
  listMemberships(vendorId: string): Promise<Membership[]> {
    return this.prisma.membership.findMany({ where: { vendorId }, orderBy: { endDate: 'asc' } });
  }
  async createMembership(vendorId: string, dto: CreateMembershipDto): Promise<Membership> {
    const { startDate, endDate, ...rest } = dto;
    return this.prisma.membership.create({ data: { vendorId, ...rest, startDate: new Date(startDate), endDate: new Date(endDate) } });
  }
  async updateMembership(vendorId: string, id: string, dto: UpdateMembershipDto): Promise<Membership> {
    await this.ownMembership(vendorId, id);
    const { startDate, endDate, ...rest } = dto;
    return this.prisma.membership.update({
      where: { id },
      data: { ...rest, ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}), ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}) },
    });
  }
  async deleteMembership(vendorId: string, id: string): Promise<Membership> {
    await this.ownMembership(vendorId, id);
    return this.prisma.membership.delete({ where: { id } });
  }

  /** Accounts depth: active/expiring/expired counts + revenue by plan. */
  async summary(vendorId: string): Promise<GymSummary> {
    const now = new Date();
    const active = await this.prisma.membership.findMany({ where: { vendorId, status: 'active' }, select: { endDate: true, price: true, planName: true } });
    let expiringCount = 0, expiredCount = 0, monthlyRevenue = 0;
    const map = new Map<string, { count: number; revenue: number }>();
    for (const m of active) {
      const end = m.endDate.getTime();
      if (end < now.getTime()) expiredCount += 1;
      else if (end - now.getTime() <= WEEK_MS) expiringCount += 1;
      monthlyRevenue += m.price;
      const cur = map.get(m.planName) ?? { count: 0, revenue: 0 };
      cur.count += 1; cur.revenue += m.price;
      map.set(m.planName, cur);
    }
    const byPlan = [...map.entries()].map(([plan, v]) => ({ plan, ...v })).sort((a, b) => b.revenue - a.revenue);
    return { activeCount: active.length, expiringCount, expiredCount, monthlyRevenue, byPlan };
  }

  private async ownClass(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.gymClass.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Class not found');
  }
  private async ownMembership(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.membership.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Membership not found');
  }
}
