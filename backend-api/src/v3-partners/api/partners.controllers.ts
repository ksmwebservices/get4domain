import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { PARTNER_STATUSES, PARTNER_TYPES } from '../core/partner-core';
import { partnerError } from '../partners.errors';
import { PartnerGuard } from '../partner.guard';
import { partnerView, PartnersService } from '../partners.service';

/** Every field is optional here on purpose: the real checks (type, length, email and phone layout) are in the pure core, so every refusal is PARTNER_INVALID with the field names (a validator here would answer 400 with no code). */
export class PartnerEditDto {
  @IsOptional() type?: unknown;
  @IsOptional() name?: unknown;
  @IsOptional() email?: unknown;
  @IsOptional() phone?: unknown;
  @IsOptional() status?: unknown;
  @IsOptional() staffUserId?: unknown;
}

export class PartnerListDto {
  @IsOptional() @IsIn([...PARTNER_STATUSES]) status?: string;
  @IsOptional() @IsIn([...PARTNER_TYPES]) type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
}

/** Staff side. WHO may call each route is DATA in admin-role-matrix.ts: reading is OPERATIONS, ADMIN and SUPER_ADMIN; writing is ADMIN and SUPER_ADMIN. SALES and SUPPORT are refused. Writes are audited. */
@ApiTags('v3-partners-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/partners')
export class AdminPartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get() @ApiOperation({ summary: 'Referral partners, newest first; filter by status or type' })
  async list(@Query() q: PartnerListDto) { const a = pageArgs(q); const r = await this.partners.list({ status: q.status, type: q.type, skip: a.skip, take: a.take }); return paged(r.items, r.total, a.page, a.pageSize); }

  @Get(':id') @ApiOperation({ summary: 'One referral partner' })
  get(@Param('id') id: string) { return this.partners.get(id); }

  @Post() @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: add a referral partner (a freelancer, a sales team or an admin team)' })
  create(@Body() dto: PartnerEditDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.partners.create(dto, actorOf(u, req)); }

  @Put(':id') @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: change a partner, disable it, or link the referral-partner login it signs in with' })
  update(@Param('id') id: string, @Body() dto: PartnerEditDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.partners.update(id, dto, actorOf(u, req)); }
}

/** The partner's own area. Only a signed-in referral partner may call these (PartnerGuard); PartnerScopeGuard keeps a partner login on /v3/partner/* and nowhere else. */
@ApiTags('v3-partner')
@ApiBearerAuth()
@UseGuards(PartnerGuard)
@Controller('v3/partner')
export class PartnerPortalController {
  constructor(private readonly partners: PartnersService) {}

  @Get('me') @ApiOperation({ summary: 'Who I am as a referral partner: my name, type and status' })
  async me(@CurrentUser() u: AuthenticatedUser) {
    const p = await this.partners.forLogin(u.sub);
    if (!p) throw partnerError(404, 'PARTNER_NOT_FOUND', 'This login is not linked to an active partner.');
    const v = partnerView(p);
    return { id: v.id, name: v.name, type: v.type, status: v.status };
  }
}
