import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebsiteTheme } from '@prisma/client';
import { WebsiteThemesService } from './website-themes.service';
import { CreateWebsiteThemeDto, UpdateWebsiteThemeDto } from './dto/website-theme.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('website-themes')
@ApiBearerAuth()
@Controller('website-themes')
export class WebsiteThemesController {
  constructor(private readonly service: WebsiteThemesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active themes (public — powers live-site theming); filter by ?industry=' })
  list(@Query('industry') industry?: string): Promise<WebsiteTheme[]> {
    return this.service.list(industry);
  }

  @UseGuards(AdminGuard)
  @Get('all')
  @ApiOperation({ summary: 'List all themes incl. inactive (admin)' })
  listAll(): Promise<WebsiteTheme[]> {
    return this.service.listAll();
  }

  @UseGuards(AdminGuard)
  @Post()
  @ApiOperation({ summary: 'Create a website theme (admin)' })
  create(@Body() dto: CreateWebsiteThemeDto, @CurrentUser() user: AuthenticatedUser): Promise<WebsiteTheme> {
    return this.service.create(dto, user.sub);
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  @ApiOperation({ summary: 'Update a website theme (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateWebsiteThemeDto): Promise<WebsiteTheme> {
    return this.service.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a website theme (admin)' })
  remove(@Param('id') id: string): Promise<WebsiteTheme> {
    return this.service.remove(id);
  }
}
