import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestOrder, TestOrderItem } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DiagnosticsService, DiagnosticsSummary } from './diagnostics.service';
import {
  CreateOrderDto, UpdateOrderDto,
  CreateOrderItemDto, UpdateOrderItemDto,
} from './dto/diagnostics.dto';

@ApiTags('diagnostics')
@ApiBearerAuth()
@Controller('diagnostics')
export class DiagnosticsController {
  constructor(private readonly service: DiagnosticsService) {}

  @Get('summary') @ApiOperation({ summary: 'Diagnostics summary (bookings, samples, reports, revenue)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<DiagnosticsSummary> { return this.service.summary(u.sub); }

  @Get('orders') listOrders(@CurrentUser() u: AuthenticatedUser): Promise<TestOrder[]> { return this.service.listOrders(u.sub); }
  @Get('orders/:id') getOrder(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<TestOrder> { return this.service.getOrder(u.sub, id); }
  @Post('orders') createOrder(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateOrderDto): Promise<TestOrder> { return this.service.createOrder(u.sub, d); }
  @Patch('orders/:id') updateOrder(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateOrderDto): Promise<TestOrder> { return this.service.updateOrder(u.sub, id, d); }
  @Delete('orders/:id') deleteOrder(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<TestOrder> { return this.service.deleteOrder(u.sub, id); }

  @Post('orders/:id/items') addItem(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: CreateOrderItemDto): Promise<TestOrderItem> { return this.service.addItem(u.sub, id, d); }
  @Patch('items/:id') updateItem(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateOrderItemDto): Promise<TestOrderItem> { return this.service.updateItem(u.sub, id, d); }
  @Delete('items/:id') deleteItem(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<TestOrderItem> { return this.service.deleteItem(u.sub, id); }
}
