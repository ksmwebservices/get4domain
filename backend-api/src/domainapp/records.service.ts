import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Record as DomainRecord } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecordDto, UpdateRecordDto } from './dto/record.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { Paginated } from './contacts.service';

const RECORD_INCLUDE = { contact: true, catalogItem: true } as const;

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertContactAndCatalogOwned(
    vendorId: string,
    contactId?: string,
    catalogItemId?: string,
  ): Promise<void> {
    if (contactId) {
      const contact = await this.prisma.contact.findFirst({ where: { id: contactId, vendorId } });
      if (!contact) {
        throw new BadRequestException('contactId does not belong to this vendor');
      }
    }
    if (catalogItemId) {
      const item = await this.prisma.catalogItem.findFirst({ where: { id: catalogItemId, vendorId } });
      if (!item) {
        throw new BadRequestException('catalogItemId does not belong to this vendor');
      }
    }
  }

  async create(vendorId: string, dto: CreateRecordDto): Promise<DomainRecord> {
    await this.assertContactAndCatalogOwned(vendorId, dto.contactId, dto.catalogItemId);
    return this.prisma.record.create({
      data: {
        vendorId,
        contactId: dto.contactId,
        catalogItemId: dto.catalogItemId,
        status: dto.status ?? 'draft',
        date: new Date(dto.date),
        amount: dto.amount ?? 0,
        notes: dto.notes,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
      include: RECORD_INCLUDE,
    });
  }

  async findAll(vendorId: string, query: ListQueryDto): Promise<Paginated<DomainRecord>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.RecordWhereInput = { vendorId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { notes: { contains: query.search, mode: 'insensitive' } },
        { contact: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.record.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: RECORD_INCLUDE,
      }),
      this.prisma.record.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(vendorId: string, id: string): Promise<DomainRecord> {
    const record = await this.prisma.record.findFirst({
      where: { id, vendorId },
      include: { ...RECORD_INCLUDE, invoice: true },
    });
    if (!record) {
      throw new NotFoundException('Record not found');
    }
    return record;
  }

  async update(vendorId: string, id: string, dto: UpdateRecordDto): Promise<DomainRecord> {
    await this.findOne(vendorId, id);
    await this.assertContactAndCatalogOwned(vendorId, dto.contactId, dto.catalogItemId);
    return this.prisma.record.update({
      where: { id },
      data: {
        contactId: dto.contactId,
        catalogItemId: dto.catalogItemId,
        status: dto.status,
        date: dto.date ? new Date(dto.date) : undefined,
        amount: dto.amount,
        notes: dto.notes,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
      include: RECORD_INCLUDE,
    });
  }

  async updateStatus(vendorId: string, id: string, status: string): Promise<DomainRecord> {
    await this.findOne(vendorId, id);
    return this.prisma.record.update({
      where: { id },
      data: { status },
      include: RECORD_INCLUDE,
    });
  }

  async remove(vendorId: string, id: string): Promise<{ id: string }> {
    await this.findOne(vendorId, id);
    await this.prisma.record.delete({ where: { id } });
    return { id };
  }
}
