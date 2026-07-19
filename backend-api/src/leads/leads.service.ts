import { Injectable, NotFoundException } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLeadDto): Promise<Lead> {
    return this.prisma.lead.create({ data: dto });
  }

  findAll(): Promise<Lead[]> {
    return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updateStatus(id: string, status: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return this.prisma.lead.update({ where: { id }, data: { status } });
  }
}
