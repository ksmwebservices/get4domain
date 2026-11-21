import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { RequiresFeature } from '../../plans/entitlements/requires-feature.decorator';
import { AccountsService } from '../accounts.service';
import { EXPENSE_CATEGORIES, ITEM_KINDS } from '../core/accounts-core';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class SalesQueryDto extends PageDto {
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
}
export class SummaryQueryDto {
  @Matches(DAY) from!: string;
  @Matches(DAY) to!: string;
}
export class ExpenseListDto extends PageDto { @IsOptional() @IsBoolean() @Type(() => Boolean) includeArchived?: boolean }
export class CreateExpenseDto {
  @Matches(DAY) date!: string;
  @IsIn([...EXPENSE_CATEGORIES]) category!: string;
  @IsString() @MaxLength(200) description!: string;
  @Type(() => Number) @IsInt() @Min(1) amountPaise!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) gstPaise?: number;
}
export class UpdateExpenseDto {
  @IsOptional() @Matches(DAY) date?: string;
  @IsOptional() @IsIn([...EXPENSE_CATEGORIES]) category?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) amountPaise?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) gstPaise?: number;
}
export class ItemListDto extends PageDto {
  @IsOptional() @IsIn([...ITEM_KINDS]) kind?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) includeArchived?: boolean;
}
export class CreateItemDto {
  @IsIn([...ITEM_KINDS]) kind!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(8) hsnSac?: string;
  @IsOptional() @IsString() @MaxLength(12) unit?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) pricePaise?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) taxRatePercent?: number;
}
export class UpdateItemDto {
  @IsOptional() @IsIn([...ITEM_KINDS]) kind?: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(8) hsnSac?: string;
  @IsOptional() @IsString() @MaxLength(12) unit?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) pricePaise?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) taxRatePercent?: number;
}

/** Sales, expenses and the GST summary of the business. OWNER ONLY (money data; staff access arrives with the team slice), plan feature `accounts.books` (Free sees it locked). */
@ApiTags('v3-accounts-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('accounts.books')
@Controller('v3/me/accounts')
export class MeAccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('sales') @ApiOperation({ summary: 'Sale records posted from my invoices and receipts, newest first; optional from and to days' })
  async sales(@Tenant() t: TenantContext, @Query() q: SalesQueryDto) { const { page, pageSize } = pageArgs(q); const r = await this.accounts.listSales(t.vendorId, { from: q.from, to: q.to }, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Post('sync') @HttpCode(200) @ApiOperation({ summary: 'Post any invoice or receipt that is not in my books yet (safe to repeat)' })
  sync(@Tenant() t: TenantContext) { return this.accounts.syncDocuments(t.vendorId); }
  @Get('gst-summary') @ApiOperation({ summary: 'GST summary of a period from my sales, my expenses and my tax profile (a working figure, not a return)' })
  gst(@Tenant() t: TenantContext, @Query() q: SummaryQueryDto) { return this.accounts.gstSummary(t.vendorId, q.from, q.to); }

  @Get('expenses') @ApiOperation({ summary: 'My expenses, newest first' })
  async expenses(@Tenant() t: TenantContext, @Query() q: ExpenseListDto) { const { page, pageSize } = pageArgs(q); const r = await this.accounts.listExpenses(t.vendorId, page, pageSize, q.includeArchived === true); return paged(r.items, r.total, page, pageSize); }
  @Post('expenses') @HttpCode(200) @ApiOperation({ summary: 'Add an expense' })
  addExpense(@Tenant() t: TenantContext, @Body() dto: CreateExpenseDto) { return this.accounts.createExpense(t.vendorId, dto); }
  @Put('expenses/:id') @HttpCode(200) @ApiOperation({ summary: 'Change an expense' })
  changeExpense(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: UpdateExpenseDto) { return this.accounts.updateExpense(t.vendorId, id, dto); }
  @Post('expenses/:id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive an expense (never deleted)' })
  archiveExpense(@Tenant() t: TenantContext, @Param('id') id: string) { return this.accounts.archiveExpense(t.vendorId, id, true); }
  @Post('expenses/:id/restore') @HttpCode(200) @ApiOperation({ summary: 'Bring an archived expense back' })
  restoreExpense(@Tenant() t: TenantContext, @Param('id') id: string) { return this.accounts.archiveExpense(t.vendorId, id, false); }
}

/** Items and services with HSN or SAC code and a tax rate from the rate table. Plan feature `accounts.items`: Handyman and Professional only (hidden on the store track), Free locked. */
@ApiTags('v3-accounts-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('accounts.items')
@Controller('v3/me/items')
export class MeItemsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get() @ApiOperation({ summary: 'My items and services, newest first; filter by kind or search by name' })
  async list(@Tenant() t: TenantContext, @Query() q: ItemListDto) { const { page, pageSize } = pageArgs(q); const r = await this.accounts.listItems(t.vendorId, q, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Post() @HttpCode(200) @ApiOperation({ summary: 'Add an item or a service; a tax rate must be one in the rate table' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateItemDto) { return this.accounts.createItem(t.vendorId, dto); }
  @Put(':id') @HttpCode(200) @ApiOperation({ summary: 'Change an item or a service' })
  update(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: UpdateItemDto) { return this.accounts.updateItem(t.vendorId, id, dto); }
  @Post(':id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive an item (never deleted)' })
  archive(@Tenant() t: TenantContext, @Param('id') id: string) { return this.accounts.archiveItem(t.vendorId, id, true); }
  @Post(':id/restore') @HttpCode(200) @ApiOperation({ summary: 'Bring an archived item back' })
  restore(@Tenant() t: TenantContext, @Param('id') id: string) { return this.accounts.archiveItem(t.vendorId, id, false); }
}
