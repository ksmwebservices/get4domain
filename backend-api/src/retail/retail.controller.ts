import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PosSale, RetailProduct } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RetailService, RetailSummary } from './retail.service';
import {
  CreateProductDto, UpdateProductDto, RestockDto, CreateSaleDto,
} from './dto/retail.dto';

@ApiTags('retail')
@ApiBearerAuth()
@Controller('retail')
export class RetailController {
  constructor(private readonly service: RetailService) {}

  @Get('summary') @ApiOperation({ summary: 'Retail summary (today sales/revenue, stock, low stock)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<RetailSummary> { return this.service.summary(u.sub); }

  // Products / inventory
  @Get('products') listProducts(@CurrentUser() u: AuthenticatedUser): Promise<RetailProduct[]> { return this.service.listProducts(u.sub); }
  @Post('products') createProduct(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateProductDto): Promise<RetailProduct> { return this.service.createProduct(u.sub, d); }
  @Patch('products/:id') updateProduct(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateProductDto): Promise<RetailProduct> { return this.service.updateProduct(u.sub, id, d); }
  @Delete('products/:id') deleteProduct(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<RetailProduct> { return this.service.deleteProduct(u.sub, id); }
  @Post('products/:id/restock') restock(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: RestockDto): Promise<RetailProduct> { return this.service.restock(u.sub, id, d); }

  // Sales (POS)
  @Get('sales') listSales(@CurrentUser() u: AuthenticatedUser): Promise<PosSale[]> { return this.service.listSales(u.sub); }
  @Post('sales') createSale(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateSaleDto): Promise<PosSale> { return this.service.createSale(u.sub, d); }
  @Post('sales/:id/refund') refundSale(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<PosSale> { return this.service.refundSale(u.sub, id); }
}
