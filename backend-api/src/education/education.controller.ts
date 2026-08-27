import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Batch, StudentEnrollment } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EducationService, EducationSummary } from './education.service';
import { CreateBatchDto, UpdateBatchDto, CreateEnrollmentDto, UpdateEnrollmentDto } from './dto/education.dto';

@ApiTags('education')
@ApiBearerAuth()
@Controller('education')
export class EducationController {
  constructor(private readonly service: EducationService) {}

  @Get('summary') @ApiOperation({ summary: 'Education summary (active students, fees collected/pending)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<EducationSummary> { return this.service.summary(u.sub); }

  @Get('batches') listBatches(@CurrentUser() u: AuthenticatedUser): Promise<Batch[]> { return this.service.listBatches(u.sub); }
  @Post('batches') createBatch(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateBatchDto): Promise<Batch> { return this.service.createBatch(u.sub, d); }
  @Patch('batches/:id') updateBatch(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateBatchDto): Promise<Batch> { return this.service.updateBatch(u.sub, id, d); }
  @Delete('batches/:id') deleteBatch(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Batch> { return this.service.deleteBatch(u.sub, id); }

  @Get('enrollments') listEnrollments(@CurrentUser() u: AuthenticatedUser): Promise<StudentEnrollment[]> { return this.service.listEnrollments(u.sub); }
  @Post('enrollments') createEnrollment(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateEnrollmentDto): Promise<StudentEnrollment> { return this.service.createEnrollment(u.sub, d); }
  @Patch('enrollments/:id') updateEnrollment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateEnrollmentDto): Promise<StudentEnrollment> { return this.service.updateEnrollment(u.sub, id, d); }
  @Delete('enrollments/:id') deleteEnrollment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<StudentEnrollment> { return this.service.deleteEnrollment(u.sub, id); }
}
