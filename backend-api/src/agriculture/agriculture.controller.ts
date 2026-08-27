import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProduceOrder, ProduceStock } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AgricultureService, AgricultureSummary } from './agriculture.service';
import {
  CreateOrderDto, UpdateOrderDto,
  CreateStockDto, UpdateStockDto,
} from './dto/agriculture.dto';

@ApiTags('agriculture')
@ApiBearerAuth()
@Controller('agriculture')
export class AgricultureController {
  constructor(private readonly service: AgricultureService) {}

  @Get('summary') @ApiOperation({ summary: 'Agriculture summary (open orders, value, stock)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<AgricultureSummary> { return this.service.summary(u.sub); }

  @Get('orders') listOrders(@CurrentUser() u: AuthenticatedUser): Promise<ProduceOrder[]> { return this.service.listOrders(u.sub); }
  @Post('orders') createOrder(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateOrderDto): Promise<ProduceOrder> { return this.service.createOrder(u.sub, d); }
  @Patch('orders/:id') updateOrder(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateOrderDto): Promise<ProduceOrder> { return this.service.updateOrder(u.sub, id, d); }
  @Delete('orders/:id') deleteOrder(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ProduceOrder> { return this.service.deleteOrder(u.sub, id); }

  @Get('stock') listStock(@CurrentUser() u: AuthenticatedUser): Promise<ProduceStock[]> { return this.service.listStock(u.sub); }
  @Post('stock') createStock(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateStockDto): Promise<ProduceStock> { return this.service.createStock(u.sub, d); }
  @Patch('stock/:id') updateStock(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateStockDto): Promise<ProduceStock> { return this.service.updateStock(u.sub, id, d); }
  @Delete('stock/:id') deleteStock(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ProduceStock> { return this.service.deleteStock(u.sub, id); }
}
