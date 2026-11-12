import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { RequiresFeature } from '../../plans/entitlements/requires-feature.decorator';
import { CONSENT_STATES, CUSTOMER_SOURCES } from '../core/customer-core';
import { CustomersService } from '../customers.service';

export class CustomerListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn([...CUSTOMER_SOURCES]) source?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) includeArchived?: boolean;
}
export class CreateCustomerDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
}
export class UpdateCustomerDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
  @IsOptional() @IsIn([...CONSENT_STATES]) consent?: 'UNKNOWN' | 'OPTED_IN' | 'OPTED_OUT';
}

/**
 * The business's own customer list. OWNER ONLY for now (it holds personal details; staff access arrives with the team slice), Pro only (`crm.customers`: a Free vendor sees the screen locked).
 * The vendor is always the verified principal's vendor; another business's customer id answers like a missing one.
 */
@ApiTags('v3-customers-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('crm.customers')
@Controller('v3/me/customers')
export class MeCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get() @ApiOperation({ summary: 'My customers, newest first; filter by source or search by name, phone or e-mail' })
  async list(@Tenant() t: TenantContext, @Query() q: CustomerListDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.customers.list(t.vendorId, { q: q.q, source: q.source, includeArchived: q.includeArchived, skip, take }); return paged(r.items, r.total, page, pageSize); }
  @Get('summary') @ApiOperation({ summary: 'How many customers, and how many came from each source' })
  summary(@Tenant() t: TenantContext) { return this.customers.summary(t.vendorId); }
  @Get(':id') @ApiOperation({ summary: 'One customer with every source that reached them' })
  one(@Tenant() t: TenantContext, @Param('id') id: string) { return this.customers.get(t.vendorId, id); }
  @Post() @HttpCode(200) @ApiOperation({ summary: 'Add a customer by hand (source MANUAL); a person already on the list is refused with their id' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateCustomerDto) { return this.customers.create(t.vendorId, dto); }
  @Put(':id') @HttpCode(200) @ApiOperation({ summary: 'Change a customer; an opt-out cannot be turned back on by the business' })
  update(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.customers.update(t.vendorId, id, dto); }
  @Post(':id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a customer (never deleted)' })
  archive(@Tenant() t: TenantContext, @Param('id') id: string) { return this.customers.archive(t.vendorId, id, true); }
  @Post(':id/restore') @HttpCode(200) @ApiOperation({ summary: 'Bring an archived customer back' })
  restore(@Tenant() t: TenantContext, @Param('id') id: string) { return this.customers.archive(t.vendorId, id, false); }
}
