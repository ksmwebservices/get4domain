import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Contact } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { ListQueryDto } from './dto/list-query.dto';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(vendorId: string, dto: CreateContactDto): Promise<Contact> {
    return this.prisma.contact.create({
      data: {
        vendorId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        type: dto.type ?? 'customer',
        address: dto.address,
        portalAccess: dto.portalAccess ?? false,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
        tags: dto.tags as Prisma.InputJsonValue | undefined,
        notes: dto.notes,
      },
    });
  }

  async findAll(vendorId: string, query: ListQueryDto): Promise<Paginated<Contact>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ContactWhereInput = { vendorId };
    if (query.type) {
      where.type = query.type;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(vendorId: string, id: string): Promise<Contact> {
    const contact = await this.prisma.contact.findFirst({ where: { id, vendorId } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async update(vendorId: string, id: string, dto: UpdateContactDto): Promise<Contact> {
    await this.findOne(vendorId, id);
    return this.prisma.contact.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        type: dto.type,
        address: dto.address,
        portalAccess: dto.portalAccess,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
        tags: dto.tags as Prisma.InputJsonValue | undefined,
        notes: dto.notes,
      },
    });
  }

  async remove(vendorId: string, id: string): Promise<{ id: string }> {
    await this.findOne(vendorId, id);
    await this.prisma.contact.delete({ where: { id } });
    return { id };
  }
}
