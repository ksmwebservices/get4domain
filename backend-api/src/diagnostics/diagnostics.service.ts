import { Injectable, NotFoundException } from '@nestjs/common';
import { TestOrder, TestOrderItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrderDto, UpdateOrderDto,
  CreateOrderItemDto, UpdateOrderItemDto,
} from './dto/diagnostics.dto';

export interface DiagnosticsSummary {
  todayBookings: number;
  samplesPending: number;   // booked or sample_collected (awaiting processing)
  processing: number;
  reportsReady: number;
  revenue: number;          // active (non-cancelled) order amount
  byStatus: { status: string; count: number }[];
}

const ACTIVE = ['booked', 'sample_collected', 'processing', 'report_ready'];

@Injectable()
export class DiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Orders ──
  listOrders(vendorId: string): Promise<TestOrder[]> {
    return this.prisma.testOrder.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }
  getOrder(vendorId: string, id: string): Promise<TestOrder> {
    return this.ownOrder(vendorId, id, true);
  }
  createOrder(vendorId: string, dto: CreateOrderDto): Promise<TestOrder> {
    const { testDate, ...rest } = dto;
    return this.prisma.testOrder.create({
      data: { vendorId, ...rest, testDate: testDate ? new Date(testDate) : undefined },
      include: { items: true },
    });
  }
  async updateOrder(vendorId: string, id: string, dto: UpdateOrderDto): Promise<TestOrder> {
    await this.ownOrder(vendorId, id);
    const { testDate, ...rest } = dto;
    // Stamp lifecycle timestamps on status transitions.
    const stamps: Record<string, Date | null> = {};
    if (dto.status === 'sample_collected') stamps.collectedAt = new Date();
    if (dto.status === 'report_ready') stamps.reportReadyAt = new Date();
    return this.prisma.testOrder.update({
      where: { id },
      data: { ...rest, ...stamps, ...(testDate !== undefined ? { testDate: testDate ? new Date(testDate) : null } : {}) },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }
  async deleteOrder(vendorId: string, id: string): Promise<TestOrder> {
    await this.ownOrder(vendorId, id);
    return this.prisma.testOrder.delete({ where: { id } });
  }

  // ── Order items (tests) ──
  async addItem(vendorId: string, orderId: string, dto: CreateOrderItemDto): Promise<TestOrderItem> {
    await this.ownOrder(vendorId, orderId);
    const item = await this.prisma.testOrderItem.create({ data: { vendorId, orderId, ...dto } });
    await this.recalcAmount(orderId);
    return item;
  }
  async updateItem(vendorId: string, id: string, dto: UpdateOrderItemDto): Promise<TestOrderItem> {
    const { orderId } = await this.ownItem(vendorId, id);
    const item = await this.prisma.testOrderItem.update({ where: { id }, data: dto });
    await this.recalcAmount(orderId);
    return item;
  }
  async deleteItem(vendorId: string, id: string): Promise<TestOrderItem> {
    const { orderId } = await this.ownItem(vendorId, id);
    const item = await this.prisma.testOrderItem.delete({ where: { id } });
    await this.recalcAmount(orderId);
    return item;
  }

  /** Order amount = sum of its test-item prices. */
  private async recalcAmount(orderId: string): Promise<void> {
    const agg = await this.prisma.testOrderItem.aggregate({ where: { orderId }, _sum: { price: true } });
    await this.prisma.testOrder.update({ where: { id: orderId }, data: { amount: agg._sum.price ?? 0 } });
  }

  /** Accounts depth: today's bookings, samples pending, processing, reports ready, revenue. */
  async summary(vendorId: string): Promise<DiagnosticsSummary> {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const [orders, todayBookings] = await Promise.all([
      this.prisma.testOrder.findMany({ where: { vendorId }, select: { status: true, amount: true } }),
      this.prisma.testOrder.count({ where: { vendorId, createdAt: { gte: dayStart } } }),
    ]);
    const active = orders.filter((o) => ACTIVE.includes(o.status));
    const byStatusMap = new Map<string, number>();
    for (const o of active) byStatusMap.set(o.status, (byStatusMap.get(o.status) ?? 0) + 1);
    return {
      todayBookings,
      samplesPending: (byStatusMap.get('booked') ?? 0) + (byStatusMap.get('sample_collected') ?? 0),
      processing: byStatusMap.get('processing') ?? 0,
      reportsReady: byStatusMap.get('report_ready') ?? 0,
      revenue: active.reduce((s, o) => s + o.amount, 0),
      byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
    };
  }

  // ── Guards ──
  private async ownOrder(vendorId: string, id: string, withItems = false): Promise<TestOrder> {
    const row = await this.prisma.testOrder.findFirst({
      where: { id, vendorId },
      ...(withItems ? { include: { items: { orderBy: { createdAt: 'asc' } } } } : {}),
    });
    if (!row) throw new NotFoundException('Order not found');
    return row;
  }
  private async ownItem(vendorId: string, id: string): Promise<{ orderId: string }> {
    const row = await this.prisma.testOrderItem.findFirst({ where: { id, vendorId }, select: { orderId: true } });
    if (!row) throw new NotFoundException('Test not found');
    return row;
  }
}
