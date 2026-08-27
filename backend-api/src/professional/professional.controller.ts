import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Engagement, EngagementDocument } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ProfessionalService, ProfessionalSummary } from './professional.service';
import {
  CreateEngagementDto,
  UpdateEngagementDto,
  CreateDocumentDto,
  UpdateDocumentDto,
} from './dto/professional.dto';

@ApiTags('professional')
@ApiBearerAuth()
@Controller('professional')
export class ProfessionalController {
  constructor(private readonly service: ProfessionalService) {}

  @Get('summary') @ApiOperation({ summary: 'Professional summary (active engagements, value, pending docs)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<ProfessionalSummary> { return this.service.summary(u.sub); }

  @Get('engagements') listEngagements(@CurrentUser() u: AuthenticatedUser): Promise<Engagement[]> { return this.service.listEngagements(u.sub); }
  @Get('engagements/:id') getEngagement(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Engagement> { return this.service.getEngagement(u.sub, id); }
  @Post('engagements') createEngagement(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateEngagementDto): Promise<Engagement> { return this.service.createEngagement(u.sub, d); }
  @Patch('engagements/:id') updateEngagement(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateEngagementDto): Promise<Engagement> { return this.service.updateEngagement(u.sub, id, d); }
  @Delete('engagements/:id') deleteEngagement(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Engagement> { return this.service.deleteEngagement(u.sub, id); }

  @Get('documents') listDocuments(@CurrentUser() u: AuthenticatedUser): Promise<EngagementDocument[]> { return this.service.listDocuments(u.sub); }
  @Post('engagements/:id/documents') addDocument(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: CreateDocumentDto): Promise<EngagementDocument> { return this.service.addDocument(u.sub, id, d); }
  @Patch('documents/:id') updateDocument(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateDocumentDto): Promise<EngagementDocument> { return this.service.updateDocument(u.sub, id, d); }
  @Delete('documents/:id') deleteDocument(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<EngagementDocument> { return this.service.deleteDocument(u.sub, id); }
}
