import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, CatalogItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog-item.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { Paginated } from './contacts.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(vendorId: string, dto: CreateCatalogItemDto): Promise<CatalogItem> {
    return this.prisma.catalogItem.create({
      data: {
        vendorId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        unit: dto.unit,
        image: dto.image,
        active: dto.active ?? true,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findAll(vendorId: string, query: ListQueryDto): Promise<Paginated<CatalogItem>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CatalogItemWhereInput = { vendorId };
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    const [items, total] = await Promise.all([
      this.prisma.catalogItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(vendorId: string, id: string): Promise<CatalogItem> {
    const item = await this.prisma.catalogItem.findFirst({ where: { id, vendorId } });
    if (!item) {
      throw new NotFoundException('Catalog item not found');
    }
    return item;
  }

  async update(vendorId: string, id: string, dto: UpdateCatalogItemDto): Promise<CatalogItem> {
    await this.findOne(vendorId, id);
    return this.prisma.catalogItem.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        unit: dto.unit,
        image: dto.image,
        active: dto.active,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async remove(vendorId: string, id: string): Promise<{ id: string }> {
    await this.findOne(vendorId, id);
    await this.prisma.catalogItem.delete({ where: { id } });
    return { id };
  }
}
