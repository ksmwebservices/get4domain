import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { AiGenerateService } from '../ai-generate.service';
import { GenerateDto } from './dto/ai.dto';

/**
 * AI suggestions for the signed-in vendor. The vendor is ALWAYS the verified principal's vendor (@UseTenant). The owner may use it, and so may a team member who has the website area
 * (the existing area rule). Every answer is labelled AI-generated and nothing is published: the vendor accepts a suggestion into a draft field through the normal APIs.
 */
@ApiTags('v3-ai')
@ApiBearerAuth()
@UseTenant()
@RequireModule('website')
@Controller('v3/me/ai')
export class MeAiController {
  constructor(private readonly ai: AiGenerateService) {}

  @Throttle(RATE.aiGenerate) @Post('generate') @HttpCode(200)
  @ApiOperation({ summary: 'Ask for one AI suggestion (site copy, SEO title or description, directory description, review reply). Idempotent by key; uses plan credits; the answer is labelled AI-generated.' })
  generate(@Tenant() t: TenantContext, @Body() dto: GenerateDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.ai.generate(t.vendorId, dto, { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null });
  }

  @Get('usage') @ApiOperation({ summary: 'My AI credits this month: included, granted, used, remaining, and my recent requests' })
  usage(@Tenant() t: TenantContext) { return this.ai.usage(t.vendorId); }
}
