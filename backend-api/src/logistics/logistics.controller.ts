import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Shipment } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LogisticsService, LogisticsSummary } from './logistics.service';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/logistics.dto';

@ApiTags('logistics')
@ApiBearerAuth()
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly service: LogisticsService) {}

  @Get('summary') @ApiOperation({ summary: 'Logistics summary (active shipments, in-transit, freight)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<LogisticsSummary> { return this.service.summary(u.sub); }

  @Get('shipments') listShipments(@CurrentUser() u: AuthenticatedUser): Promise<Shipment[]> { return this.service.listShipments(u.sub); }
  @Post('shipments') createShipment(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateShipmentDto): Promise<Shipment> { return this.service.createShipment(u.sub, d); }
  @Patch('shipments/:id') updateShipment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateShipmentDto): Promise<Shipment> { return this.service.updateShipment(u.sub, id, d); }
  @Delete('shipments/:id') deleteShipment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Shipment> { return this.service.deleteShipment(u.sub, id); }
}
