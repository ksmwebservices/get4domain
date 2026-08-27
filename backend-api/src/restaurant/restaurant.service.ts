import { Injectable, NotFoundException } from '@nestjs/common';
import { PosTable, RestaurantOrder, RestaurantOrderItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTableDto, UpdateTableDto,
  CreateOrderDto, UpdateOrderDto,
  AddItemDto, UpdateItemDto, BillOrderDto,
} from './dto/restaurant.dto';

export interface RestaurantSummary {
  openOrders: number;
  occupiedTables: number;
  totalTables: number;
  kitchenQueue: number;      // items queued or preparing
  todayRevenue: number;      // billed order totals today
  byStatus: { status: string; count: number }[];
}

const OPEN = ['new', 'preparing', 'ready', 'served'];

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Tables (reuse the existing PosTable model — genuinely fit for purpose) ──
  listTables(vendorId: string): Promise<PosTable[]> {
    return this.prisma.posTable.findMany({ where: { vendorId }, orderBy: { createdAt: 'asc' } });
  }
  createTable(vendorId: string, dto: CreateTableDto): Promise<PosTable> {
    return this.prisma.posTable.create({ data: { vendorId, ...dto } });
  }
  async updateTable(vendorId: string, id: string, dto: UpdateTableDto): Promise<PosTable> {
    await this.ownTable(vendorId, id);
    return this.prisma.posTable.update({ where: { id }, data: dto });
  }
  async deleteTable(vendorId: string, id: string): Promise<PosTable> {
    await this.ownTable(vendorId, id);
    return this.prisma.posTable.delete({ where: { id } });
  }

  // ── Orders ──
  listOrders(vendorId: string): Promise<RestaurantOrder[]> {
    return this.prisma.restaurantOrder.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }
  getOrder(vendorId: string, id: string): Promise<RestaurantOrder> {
    return this.ownOrder(vendorId, id, true);
  }
  async createOrder(vendorId: string, dto: CreateOrderDto): Promise<RestaurantOrder> {
    const { items, taxAmount, ...rest } = dto;
    const lines = items ?? [];
    const subtotal = lines.reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 1), 0);
    const tax = taxAmount ?? 0;
    const order = await this.prisma.restaurantOrder.create({
      data: {
        vendorId, ...rest, taxAmount: tax, subtotal, total: subtotal + tax,
        items: { create: lines.map((i) => ({ vendorId, catalogItemId: i.catalogItemId, name: i.name, station: i.station ?? 'kitchen', quantity: i.quantity ?? 1, price: i.price ?? 0, notes: i.notes })) },
      },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (rest.tableId) await this.setTableState(vendorId, rest.tableId, 'occupied', order.total);
    return order;
  }
  async updateOrder(vendorId: string, id: string, dto: UpdateOrderDto): Promise<RestaurantOrder> {
    const existing = await this.ownOrder(vendorId, id);
    const order = await this.prisma.restaurantOrder.update({
      where: { id }, data: dto,
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (dto.taxAmount !== undefined) await this.recalc(id);
    // Freeing / occupying the table follows the order lifecycle.
    if (dto.status === 'billed' || dto.status === 'cancelled') {
      if (existing.tableId) await this.setTableState(vendorId, existing.tableId, 'available', null);
    }
    return this.ownOrder(vendorId, id, true);
  }
  async deleteOrder(vendorId: string, id: string): Promise<RestaurantOrder> {
    const existing = await this.ownOrder(vendorId, id);
    if (existing.tableId) await this.setTableState(vendorId, existing.tableId, 'available', null);
    return this.prisma.restaurantOrder.delete({ where: { id } });
  }
  async billOrder(vendorId: string, id: string, dto: BillOrderDto): Promise<RestaurantOrder> {
    const existing = await this.ownOrder(vendorId, id);
    await this.prisma.restaurantOrder.update({ where: { id }, data: { status: 'billed', paymentMethod: dto.paymentMethod ?? 'cash' } });
    if (existing.tableId) await this.setTableState(vendorId, existing.tableId, 'available', null);
    return this.ownOrder(vendorId, id, true);
  }

  // ── Order items (menu-linked; drive the kitchen flow) ──
  async addItem(vendorId: string, orderId: string, dto: AddItemDto): Promise<RestaurantOrderItem> {
    await this.ownOrder(vendorId, orderId);
    const item = await this.prisma.restaurantOrderItem.create({
      data: { vendorId, orderId, catalogItemId: dto.catalogItemId, name: dto.name, station: dto.station ?? 'kitchen', quantity: dto.quantity ?? 1, price: dto.price ?? 0, notes: dto.notes },
    });
    await this.recalc(orderId);
    return item;
  }
  async updateItem(vendorId: string, id: string, dto: UpdateItemDto): Promise<RestaurantOrderItem> {
    const { orderId } = await this.ownItem(vendorId, id);
    const item = await this.prisma.restaurantOrderItem.update({ where: { id }, data: dto });
    if (dto.quantity !== undefined) await this.recalc(orderId);
    return item;
  }
  async deleteItem(vendorId: string, id: string): Promise<RestaurantOrderItem> {
    const { orderId } = await this.ownItem(vendorId, id);
    const item = await this.prisma.restaurantOrderItem.delete({ where: { id } });
    await this.recalc(orderId);
    return item;
  }

  /** Kitchen display: unserved items on active orders, with table/order context. */
  listKitchen(vendorId: string): Promise<RestaurantOrderItem[]> {
    return this.prisma.restaurantOrderItem.findMany({
      where: { vendorId, status: { not: 'served' }, order: { status: { in: ['new', 'preparing', 'ready'] } } },
      orderBy: { createdAt: 'asc' },
      include: { order: { select: { id: true, tableName: true, orderType: true } } },
    });
  }

  /** subtotal from item lines; total = subtotal + tax. Also refreshes the table's open total. */
  private async recalc(orderId: string): Promise<void> {
    const order = await this.prisma.restaurantOrder.findUnique({ where: { id: orderId }, select: { vendorId: true, tableId: true, taxAmount: true } });
    if (!order) return;
    const agg = await this.prisma.restaurantOrderItem.aggregate({ where: { orderId }, _sum: { price: true } });
    const items = await this.prisma.restaurantOrderItem.findMany({ where: { orderId }, select: { price: true, quantity: true } });
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + order.taxAmount;
    await this.prisma.restaurantOrder.update({ where: { id: orderId }, data: { subtotal, total } });
    if (order.tableId) await this.setTableState(order.vendorId, order.tableId, 'occupied', total);
    void agg;
  }

  private async setTableState(vendorId: string, tableId: string, status: string, orderTotal: number | null): Promise<void> {
    await this.prisma.posTable.updateMany({ where: { id: tableId, vendorId }, data: { status, orderTotal } });
  }

  /** Accounts depth: open orders, occupied tables, kitchen queue, today's billed revenue. */
  async summary(vendorId: string): Promise<RestaurantSummary> {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const [orders, tables, kitchenQueue, billedToday] = await Promise.all([
      this.prisma.restaurantOrder.findMany({ where: { vendorId }, select: { status: true } }),
      this.prisma.posTable.findMany({ where: { vendorId }, select: { status: true } }),
      this.prisma.restaurantOrderItem.count({ where: { vendorId, status: { in: ['queued', 'preparing'] }, order: { status: { in: ['new', 'preparing', 'ready'] } } } }),
      this.prisma.restaurantOrder.aggregate({ where: { vendorId, status: 'billed', updatedAt: { gte: dayStart } }, _sum: { total: true } }),
    ]);
    const open = orders.filter((o) => OPEN.includes(o.status));
    const byStatusMap = new Map<string, number>();
    for (const o of open) byStatusMap.set(o.status, (byStatusMap.get(o.status) ?? 0) + 1);
    return {
      openOrders: open.length,
      occupiedTables: tables.filter((t) => t.status === 'occupied').length,
      totalTables: tables.length,
      kitchenQueue,
      todayRevenue: billedToday._sum.total ?? 0,
      byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
    };
  }

  // ── Guards ──
  private async ownTable(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.posTable.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Table not found');
  }
  private async ownOrder(vendorId: string, id: string, withItems = false): Promise<RestaurantOrder> {
    const row = await this.prisma.restaurantOrder.findFirst({
      where: { id, vendorId },
      ...(withItems ? { include: { items: { orderBy: { createdAt: 'asc' } } } } : {}),
    });
    if (!row) throw new NotFoundException('Order not found');
    return row;
  }
  private async ownItem(vendorId: string, id: string): Promise<{ orderId: string }> {
    const row = await this.prisma.restaurantOrderItem.findFirst({ where: { id, vendorId }, select: { orderId: true } });
    if (!row) throw new NotFoundException('Item not found');
    return row;
  }
}
