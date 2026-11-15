import { Body, Controller, Get, HttpCode, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PackTabFieldsAdminService } from '../pack-tab-fields-admin.service';

class TabQueryDto { @IsString() @MaxLength(60) ownerKey!: string; @IsString() @MaxLength(60) tabKey!: string }
class FieldEditDto {
  @IsString() @MaxLength(60) ownerKey!: string;
  @IsString() @MaxLength(60) tabKey!: string;
  @IsString() @MaxLength(40) fieldKey!: string;
  @IsString() @MaxLength(200) label!: string;
  @IsString() @MaxLength(20) type!: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() options?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
  @IsOptional() @IsBoolean() listColumn?: boolean;
  @IsOptional() @IsBoolean() searchable?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

/**
 * Staff edit of the record fields of a pack tab (Wave 2 Part G). WHO may call each route is DATA in admin-role-matrix.ts: reading is OPERATIONS and SUPER_ADMIN (ADMIN by inheritance), editing is SUPER_ADMIN and ADMIN
 * (STAFF_ROLE_EXTENSIONS.ADMIN.allow); a route with no entry is SUPER_ADMIN only. Every edit is audited.
 */
@ApiTags('v3-pack-records-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/pack-engine/tab-fields')
export class AdminPackTabFieldsController {
  constructor(private readonly svc: PackTabFieldsAdminService) {}

  @Get() @ApiOperation({ summary: 'Every record field of one pack, capability or add-on tab, hidden ones included, with the field types on offer' })
  list(@Query() q: TabQueryDto) { return this.svc.list(q.ownerKey, q.tabKey); }

  @Put() @HttpCode(200) @ApiOperation({ summary: 'Add or change one record field of a tab (ADMIN and SUPER_ADMIN, audited). Nothing is deleted: active=false hides a field. A type cannot change once businesses have records on the tab.' })
  edit(@Body() dto: FieldEditDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.svc.edit(dto, { id: u?.sub ?? null, ip: req?.ip ?? null }); }
}
