import { Body, Controller, Get, HttpCode, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { PROFILE_TYPES } from '../core/profile-core';
import { ProfileFieldsService } from '../profile.service';

class PackQueryDto { @IsOptional() @IsString() @MaxLength(40) packKey?: string }
class ProfileDto { @IsObject() values!: Record<string, unknown> }
class FieldEditDto {
  @IsString() @MaxLength(40) packKey!: string;
  @IsOptional() @IsString() @MaxLength(80) categorySlug?: string;
  @IsString() @MaxLength(40) fieldKey!: string;
  @IsString() @MaxLength(120) label!: string;
  @IsIn([...PROFILE_TYPES]) type!: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(80, { each: true }) options?: string[];
  @IsOptional() @IsInt() @Max(100_000) sortOrder?: number;
  @IsOptional() @IsString() @MaxLength(20) siteSection?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class MapEditDto {
  @IsOptional() @IsString() @MaxLength(40) packKey?: string;
  @IsOptional() @IsString() @MaxLength(80) categorySlug?: string;
  @IsString() @MaxLength(40) fieldKey!: string;
  @IsIn(['FIELD', 'LIST', 'NONE']) targetKind!: 'FIELD' | 'LIST' | 'NONE';
  @IsOptional() @IsString() @MaxLength(60) targetKey?: string;
  @IsOptional() @IsObject() itemMap?: Record<string, unknown>;
  @IsOptional() @IsBoolean() active?: boolean;
}
const vendorActor = (u: AuthenticatedUser, req: Request): Actor => ({ type: 'VENDOR', id: u?.sub ?? null, ip: req?.ip ?? null });
const staffActor = (u: AuthenticatedUser, req: Request): Actor => ({ type: 'STAFF', id: u?.sub ?? null, ip: req?.ip ?? null });

/** The signed-in business's own profile. The vendor is always the verified principal's vendor; a team member needs the website area. */
@ApiTags('v3-profile-me')
@ApiBearerAuth()
@UseTenant()
@RequireModule('website')
@Controller('v3/me')
export class MeProfileController {
  constructor(private readonly profile: ProfileFieldsService) {}

  @Get('profile-schema') @ApiOperation({ summary: 'The profile fields for my business category: the common set and the fields of my industry (none while a health, legal or finance pack is not open)' })
  schema(@Tenant() t: TenantContext) { return this.profile.schemaForVendor(t.vendorId); }

  @Get('profile') @ApiOperation({ summary: 'The profile details I have given' })
  mine(@Tenant() t: TenantContext) { return this.profile.mine(t.vendorId); }

  @Throttle(RATE.recordWrite) @Put('profile') @HttpCode(200) @ApiOperation({ summary: 'Save profile details: each is checked against my category\'s fields, kept, and written into my site content by the map. Only the fields sent change; null clears an optional field.' })
  save(@Tenant() t: TenantContext, @Body() dto: ProfileDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.profile.save(t.vendorId, vendorActor(u, req), dto.values); }
}

/**
 * Staff side. WHO may call each route is DATA in admin-role-matrix.ts: every staff role that creates listings on behalf reads a category's schema and fills a listing's profile; the field sets and the map are edited by
 * ADMIN and SUPER_ADMIN only, and every edit is audited. A route with no entry is SUPER_ADMIN only.
 */
@ApiTags('v3-profile-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminProfileController {
  constructor(private readonly profile: ProfileFieldsService) {}

  @Get('categories/:slug/profile-schema') @ApiOperation({ summary: 'The profile fields a business of this category fills in (the pack\'s fields with the category\'s own on top)' })
  schema(@Param('slug') slug: string) { return this.profile.schemaFor(slug); }

  @Get('profile-fields') @ApiOperation({ summary: 'Every profile field and every map row, optionally for one pack' })
  list(@Query() q: PackQueryDto) { return this.profile.listAll(q.packKey); }

  @Put('profile-fields') @HttpCode(200) @ApiOperation({ summary: 'Add or change one profile field of a pack or a category (ADMIN and SUPER_ADMIN, audited)' })
  editField(@Body() dto: FieldEditDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.profile.editField(dto, { id: u?.sub ?? null, ip: req?.ip ?? null }); }

  @Put('profile-fields/map') @HttpCode(200) @ApiOperation({ summary: 'Add or change where a profile field goes in the site content (ADMIN and SUPER_ADMIN, audited)' })
  editMap(@Body() dto: MapEditDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.profile.editMap(dto, { id: u?.sub ?? null, ip: req?.ip ?? null }); }

  @Get('seeded-sites/:id/profile') @ApiOperation({ summary: 'The profile details of a listing made on behalf' })
  forListing(@Param('id') id: string) { return this.profile.forListing(id); }

  @Throttle(RATE.recordWrite) @Put('seeded-sites/:id/profile') @HttpCode(200) @ApiOperation({ summary: 'Save the profile details of a listing made on behalf: checked against its category, kept, and written into its site content (audited)' })
  saveForListing(@Param('id') id: string, @Body() dto: ProfileDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.profile.saveForListing(id, staffActor(u, req), dto.values); }
}
