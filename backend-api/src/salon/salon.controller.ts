import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Stylist, SalonChair, SalonAppointment } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SalonService, SalonSummary } from './salon.service';
import {
  CreateStylistDto, UpdateStylistDto, CreateChairDto, UpdateChairDto,
  CreateSalonAppointmentDto, UpdateSalonAppointmentDto,
} from './dto/salon.dto';

@ApiTags('salon')
@ApiBearerAuth()
@Controller('salon')
export class SalonController {
  constructor(private readonly service: SalonService) {}

  @Get('summary') @ApiOperation({ summary: 'Salon ops summary (today/upcoming, revenue by stylist)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<SalonSummary> { return this.service.summary(u.sub); }

  // Stylists
  @Get('stylists') listStylists(@CurrentUser() u: AuthenticatedUser): Promise<Stylist[]> { return this.service.listStylists(u.sub); }
  @Post('stylists') createStylist(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateStylistDto): Promise<Stylist> { return this.service.createStylist(u.sub, d); }
  @Patch('stylists/:id') updateStylist(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateStylistDto): Promise<Stylist> { return this.service.updateStylist(u.sub, id, d); }
  @Delete('stylists/:id') deleteStylist(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Stylist> { return this.service.deleteStylist(u.sub, id); }

  // Chairs
  @Get('chairs') listChairs(@CurrentUser() u: AuthenticatedUser): Promise<SalonChair[]> { return this.service.listChairs(u.sub); }
  @Post('chairs') createChair(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateChairDto): Promise<SalonChair> { return this.service.createChair(u.sub, d); }
  @Patch('chairs/:id') updateChair(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateChairDto): Promise<SalonChair> { return this.service.updateChair(u.sub, id, d); }
  @Delete('chairs/:id') deleteChair(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<SalonChair> { return this.service.deleteChair(u.sub, id); }

  // Appointments
  @Get('appointments') listAppointments(@CurrentUser() u: AuthenticatedUser): Promise<SalonAppointment[]> { return this.service.listAppointments(u.sub); }
  @Post('appointments') createAppointment(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateSalonAppointmentDto): Promise<SalonAppointment> { return this.service.createAppointment(u.sub, d); }
  @Patch('appointments/:id') updateAppointment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateSalonAppointmentDto): Promise<SalonAppointment> { return this.service.updateAppointment(u.sub, id, d); }
  @Delete('appointments/:id') deleteAppointment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<SalonAppointment> { return this.service.deleteAppointment(u.sub, id); }
}
