import { Injectable, NotFoundException } from '@nestjs/common';
import { ProduceOrder, ProduceStock } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrderDto, UpdateOrderDto,
  CreateStockDto, UpdateStockDto,
} from './dto/agriculture.dto';

export interface AgricultureSummary {
  openOrders: number;
  orderValue: number;
  pendingDispatch: number;   // confirmed but not yet dispatched
  stockValue: number;        // available stock at rate
  byStatus: { status: string; count: number }[];
}

const OPEN = ['pending', 'confirmed', 'dispatched'];

@Injectable()
export class AgricultureService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Orders ──
  listOrders(vendorId: string): Promise<ProduceOrder[]> {
    return this.prisma.produceOrder.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }
  createOrder(vendorId: string, dto: CreateOrderDto): Promise<ProduceOrder> {
    const { harvestDate, ...rest } = dto;
    const totalAmount = (rest.quantity ?? 0) * (rest.ratePerUnit ?? 0);
    return this.prisma.produceOrder.create({
      data: { vendorId, ...rest, totalAmount, harvestDate: harvestDate ? new Date(harvestDate) : undefined },
    });
  }
  async updateOrder(vendorId: string, id: string, dto: UpdateOrderDto): Promise<ProduceOrder> {
    const existing = await this.ownOrder(vendorId, id);
    const { harvestDate, ...rest } = dto;
    const quantity = rest.quantity ?? existing.quantity;
    const ratePerUnit = rest.ratePerUnit ?? existing.ratePerUnit;
    // Stamp dispatch/delivery timestamps on status transitions.
    const stamps: Record<string, Date> = {};
    if (dto.status === 'dispatched') stamps.dispatchDate = new Date();
    if (dto.status === 'delivered') stamps.deliveryDate = new Date();
    return this.prisma.produceOrder.update({
      where: { id },
      data: {
        ...rest,
        totalAmount: quantity * ratePerUnit,
        ...stamps,
        ...(harvestDate !== undefined ? { harvestDate: harvestDate ? new Date(harvestDate) : null } : {}),
      },
    });
  }
  async deleteOrder(vendorId: string, id: string): Promise<ProduceOrder> {
    await this.ownOrder(vendorId, id);
    return this.prisma.produceOrder.delete({ where: { id } });
  }

  // ── Stock ──
  listStock(vendorId: string): Promise<ProduceStock[]> {
    return this.prisma.produceStock.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }
  createStock(vendorId: string, dto: CreateStockDto): Promise<ProduceStock> {
    const { harvestDate, ...rest } = dto;
    return this.prisma.produceStock.create({ data: { vendorId, ...rest, harvestDate: harvestDate ? new Date(harvestDate) : undefined } });
  }
  async updateStock(vendorId: string, id: string, dto: UpdateStockDto): Promise<ProduceStock> {
    await this.ownStock(vendorId, id);
    const { harvestDate, ...rest } = dto;
    return this.prisma.produceStock.update({
      where: { id },
      data: { ...rest, ...(harvestDate !== undefined ? { harvestDate: harvestDate ? new Date(harvestDate) : null } : {}) },
    });
  }
  async deleteStock(vendorId: string, id: string): Promise<ProduceStock> {
    await this.ownStock(vendorId, id);
    return this.prisma.produceStock.delete({ where: { id } });
  }

  /** Accounts depth: open orders, order value, pending dispatch, stock value, by status. */
  async summary(vendorId: string): Promise<AgricultureSummary> {
    const [orders, stock] = await Promise.all([
      this.prisma.produceOrder.findMany({ where: { vendorId }, select: { status: true, totalAmount: true } }),
      this.prisma.produceStock.findMany({ where: { vendorId, status: 'available' }, select: { quantityAvailable: true, ratePerUnit: true } }),
    ]);
    const open = orders.filter((o) => OPEN.includes(o.status));
    const byStatusMap = new Map<string, number>();
    for (const o of open) byStatusMap.set(o.status, (byStatusMap.get(o.status) ?? 0) + 1);
    return {
      openOrders: open.length,
      orderValue: open.reduce((s, o) => s + o.totalAmount, 0),
      pendingDispatch: (byStatusMap.get('pending') ?? 0) + (byStatusMap.get('confirmed') ?? 0),
      stockValue: stock.reduce((s, x) => s + x.quantityAvailable * x.ratePerUnit, 0),
      byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
    };
  }

  // ── Guards ──
  private async ownOrder(vendorId: string, id: string): Promise<ProduceOrder> {
    const row = await this.prisma.produceOrder.findFirst({ where: { id, vendorId } });
    if (!row) throw new NotFoundException('Order not found');
    return row;
  }
  private async ownStock(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.produceStock.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Stock not found');
  }
}
