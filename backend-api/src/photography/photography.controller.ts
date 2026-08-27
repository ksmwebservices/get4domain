import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PhotoShoot, ShootDeliverable } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PhotographyService, PhotographySummary } from './photography.service';
import {
  CreateShootDto, UpdateShootDto,
  CreateDeliverableDto, UpdateDeliverableDto,
} from './dto/photography.dto';

@ApiTags('photography')
@ApiBearerAuth()
@Controller('photography')
export class PhotographyController {
  constructor(private readonly service: PhotographyService) {}

  @Get('summary') @ApiOperation({ summary: 'Photography summary (upcoming shoots, value, deliveries)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<PhotographySummary> { return this.service.summary(u.sub); }

  @Get('shoots') listShoots(@CurrentUser() u: AuthenticatedUser): Promise<PhotoShoot[]> { return this.service.listShoots(u.sub); }
  @Get('shoots/:id') getShoot(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<PhotoShoot> { return this.service.getShoot(u.sub, id); }
  @Post('shoots') createShoot(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateShootDto): Promise<PhotoShoot> { return this.service.createShoot(u.sub, d); }
  @Patch('shoots/:id') updateShoot(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateShootDto): Promise<PhotoShoot> { return this.service.updateShoot(u.sub, id, d); }
  @Delete('shoots/:id') deleteShoot(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<PhotoShoot> { return this.service.deleteShoot(u.sub, id); }

  @Post('shoots/:id/deliverables') addDeliverable(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: CreateDeliverableDto): Promise<ShootDeliverable> { return this.service.addDeliverable(u.sub, id, d); }
  @Get('deliverables') listDeliverables(@CurrentUser() u: AuthenticatedUser): Promise<ShootDeliverable[]> { return this.service.listDeliverables(u.sub); }
  @Patch('deliverables/:id') updateDeliverable(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateDeliverableDto): Promise<ShootDeliverable> { return this.service.updateDeliverable(u.sub, id, d); }
  @Delete('deliverables/:id') deleteDeliverable(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ShootDeliverable> { return this.service.deleteDeliverable(u.sub, id); }
}
