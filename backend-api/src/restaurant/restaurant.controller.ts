import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PosTable, RestaurantOrder, RestaurantOrderItem } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RestaurantService, RestaurantSummary } from './restaurant.service';
import {
  CreateTableDto, UpdateTableDto,
  CreateOrderDto, UpdateOrderDto,
  AddItemDto, UpdateItemDto, BillOrderDto,
} from './dto/restaurant.dto';

@ApiTags('restaurant')
@ApiBearerAuth()
@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly service: RestaurantService) {}

  @Get('summary') @ApiOperation({ summary: 'Restaurant summary (open orders, tables, kitchen, revenue)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<RestaurantSummary> { return this.service.summary(u.sub); }

  // Tables
  @Get('tables') listTables(@CurrentUser() u: AuthenticatedUser): Promise<PosTable[]> { return this.service.listTables(u.sub); }
  @Post('tables') createTable(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateTableDto): Promise<PosTable> { return this.service.createTable(u.sub, d); }
  @Patch('tables/:id') updateTable(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateTableDto): Promise<PosTable> { return this.service.updateTable(u.sub, id, d); }
  @Delete('tables/:id') deleteTable(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<PosTable> { return this.service.deleteTable(u.sub, id); }

  // Orders
  @Get('orders') listOrders(@CurrentUser() u: AuthenticatedUser): Promise<RestaurantOrder[]> { return this.service.listOrders(u.sub); }
  @Get('orders/:id') getOrder(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<RestaurantOrder> { return this.service.getOrder(u.sub, id); }
  @Post('orders') createOrder(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateOrderDto): Promise<RestaurantOrder> { return this.service.createOrder(u.sub, d); }
  @Patch('orders/:id') updateOrder(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateOrderDto): Promise<RestaurantOrder> { return this.service.updateOrder(u.sub, id, d); }
  @Post('orders/:id/bill') billOrder(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: BillOrderDto): Promise<RestaurantOrder> { return this.service.billOrder(u.sub, id, d); }
  @Delete('orders/:id') deleteOrder(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<RestaurantOrder> { return this.service.deleteOrder(u.sub, id); }

  // Items
  @Post('orders/:id/items') addItem(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: AddItemDto): Promise<RestaurantOrderItem> { return this.service.addItem(u.sub, id, d); }
  @Patch('items/:id') updateItem(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateItemDto): Promise<RestaurantOrderItem> { return this.service.updateItem(u.sub, id, d); }
  @Delete('items/:id') deleteItem(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<RestaurantOrderItem> { return this.service.deleteItem(u.sub, id); }

  // Kitchen display
  @Get('kitchen') listKitchen(@CurrentUser() u: AuthenticatedUser): Promise<RestaurantOrderItem[]> { return this.service.listKitchen(u.sub); }
}
