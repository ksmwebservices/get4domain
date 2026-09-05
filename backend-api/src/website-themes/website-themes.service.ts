import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WebsiteTheme } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebsiteThemeDto, UpdateWebsiteThemeDto } from './dto/website-theme.dto';

@Injectable()
export class WebsiteThemesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active themes for an industry (industry-scoped OR global), default first. */
  list(industry?: string): Promise<WebsiteTheme[]> {
    return this.prisma.websiteTheme.findMany({
      where: { active: true, ...(industry ? { OR: [{ industry }, { industry: null }] } : {}) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  listAll(): Promise<WebsiteTheme[]> {
    return this.prisma.websiteTheme.findMany({ orderBy: { createdAt: 'desc' } });
  }

  get(id: string): Promise<WebsiteTheme | null> {
    return this.prisma.websiteTheme.findUnique({ where: { id } });
  }

  create(dto: CreateWebsiteThemeDto, createdBy?: string): Promise<WebsiteTheme> {
    const { cssVars, layout, ...rest } = dto;
    return this.prisma.websiteTheme.create({
      data: {
        ...rest,
        cssVars: cssVars as Prisma.InputJsonValue,
        ...(layout !== undefined ? { layout: layout as Prisma.InputJsonValue } : {}),
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateWebsiteThemeDto): Promise<WebsiteTheme> {
    if (!(await this.prisma.websiteTheme.findUnique({ where: { id } }))) throw new NotFoundException('Theme not found');
    const { cssVars, layout, ...rest } = dto;
    return this.prisma.websiteTheme.update({
      where: { id },
      data: {
        ...rest,
        ...(cssVars !== undefined ? { cssVars: cssVars as Prisma.InputJsonValue } : {}),
        ...(layout !== undefined ? { layout: layout as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async remove(id: string): Promise<WebsiteTheme> {
    if (!(await this.prisma.websiteTheme.findUnique({ where: { id } }))) throw new NotFoundException('Theme not found');
    return this.prisma.websiteTheme.delete({ where: { id } });
  }
}
