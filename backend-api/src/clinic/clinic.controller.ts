import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Doctor, ClinicAppointment } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ClinicService, ClinicSummary } from './clinic.service';
import {
  CreateDoctorDto, UpdateDoctorDto,
  CreateAppointmentDto, UpdateAppointmentDto,
} from './dto/clinic.dto';

@ApiTags('clinic')
@ApiBearerAuth()
@Controller('clinic')
export class ClinicController {
  constructor(private readonly service: ClinicService) {}

  @Get('summary') @ApiOperation({ summary: 'Clinic summary (today, upcoming, revenue, by doctor)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<ClinicSummary> { return this.service.summary(u.sub); }

  @Get('doctors') listDoctors(@CurrentUser() u: AuthenticatedUser): Promise<Doctor[]> { return this.service.listDoctors(u.sub); }
  @Post('doctors') createDoctor(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateDoctorDto): Promise<Doctor> { return this.service.createDoctor(u.sub, d); }
  @Patch('doctors/:id') updateDoctor(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateDoctorDto): Promise<Doctor> { return this.service.updateDoctor(u.sub, id, d); }
  @Delete('doctors/:id') deleteDoctor(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Doctor> { return this.service.deleteDoctor(u.sub, id); }

  @Get('appointments') listAppointments(@CurrentUser() u: AuthenticatedUser): Promise<ClinicAppointment[]> { return this.service.listAppointments(u.sub); }
  @Post('appointments') createAppointment(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateAppointmentDto): Promise<ClinicAppointment> { return this.service.createAppointment(u.sub, d); }
  @Patch('appointments/:id') updateAppointment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateAppointmentDto): Promise<ClinicAppointment> { return this.service.updateAppointment(u.sub, id, d); }
  @Delete('appointments/:id') deleteAppointment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ClinicAppointment> { return this.service.deleteAppointment(u.sub, id); }
}
