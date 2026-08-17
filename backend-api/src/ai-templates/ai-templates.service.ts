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

  private jsonFields(dto: { fields?: unknown[]; editorJson?: Record<string, unknown>; videoConfig?: Record<string, unknown> }) {
    return {
      ...(dto.fields !== undefined ? { fields: dto.fields as Prisma.InputJsonValue } : {}),
      ...(dto.editorJson !== undefined ? { editorJson: dto.editorJson as Prisma.InputJsonValue } : {}),
      ...(dto.videoConfig !== undefined ? { videoConfig: dto.videoConfig as Prisma.InputJsonValue } : {}),
    };
  }

  create(dto: CreateAiTemplateDto, createdBy?: string): Promise<AiTemplate> {
    const { fields, editorJson, videoConfig, ...rest } = dto;
    return this.prisma.aiTemplate.create({
      data: { ...rest, createdBy, ...this.jsonFields({ fields, editorJson, videoConfig }) },
    });
  }

  async update(id: string, dto: UpdateAiTemplateDto): Promise<AiTemplate> {
    if (!(await this.prisma.aiTemplate.findUnique({ where: { id } }))) throw new NotFoundException('Template not found');
    const { fields, editorJson, videoConfig, ...rest } = dto;
    return this.prisma.aiTemplate.update({
      where: { id },
      data: { ...rest, ...this.jsonFields({ fields, editorJson, videoConfig }) },
    });
  }

  async remove(id: string): Promise<AiTemplate> {
    if (!(await this.prisma.aiTemplate.findUnique({ where: { id } }))) throw new NotFoundException('Template not found');
    return this.prisma.aiTemplate.delete({ where: { id } });
  }
}
