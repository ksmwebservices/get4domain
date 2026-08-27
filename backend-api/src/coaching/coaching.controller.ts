import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoachingBatch, CoachingEnrollment, CoachingSession } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CoachingService, CoachingSummary } from './coaching.service';
import {
  CreateBatchDto, UpdateBatchDto,
  CreateEnrollmentDto, UpdateEnrollmentDto,
  CreateSessionDto, UpdateSessionDto,
} from './dto/coaching.dto';

@ApiTags('coaching')
@ApiBearerAuth()
@Controller('coaching')
export class CoachingController {
  constructor(private readonly service: CoachingService) {}

  @Get('summary') @ApiOperation({ summary: 'Coaching summary (students, fees, sessions this week)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<CoachingSummary> { return this.service.summary(u.sub); }

  @Get('batches') listBatches(@CurrentUser() u: AuthenticatedUser): Promise<CoachingBatch[]> { return this.service.listBatches(u.sub); }
  @Get('batches/:id') getBatch(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<CoachingBatch> { return this.service.getBatch(u.sub, id); }
  @Post('batches') createBatch(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateBatchDto): Promise<CoachingBatch> { return this.service.createBatch(u.sub, d); }
  @Patch('batches/:id') updateBatch(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateBatchDto): Promise<CoachingBatch> { return this.service.updateBatch(u.sub, id, d); }
  @Delete('batches/:id') deleteBatch(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<CoachingBatch> { return this.service.deleteBatch(u.sub, id); }

  @Post('batches/:id/sessions') addSession(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: CreateSessionDto): Promise<CoachingSession> { return this.service.addSession(u.sub, id, d); }
  @Patch('sessions/:id') updateSession(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateSessionDto): Promise<CoachingSession> { return this.service.updateSession(u.sub, id, d); }
  @Delete('sessions/:id') deleteSession(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<CoachingSession> { return this.service.deleteSession(u.sub, id); }

  @Get('enrollments') listEnrollments(@CurrentUser() u: AuthenticatedUser): Promise<CoachingEnrollment[]> { return this.service.listEnrollments(u.sub); }
  @Post('enrollments') createEnrollment(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateEnrollmentDto): Promise<CoachingEnrollment> { return this.service.createEnrollment(u.sub, d); }
  @Patch('enrollments/:id') updateEnrollment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateEnrollmentDto): Promise<CoachingEnrollment> { return this.service.updateEnrollment(u.sub, id, d); }
  @Delete('enrollments/:id') deleteEnrollment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<CoachingEnrollment> { return this.service.deleteEnrollment(u.sub, id); }
}
