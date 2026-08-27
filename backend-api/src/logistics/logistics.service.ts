import { Injectable, NotFoundException } from '@nestjs/common';
import { Shipment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/logistics.dto';

export interface LogisticsSummary {
  activeShipments: number;
  inTransit: number;
  deliveredThisMonth: number;
  freightRevenue: number;   // active (non-cancelled) freight value
  byStatus: { status: string; count: number }[];
}

const ACTIVE = ['booked', 'picked_up', 'in_transit'];

@Injectable()
export class LogisticsService {
  constructor(private readonly prisma: PrismaService) {}

  listShipments(vendorId: string): Promise<Shipment[]> {
    return this.prisma.shipment.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }

  createShipment(vendorId: string, dto: CreateShipmentDto): Promise<Shipment> {
    const { pickupDate, eta, ...rest } = dto;
    return this.prisma.shipment.create({
      data: { vendorId, ...rest, pickupDate: pickupDate ? new Date(pickupDate) : undefined, eta: eta ? new Date(eta) : undefined },
    });
  }

  async updateShipment(vendorId: string, id: string, dto: UpdateShipmentDto): Promise<Shipment> {
    await this.own(vendorId, id);
    const { pickupDate, eta, ...rest } = dto;
    // Stamp deliveredAt when status flips to delivered; clear otherwise.
    const deliveredAt = dto.status === 'delivered' ? new Date() : dto.status ? null : undefined;
    return this.prisma.shipment.update({
      where: { id },
      data: {
        ...rest,
        ...(pickupDate !== undefined ? { pickupDate: pickupDate ? new Date(pickupDate) : null } : {}),
        ...(eta !== undefined ? { eta: eta ? new Date(eta) : null } : {}),
        ...(deliveredAt !== undefined ? { deliveredAt } : {}),
      },
    });
  }

  async deleteShipment(vendorId: string, id: string): Promise<Shipment> {
    await this.own(vendorId, id);
    return this.prisma.shipment.delete({ where: { id } });
  }

  /** Accounts depth: active shipments, in-transit, delivered this month, freight revenue, by status. */
  async summary(vendorId: string): Promise<LogisticsSummary> {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [shipments, deliveredThisMonth] = await Promise.all([
      this.prisma.shipment.findMany({ where: { vendorId }, select: { status: true, freightAmount: true } }),
      this.prisma.shipment.count({ where: { vendorId, status: 'delivered', deliveredAt: { gte: monthStart } } }),
    ]);
    const active = shipments.filter((s) => ACTIVE.includes(s.status));
    const byStatusMap = new Map<string, number>();
    for (const s of active) byStatusMap.set(s.status, (byStatusMap.get(s.status) ?? 0) + 1);
    return {
      activeShipments: active.length,
      inTransit: byStatusMap.get('in_transit') ?? 0,
      deliveredThisMonth,
      freightRevenue: active.reduce((s, x) => s + x.freightAmount, 0),
      byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
    };
  }

  private async own(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.shipment.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Shipment not found');
  }
}
