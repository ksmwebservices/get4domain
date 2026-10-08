import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Category, VendorCMS, VendorProduct } from '@prisma/client';
import { CmsService } from './cms.service';
import { UpdatePlatformCmsDto } from './dto/update-platform-cms.dto';
import { UpdateVendorCmsDto } from './dto/update-vendor-cms.dto';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { CreateCategoryDto, ReorderCategoriesDto, UpdateCategoryDto } from './dto/category.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

function assertOwnerOrAdmin(user: AuthenticatedUser, vendorId: string): void {
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  if (!isAdmin && user.sub !== vendorId) {
    throw new ForbiddenException('You may only manage your own CMS content');
  }
}

@ApiTags('cms')
@RequireModule('website')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Public()
  @Get('platform')
  @ApiOperation({ summary: 'Get all platform CMS settings (public — powers get4domain.com)' })
  getPlatformCms(): Promise<Record<string, string>> {
    return this.cmsService.getPlatformCms();
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Put('platform')
  @ApiOperation({ summary: 'Update platform CMS settings (admin only)' })
  updatePlatformCms(@Body() dto: UpdatePlatformCmsDto): Promise<Record<string, string>> {
    return this.cmsService.updatePlatformCms(dto);
  }

  @Public()
  @Get('site/:subdomain')
  @ApiOperation({ summary: 'Resolve a live vendor public site by subdomain (public — powers /site/[subdomain])' })
  getSite(@Param('subdomain') subdomain: string) {
    return this.cmsService.getSiteBySubdomain(subdomain);
  }

  @Public()
  @Get('vendor/:vendorId')
  @ApiOperation({ summary: "Get a vendor's website CMS settings (public — powers their vendor site)" })
  getVendorCms(@Param('vendorId') vendorId: string): Promise<VendorCMS | null> {
    return this.cmsService.getVendorCMS(vendorId);
  }

  @ApiBearerAuth()
  @Put('vendor/:vendorId')
  @ApiOperation({ summary: "Update a vendor's own website CMS settings (vendor or admin)" })
  updateVendorCms(
    @Param('vendorId') vendorId: string,
    @Body() dto: UpdateVendorCmsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VendorCMS> {
    assertOwnerOrAdmin(user, vendorId);
    return this.cmsService.updateVendorCMS(vendorId, dto);
  }

  @Public()
  @Get('vendor/:vendorId/products')
  @ApiOperation({ summary: "List a vendor's active products/services (public, whitelisted fields: availability only, no internal stock data)" })
  getVendorProducts(@Param('vendorId') vendorId: string) {
    return this.cmsService.getPublicProducts(vendorId);
  }

  @ApiBearerAuth()
  @Get('vendor/:vendorId/products/manage')
  @ApiOperation({ summary: "The vendor's own full product list incl. hidden items and stock fields (owner, permitted staff or admin)" })
  getVendorProductsManage(@Param('vendorId') vendorId: string, @CurrentUser() user: AuthenticatedUser): Promise<VendorProduct[]> {
    assertOwnerOrAdmin(user, vendorId);
    return this.cmsService.getVendorProducts(vendorId);
  }

  @ApiBearerAuth()
  @Get('vendor/:vendorId/categories/manage')
  @ApiOperation({ summary: 'All categories (incl. hidden) with product counts (owner, permitted staff or admin)' })
  getCategoriesManage(@Param('vendorId') vendorId: string, @CurrentUser() user: AuthenticatedUser) {
    assertOwnerOrAdmin(user, vendorId);
    return this.cmsService.getCategoriesForManage(vendorId);
  }

  @ApiBearerAuth()
  @Post('vendor/:vendorId/categories')
  @ApiOperation({ summary: 'Create a category (a repeat name returns the existing one)' })
  createCategory(@Param('vendorId') vendorId: string, @Body() dto: CreateCategoryDto, @CurrentUser() user: AuthenticatedUser): Promise<Category> {
    assertOwnerOrAdmin(user, vendorId);
    return this.cmsService.createCategory(vendorId, dto.name);
  }

  @ApiBearerAuth()
  @Put('vendor/:vendorId/categories/order')
  @ApiOperation({ summary: 'Set the display order of the vendor\'s categories' })
  async reorderCategories(@Param('vendorId') vendorId: string, @Body() dto: ReorderCategoriesDto, @CurrentUser() user: AuthenticatedUser): Promise<{ ok: true }> {
    assertOwnerOrAdmin(user, vendorId);
    await this.cmsService.reorderCategories(vendorId, dto.ids);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Put('vendor/:vendorId/categories/:id')
  @ApiOperation({ summary: 'Rename, hide/show or re-order a category' })
  updateCategory(@Param('vendorId') vendorId: string, @Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: AuthenticatedUser): Promise<Category> {
    assertOwnerOrAdmin(user, vendorId);
    return this.cmsService.updateCategory(vendorId, id, dto);
  }

  @ApiBearerAuth()
  @Delete('vendor/:vendorId/categories/:id')
  @ApiOperation({ summary: 'Delete a category; if products use it, pass ?moveTo=<categoryId> to move them first' })
  deleteCategory(@Param('vendorId') vendorId: string, @Param('id') id: string, @Query('moveTo') moveTo: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    assertOwnerOrAdmin(user, vendorId);
    return this.cmsService.deleteCategory(vendorId, id, moveTo);
  }

  @Public()
  @Get('vendor/:vendorId/categories')
  @ApiOperation({ summary: "List a vendor's real product categories (public) — the taxonomy addProduct/updateProduct resolve against, so a repeat name reuses the same row instead of creating a duplicate" })
  getVendorCategories(@Param('vendorId') vendorId: string): Promise<Category[]> {
    return this.cmsService.getVendorCategories(vendorId);
  }

  @ApiBearerAuth()
  @Post('vendor/:vendorId/products')
  @ApiOperation({ summary: 'Add a product/service to a vendor (vendor or admin)' })
  addProduct(
    @Param('vendorId') vendorId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VendorProduct> {
    assertOwnerOrAdmin(user, vendorId);
    return this.cmsService.addProduct(vendorId, dto, user.memberId ?? user.email ?? user.sub);
  }

  @ApiBearerAuth()
  @Put('products/:id')
  @ApiOperation({ summary: 'Update a product (owning vendor or admin)' })
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VendorProduct> {
    const ownerId = await this.cmsService.getProductOwner(id);
    assertOwnerOrAdmin(user, ownerId);
    return this.cmsService.updateProduct(id, dto, user.memberId ?? user.email ?? user.sub);
  }

  @ApiBearerAuth()
  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete a product (owning vendor or admin)' })
  async deleteProduct(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<VendorProduct> {
    const ownerId = await this.cmsService.getProductOwner(id);
    assertOwnerOrAdmin(user, ownerId);
    return this.cmsService.deleteProduct(id);
  }
}
