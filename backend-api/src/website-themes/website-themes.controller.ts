import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebsiteTheme } from '@prisma/client';
import { WebsiteThemesService } from './website-themes.service';
import { CreateWebsiteThemeDto, UpdateWebsiteThemeDto, ConfirmUnlockDto } from './dto/website-theme.dto';
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

  // ── Vendor-facing: themes for my industry with unlock status + premium purchase ──
  @Get('mine')
  @ApiOperation({ summary: "Themes for the vendor's industry, each with an `unlocked` flag" })
  mine(@CurrentUser() user: AuthenticatedUser, @Query('industry') industry?: string) {
    return this.service.listForVendor(user.sub, industry);
  }

  @Post(':id/unlock/order')
  @ApiOperation({ summary: 'Create a one-time Razorpay order to unlock a premium template' })
  unlockOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.createUnlockOrder(user.sub, id);
  }

  @Post(':id/unlock/confirm')
  @ApiOperation({ summary: 'Verify payment and unlock a premium template for this vendor' })
  unlockConfirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ConfirmUnlockDto) {
    return this.service.confirmUnlock(user.sub, id, dto);
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
