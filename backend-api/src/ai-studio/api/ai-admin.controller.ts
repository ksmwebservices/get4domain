import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { AiAdminService } from '../ai-admin.service';
import { CreatePromptDto, CreateProviderDto, GrantDto, PromptListDto, UpdateProviderDto, UsageReportDto } from './dto/ai.dto';

/** Staff side of AI Studio. Providers, prompts and credit grants: SUPER_ADMIN only. Usage: OPERATIONS and SUPER_ADMIN. MARKETING is refused everywhere. A provider secret is write-only. */
@ApiTags('v3-ai-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/ai')
export class AiAdminController {
  constructor(private readonly admin: AiAdminService) {}

  @Get('providers') @ApiOperation({ summary: 'AI providers (the secret is never shown; only its last four characters)' }) providers() { return this.admin.listProviders(); }
  @Post('providers') @HttpCode(200) @ApiOperation({ summary: 'Add an AI provider; the secret is encrypted and cannot be read back' })
  createProvider(@Body() dto: CreateProviderDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.createProvider(dto, actorOf(u, req)); }
  @Put('providers/:id') @HttpCode(200) @ApiOperation({ summary: 'Change a provider (model, status, settings) or replace its secret' })
  updateProvider(@Param('id') id: string, @Body() dto: UpdateProviderDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.updateProvider(id, dto, actorOf(u, req)); }
  @Post('providers/:id/test') @HttpCode(200) @ApiOperation({ summary: 'Test a provider. Uses the built-in mock unless the setting aiLiveCalls is on.' })
  test(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.testProvider(id, actorOf(u, req)); }

  @Get('prompts') @ApiOperation({ summary: 'Prompt versions (the instruction templates), newest first' }) prompts(@Query() q: PromptListDto) { return this.admin.listPrompts(q.key); }
  @Post('prompts') @HttpCode(200) @ApiOperation({ summary: 'Save a new prompt version as a draft (only {{feature}}, {{maxChars}} and {{language}} may be used as placeholders)' })
  createPrompt(@Body() dto: CreatePromptDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.createPrompt(dto, actorOf(u, req)); }
  @Post('prompts/:id/activate') @HttpCode(200) @ApiOperation({ summary: 'Make a prompt version the active one for its feature (the previous one is retired)' })
  activate(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.activatePrompt(id, actorOf(u, req)); }

  @Post('credit-grants') @HttpCode(200) @ApiOperation({ summary: 'Grant extra AI credits to a vendor for the current month (reason required, audited)' })
  grant(@Body() dto: GrantDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.grantCredits(dto, actorOf(u, req)); }

  @Get('usage') @ApiOperation({ summary: 'AI usage by vendor and month (no generated text)' })
  async usage(@Query() q: UsageReportDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.admin.usageReport({ vendorId: q.vendorId, period: q.period, skip, take });
    return { ...paged(r.items, r.total, page, pageSize), period: r.period, creditsUsed: r.creditsUsed };
  }
}
