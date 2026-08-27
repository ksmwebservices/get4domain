import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceJob, JobLine, PartStock } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AutomobileService, AutomobileSummary } from './automobile.service';
import {
  CreateJobDto, UpdateJobDto,
  CreateLineDto, UpdateLineDto,
  CreatePartDto, UpdatePartDto,
} from './dto/automobile.dto';

@ApiTags('automobile')
@ApiBearerAuth()
@Controller('automobile')
export class AutomobileController {
  constructor(private readonly service: AutomobileService) {}

  @Get('summary') @ApiOperation({ summary: 'Automobile summary (active jobs, revenue, low stock)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<AutomobileSummary> { return this.service.summary(u.sub); }

  @Get('jobs') listJobs(@CurrentUser() u: AuthenticatedUser): Promise<ServiceJob[]> { return this.service.listJobs(u.sub); }
  @Get('jobs/:id') getJob(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ServiceJob> { return this.service.getJob(u.sub, id); }
  @Post('jobs') createJob(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateJobDto): Promise<ServiceJob> { return this.service.createJob(u.sub, d); }
  @Patch('jobs/:id') updateJob(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateJobDto): Promise<ServiceJob> { return this.service.updateJob(u.sub, id, d); }
  @Delete('jobs/:id') deleteJob(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ServiceJob> { return this.service.deleteJob(u.sub, id); }

  @Post('jobs/:id/lines') addLine(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: CreateLineDto): Promise<JobLine> { return this.service.addLine(u.sub, id, d); }
  @Patch('lines/:id') updateLine(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateLineDto): Promise<JobLine> { return this.service.updateLine(u.sub, id, d); }
  @Delete('lines/:id') deleteLine(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<JobLine> { return this.service.deleteLine(u.sub, id); }

  @Get('parts') listParts(@CurrentUser() u: AuthenticatedUser): Promise<PartStock[]> { return this.service.listParts(u.sub); }
  @Post('parts') createPart(@CurrentUser() u: AuthenticatedUser, @Body() d: CreatePartDto): Promise<PartStock> { return this.service.createPart(u.sub, d); }
  @Patch('parts/:id') updatePart(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdatePartDto): Promise<PartStock> { return this.service.updatePart(u.sub, id, d); }
  @Delete('parts/:id') deletePart(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<PartStock> { return this.service.deletePart(u.sub, id); }
}
