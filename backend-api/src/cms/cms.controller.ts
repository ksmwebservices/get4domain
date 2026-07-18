import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorCMS, VendorProduct } from '@prisma/client';
import { CmsService } from './cms.service';
import { UpdatePlatformCmsDto } from './dto/update-platform-cms.dto';
import { UpdateVendorCmsDto } from './dto/update-vendor-cms.dto';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
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
  @ApiOperation({ summary: "List a vendor's products/services (public)" })
  getVendorProducts(@Param('vendorId') vendorId: string): Promise<VendorProduct[]> {
    return this.cmsService.getVendorProducts(vendorId);
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
    return this.cmsService.addProduct(vendorId, dto);
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
    return this.cmsService.updateProduct(id, dto);
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
