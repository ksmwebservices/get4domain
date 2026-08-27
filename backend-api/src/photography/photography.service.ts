import { Injectable, NotFoundException } from '@nestjs/common';
import { PhotoShoot, ShootDeliverable } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateShootDto, UpdateShootDto,
  CreateDeliverableDto, UpdateDeliverableDto,
} from './dto/photography.dto';

export interface PhotographySummary {
  upcomingShoots: number;
  bookedValue: number;
  advanceCollected: number;
  pendingDeliveries: number;   // deliverables not yet delivered on active shoots
  byType: { type: string; count: number; value: number }[];
}

/** Default deliverable set a studio would produce, per shoot type. */
const DEFAULT_DELIVERABLES: Record<string, string[]> = {
  Wedding: ['Edited photos', 'Highlight video', 'Wedding album', 'Raw backup'],
  'Pre-Wedding': ['Edited photos', 'Teaser reel'],
  Portrait: ['Edited photos', 'Retouched selects'],
  Product: ['Edited photos', 'Web-ready set'],
  Event: ['Edited photos', 'Event highlights'],
  Other: ['Edited photos'],
};

const ACTIVE = ['enquiry', 'confirmed', 'shot'];

@Injectable()
export class PhotographyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Shoots ──
  listShoots(vendorId: string): Promise<PhotoShoot[]> {
    return this.prisma.photoShoot.findMany({
      where: { vendorId },
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'desc' }],
      include: { deliverables: { orderBy: { createdAt: 'asc' } } },
    });
  }
  getShoot(vendorId: string, id: string): Promise<PhotoShoot> {
    return this.ownShoot(vendorId, id, true);
  }
  createShoot(vendorId: string, dto: CreateShootDto): Promise<PhotoShoot> {
    const { eventDate, deliveryDueDate, seedDeliverables, ...rest } = dto;
    const type = rest.eventType ?? 'Wedding';
    const deliverables = seedDeliverables === false ? [] : (DEFAULT_DELIVERABLES[type] ?? []);
    return this.prisma.photoShoot.create({
      data: {
        vendorId, ...rest,
        eventDate: eventDate ? new Date(eventDate) : undefined,
        deliveryDueDate: deliveryDueDate ? new Date(deliveryDueDate) : undefined,
        deliverables: { create: deliverables.map((name) => ({ vendorId, name, status: 'pending' })) },
      },
      include: { deliverables: { orderBy: { createdAt: 'asc' } } },
    });
  }
  async updateShoot(vendorId: string, id: string, dto: UpdateShootDto): Promise<PhotoShoot> {
    await this.ownShoot(vendorId, id);
    const { eventDate, deliveryDueDate, seedDeliverables: _s, ...rest } = dto;
    const deliveredAt = dto.status === 'delivered' ? new Date() : dto.status && dto.status !== 'delivered' ? null : undefined;
    return this.prisma.photoShoot.update({
      where: { id },
      data: {
        ...rest,
        ...(eventDate !== undefined ? { eventDate: eventDate ? new Date(eventDate) : null } : {}),
        ...(deliveryDueDate !== undefined ? { deliveryDueDate: deliveryDueDate ? new Date(deliveryDueDate) : null } : {}),
        ...(deliveredAt !== undefined ? { deliveredAt } : {}),
      },
      include: { deliverables: { orderBy: { createdAt: 'asc' } } },
    });
  }
  async deleteShoot(vendorId: string, id: string): Promise<PhotoShoot> {
    await this.ownShoot(vendorId, id);
    return this.prisma.photoShoot.delete({ where: { id } });
  }

  // ── Deliverables ──
  listDeliverables(vendorId: string): Promise<ShootDeliverable[]> {
    return this.prisma.shootDeliverable.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { shoot: { select: { id: true, title: true, clientName: true, eventType: true, deliveryDueDate: true, galleryUrl: true } } },
    });
  }
  async addDeliverable(vendorId: string, shootId: string, dto: CreateDeliverableDto): Promise<ShootDeliverable> {
    await this.ownShoot(vendorId, shootId);
    const { dueDate, ...rest } = dto;
    return this.prisma.shootDeliverable.create({ data: { vendorId, shootId, ...rest, dueDate: dueDate ? new Date(dueDate) : undefined } });
  }
  async updateDeliverable(vendorId: string, id: string, dto: UpdateDeliverableDto): Promise<ShootDeliverable> {
    await this.ownDeliverable(vendorId, id);
    const { dueDate, ...rest } = dto;
    return this.prisma.shootDeliverable.update({
      where: { id },
      data: { ...rest, ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}) },
    });
  }
  async deleteDeliverable(vendorId: string, id: string): Promise<ShootDeliverable> {
    await this.ownDeliverable(vendorId, id);
    return this.prisma.shootDeliverable.delete({ where: { id } });
  }

  /** Accounts depth: upcoming shoots, booked value vs advance, pending deliveries, by type. */
  async summary(vendorId: string): Promise<PhotographySummary> {
    const [shoots, pendingDeliveries] = await Promise.all([
      this.prisma.photoShoot.findMany({ where: { vendorId }, select: { status: true, eventType: true, packageValue: true, advancePaid: true } }),
      this.prisma.shootDeliverable.count({ where: { vendorId, status: { not: 'delivered' }, shoot: { status: { in: ACTIVE } } } }),
    ]);
    const active = shoots.filter((s) => ACTIVE.includes(s.status));
    const bookedValue = active.reduce((s, x) => s + x.packageValue, 0);
    const advanceCollected = active.reduce((s, x) => s + x.advancePaid, 0);
    const map = new Map<string, { count: number; value: number }>();
    for (const s of active) {
      const cur = map.get(s.eventType) ?? { count: 0, value: 0 };
      cur.count += 1; cur.value += s.packageValue;
      map.set(s.eventType, cur);
    }
    const byType = [...map.entries()].map(([type, v]) => ({ type, ...v }));
    return { upcomingShoots: active.length, bookedValue, advanceCollected, pendingDeliveries, byType };
  }

  // ── Guards ──
  private async ownShoot(vendorId: string, id: string, withDeliverables = false): Promise<PhotoShoot> {
    const row = await this.prisma.photoShoot.findFirst({
      where: { id, vendorId },
      ...(withDeliverables ? { include: { deliverables: { orderBy: { createdAt: 'asc' } } } } : {}),
    });
    if (!row) throw new NotFoundException('Shoot not found');
    return row;
  }
  private async ownDeliverable(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.shootDeliverable.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Deliverable not found');
  }
}
