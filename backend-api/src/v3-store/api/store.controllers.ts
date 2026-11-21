import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { RequiresFeature } from '../../plans/entitlements/requires-feature.decorator';
import { MOVEMENT_REASONS } from '../core/store-core';
import { StoreService } from '../store.service';

export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class ProductListDto extends PageDto { @IsOptional() @IsString() @MaxLength(80) q?: string; @IsOptional() @IsBoolean() @Type(() => Boolean) includeArchived?: boolean }
export class CreateProductDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(40) sku?: string;
  @IsOptional() @IsString() @MaxLength(8) hsnSac?: string;
  @Type(() => Number) @IsInt() @Min(1) pricePaise!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) taxRatePercent?: number;
  @IsOptional() @IsBoolean() trackStock?: boolean;
}
export class UpdateProductDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(40) sku?: string;
  @IsOptional() @IsString() @MaxLength(8) hsnSac?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pricePaise?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) taxRatePercent?: number;
  @IsOptional() @IsBoolean() trackStock?: boolean;
}
export class VariantDto { @IsString() @MaxLength(80) label!: string; @IsOptional() @IsString() @MaxLength(40) sku?: string; @IsOptional() @Type(() => Number) @IsInt() @Min(1) pricePaise?: number }
export class UpdateVariantDto { @IsOptional() @IsString() @MaxLength(80) label?: string; @IsOptional() @IsString() @MaxLength(40) sku?: string; @IsOptional() @Type(() => Number) @IsInt() @Min(1) pricePaise?: number }
export class StockDto {
  @Type(() => Number) @IsInt() delta!: number;
  @IsIn([...MOVEMENT_REASONS]) reason!: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsOptional() @IsString() @MaxLength(70) idempotencyKey?: string;
}
export class ReturnDto { @IsString() @MaxLength(300) reason!: string; @IsOptional() @Type(() => Number) @IsInt() @Min(0) amountPaise?: number; @IsOptional() @IsString() @MaxLength(300) note?: string }
export class ReturnListDto extends PageDto { @IsOptional() @IsString() @MaxLength(40) orderId?: string }
export class ImportDto { @IsArray() rows!: unknown[]; @IsOptional() @IsBoolean() apply?: boolean }

/** The store of an Ecommerce business. OWNER ONLY for now (stock and customer details; staff access arrives with the team slice), plan feature `store.manage` (Free sees it locked; other tracks do not see it). Orders, coupons, shipping and refund records stay on the Stage 9 routes. */
@ApiTags('v3-store-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('store.manage')
@Controller('v3/me/store')
export class MeStoreController {
  constructor(private readonly store: StoreService) {}

  @Get('products') @ApiOperation({ summary: 'My products with their variants, newest first' })
  async products(@Tenant() t: TenantContext, @Query() q: ProductListDto) { const { page, pageSize } = pageArgs(q); const r = await this.store.listProducts(t.vendorId, q, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Get('products/:id') @ApiOperation({ summary: 'One product with its variants' })
  product(@Tenant() t: TenantContext, @Param('id') id: string) { return this.store.getProduct(t.vendorId, id); }
  @Post('products') @HttpCode(200) @ApiOperation({ summary: 'Add a product; a tax rate must be one in the rate table' })
  addProduct(@Tenant() t: TenantContext, @Body() dto: CreateProductDto) { return this.store.createProduct(t.vendorId, dto); }
  @Put('products/:id') @HttpCode(200) @ApiOperation({ summary: 'Change a product' })
  changeProduct(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: UpdateProductDto) { return this.store.updateProduct(t.vendorId, id, dto); }
  @Post('products/:id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a product (never deleted)' })
  archiveProduct(@Tenant() t: TenantContext, @Param('id') id: string) { return this.store.archiveProduct(t.vendorId, id, true); }
  @Post('products/:id/restore') @HttpCode(200) @ApiOperation({ summary: 'Bring an archived product back' })
  restoreProduct(@Tenant() t: TenantContext, @Param('id') id: string) { return this.store.archiveProduct(t.vendorId, id, false); }
  @Post('products/:id/variants') @HttpCode(200) @ApiOperation({ summary: 'Add a variant (size, colour, pack)' })
  addVariant(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: VariantDto) { return this.store.addVariant(t.vendorId, id, dto); }
  @Put('variants/:id') @HttpCode(200) @ApiOperation({ summary: 'Change a variant' })
  changeVariant(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: UpdateVariantDto) { return this.store.updateVariant(t.vendorId, id, dto); }
  @Post('variants/:id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a variant (never deleted)' })
  archiveVariant(@Tenant() t: TenantContext, @Param('id') id: string) { return this.store.archiveVariant(t.vendorId, id, true); }
  @Post('variants/:id/restore') @HttpCode(200) @ApiOperation({ summary: 'Bring an archived variant back' })
  restoreVariant(@Tenant() t: TenantContext, @Param('id') id: string) { return this.store.archiveVariant(t.vendorId, id, false); }

  @Get('inventory') @ApiOperation({ summary: 'On hand, held for orders and available, per product and variant' })
  async inventory(@Tenant() t: TenantContext, @Query() q: PageDto) { const { page, pageSize } = pageArgs(q); const r = await this.store.inventory(t.vendorId, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Post('stock/import') @HttpCode(200) @ApiOperation({ summary: 'Import legacy stock rows (opening balances and movements); a dry run unless apply is true; safe to run again' })
  importStock(@Tenant() t: TenantContext, @Body() dto: ImportDto) { return this.store.importStock(t.vendorId, dto.rows, dto.apply === true); }
  @Get('stock/:ref/moves') @ApiOperation({ summary: 'The ledger of one product or variant, newest first' })
  async moves(@Tenant() t: TenantContext, @Param('ref') ref: string, @Query() q: PageDto) { const { page, pageSize } = pageArgs(q); const r = await this.store.movements(t.vendorId, ref, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Post('stock/:ref') @HttpCode(200) @ApiOperation({ summary: 'Change the stock of a product or variant; a decrease below zero is refused' })
  adjust(@Tenant() t: TenantContext, @Param('ref') ref: string, @Body() dto: StockDto) { return this.store.adjustStock(t.vendorId, ref, dto); }

  @Get('checkout') @ApiOperation({ summary: 'What my shop does at checkout today: online UPI or an order request' })
  checkout(@Tenant() t: TenantContext) { return this.store.checkout(t.vendorId); }
  @Get('returns') @ApiOperation({ summary: 'Returns I have recorded' })
  async returns(@Tenant() t: TenantContext, @Query() q: ReturnListDto) { const { page, pageSize } = pageArgs(q); const r = await this.store.listReturns(t.vendorId, q.orderId, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Post('orders/:orderId/returns') @HttpCode(200) @ApiOperation({ summary: 'Record a return for an order (a recorded fact: no refund is made and no provider is called)' })
  recordReturn(@Tenant() t: TenantContext, @Param('orderId') orderId: string, @Body() dto: ReturnDto) { return this.store.recordReturn(t.vendorId, orderId, dto); }
}
