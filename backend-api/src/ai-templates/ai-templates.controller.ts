import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiTemplate } from '@prisma/client';
import { AiTemplatesService } from './ai-templates.service';
import { CreateAiTemplateDto, UpdateAiTemplateDto } from './dto/ai-template.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('ai-templates')
@ApiBearerAuth()
@Controller('ai-templates')
export class AiTemplatesController {
  constructor(private readonly service: AiTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List active AI templates (vendor-facing); filter by ?contentType= & ?industry=' })
  list(@Query('contentType') contentType?: string, @Query('industry') industry?: string): Promise<AiTemplate[]> {
    return this.service.list(contentType, industry);
  }

  @UseGuards(AdminGuard)
  @Get('all')
  @ApiOperation({ summary: 'List all AI templates incl. inactive (admin)' })
  listAll(): Promise<AiTemplate[]> {
    return this.service.listAll();
  }

  @UseGuards(AdminGuard)
  @Post()
  @ApiOperation({ summary: 'Create an AI template (admin)' })
  create(@Body() dto: CreateAiTemplateDto, @CurrentUser() user: AuthenticatedUser): Promise<AiTemplate> {
    return this.service.create(dto, user.sub);
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  @ApiOperation({ summary: 'Update an AI template (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateAiTemplateDto): Promise<AiTemplate> {
    return this.service.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an AI template (admin)' })
  remove(@Param('id') id: string): Promise<AiTemplate> {
    return this.service.remove(id);
  }
}
