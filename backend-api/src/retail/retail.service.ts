import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PosSale, RetailProduct } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto, UpdateProductDto, RestockDto, CreateSaleDto,
} from './dto/retail.dto';

export interface RetailSummary {
  todaySales: number;
  todayRevenue: number;
  totalProducts: number;
  lowStockProducts: number;
  stockValue: number;
}

interface SaleLine { productId: string; name: string; qty: number; price: number }

@Injectable()
export class RetailService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Products / stock ──
  listProducts(vendorId: string): Promise<RetailProduct[]> {
    return this.prisma.retailProduct.findMany({ where: { vendorId }, orderBy: { name: 'asc' } });
  }
  createProduct(vendorId: string, dto: CreateProductDto): Promise<RetailProduct> {
    return this.prisma.retailProduct.create({ data: { vendorId, ...dto } });
  }
  async updateProduct(vendorId: string, id: string, dto: UpdateProductDto): Promise<RetailProduct> {
    await this.ownProduct(vendorId, id);
    return this.prisma.retailProduct.update({ where: { id }, data: dto });
  }
  async deleteProduct(vendorId: string, id: string): Promise<RetailProduct> {
    await this.ownProduct(vendorId, id);
    return this.prisma.retailProduct.delete({ where: { id } });
  }
  async restock(vendorId: string, id: string, dto: RestockDto): Promise<RetailProduct> {
    await this.ownProduct(vendorId, id);
    return this.prisma.retailProduct.update({ where: { id }, data: { stockQty: { increment: dto.delta } } });
  }

  // ── Sales (reuse PosSale as the receipt) — real stock decrement on checkout ──
  listSales(vendorId: string): Promise<PosSale[]> {
    return this.prisma.posSale.findMany({ where: { vendorId, type: 'retail' }, orderBy: { createdAt: 'desc' } });
  }

  /** Checkout: validate stock, decrement each product and write the receipt atomically. */
  async createSale(vendorId: string, dto: CreateSaleDto): Promise<PosSale> {
    if (!dto.lines?.length) throw new BadRequestException('Cart is empty');
    const ids = dto.lines.map((l) => l.productId);
    const products = await this.prisma.retailProduct.findMany({ where: { vendorId, id: { in: ids } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines: SaleLine[] = [];
    for (const l of dto.lines) {
      const p = byId.get(l.productId);
      if (!p) throw new BadRequestException(`Product not found: ${l.productId}`);
      const qty = l.qty ?? 1;
      if (p.stockQty < qty) throw new BadRequestException(`Insufficient stock for ${p.name} (have ${p.stockQty}, need ${qty})`);
      lines.push({ productId: p.id, name: p.name, qty, price: p.price });
    }
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const taxAmount = dto.taxAmount ?? 0;
    const total = subtotal + taxAmount;

    // Atomic: decrement every product, then write the sale.
    const ops = lines.map((l) =>
      this.prisma.retailProduct.update({ where: { id: l.productId }, data: { stockQty: { decrement: l.qty } } }),
    );
    const saleOp = this.prisma.posSale.create({
      data: {
        vendorId, type: 'retail',
        items: lines as unknown as object,
        subtotal, taxAmount, total,
        paymentMethod: dto.paymentMethod ?? 'cash',
        status: 'completed',
      },
    });
    const results = await this.prisma.$transaction([...ops, saleOp]);
    return results[results.length - 1] as PosSale;
  }

  /** Refund: restore stock for each line and flag the receipt refunded. */
  async refundSale(vendorId: string, id: string): Promise<PosSale> {
    const sale = await this.prisma.posSale.findFirst({ where: { id, vendorId, type: 'retail' } });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status === 'refunded') throw new BadRequestException('Already refunded');
    const lines = (sale.items as unknown as SaleLine[]) ?? [];
    const ops = lines
      .filter((l) => l.productId)
      .map((l) => this.prisma.retailProduct.updateMany({ where: { id: l.productId, vendorId }, data: { stockQty: { increment: l.qty } } }));
    const flag = this.prisma.posSale.update({ where: { id }, data: { status: 'refunded' } });
    const results = await this.prisma.$transaction([...ops, flag]);
    return results[results.length - 1] as PosSale;
  }

  /** Accounts depth: today's sales/revenue, product count, low-stock, stock value. */
  async summary(vendorId: string): Promise<RetailSummary> {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const [sales, products] = await Promise.all([
      this.prisma.posSale.findMany({ where: { vendorId, type: 'retail', status: 'completed', createdAt: { gte: dayStart } }, select: { total: true } }),
      this.prisma.retailProduct.findMany({ where: { vendorId }, select: { stockQty: true, reorderLevel: true, price: true } }),
    ]);
    return {
      todaySales: sales.length,
      todayRevenue: sales.reduce((s, x) => s + x.total, 0),
      totalProducts: products.length,
      lowStockProducts: products.filter((p) => p.stockQty <= p.reorderLevel).length,
      stockValue: products.reduce((s, p) => s + p.stockQty * p.price, 0),
    };
  }

  private async ownProduct(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.retailProduct.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Product not found');
  }
}
