import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto';

const isAdmin = (u: AuthenticatedUser): boolean => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN';

/**
 * Stock endpoints. Same access model as My Products: the owner, or a team member whose access includes the
 * `website` area (the products permission), or a platform admin. Nobody else.
 */
@ApiTags('stock')
@ApiBearerAuth()
@RequireModule('website')
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  private async scope(user: AuthenticatedUser, productId: string): Promise<string> {
    const owner = await this.stock.ownerOf(productId);
    if (!isAdmin(user) && user.sub !== owner) throw new ForbiddenException('You may only manage your own products');
    return owner;
  }

  @Post('products/:productId/adjust')
  @ApiOperation({ summary: 'Add, remove or set a counted quantity for a product (never below 0); writes a stock movement' })
  async adjust(@Param('productId') productId: string, @Body() dto: AdjustStockDto, @CurrentUser() user: AuthenticatedUser) {
    const vendorId = await this.scope(user, productId);
    return this.stock.adjust(vendorId, productId, dto, user.memberId ?? user.email ?? user.sub);
  }

  @Get('products/:productId/history')
  @ApiOperation({ summary: "A product's stock movements, newest first" })
  async history(@Param('productId') productId: string, @Query('take') take: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    const vendorId = await this.scope(user, productId);
    return this.stock.history(vendorId, productId, take ? Number(take) : 50);
  }

  @Get('low')
  @ApiOperation({ summary: "The vendor's tracked products at or below their low-stock level" })
  low(@CurrentUser() user: AuthenticatedUser) {
    if (isAdmin(user)) throw new ForbiddenException('Open a vendor to see their low-stock list');
    return this.stock.lowStock(user.sub);
  }
}
