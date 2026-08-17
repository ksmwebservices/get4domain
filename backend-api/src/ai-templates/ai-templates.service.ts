import { Injectable, NotFoundException } from '@nestjs/common';
import { AiTemplate, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAiTemplateDto, UpdateAiTemplateDto } from './dto/ai-template.dto';

@Injectable()
export class AiTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vendor-facing: active templates, optionally filtered by content type,
   *  industry (industry-scoped OR global), and source (prompt|canva|document). */
  list(contentType?: string, industry?: string, source?: string): Promise<AiTemplate[]> {
    return this.prisma.aiTemplate.findMany({
      where: {
        active: true,
        ...(contentType ? { contentType } : {}),
        ...(source ? { source } : {}),
        ...(industry ? { OR: [{ industry }, { industry: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin-facing: everything, incl. inactive. */
  listAll(): Promise<AiTemplate[]> {
    return this.prisma.aiTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateAiTemplateDto, createdBy?: string): Promise<AiTemplate> {
    const { fields, ...rest } = dto;
    return this.prisma.aiTemplate.create({
      data: { ...rest, createdBy, ...(fields !== undefined ? { fields: fields as Prisma.InputJsonValue } : {}) },
    });
  }

  async update(id: string, dto: UpdateAiTemplateDto): Promise<AiTemplate> {
    if (!(await this.prisma.aiTemplate.findUnique({ where: { id } }))) throw new NotFoundException('Template not found');
    const { fields, ...rest } = dto;
    return this.prisma.aiTemplate.update({
      where: { id },
      data: { ...rest, ...(fields !== undefined ? { fields: fields as Prisma.InputJsonValue } : {}) },
    });
  }

  async remove(id: string): Promise<AiTemplate> {
    if (!(await this.prisma.aiTemplate.findUnique({ where: { id } }))) throw new NotFoundException('Template not found');
    return this.prisma.aiTemplate.delete({ where: { id } });
  }
}
