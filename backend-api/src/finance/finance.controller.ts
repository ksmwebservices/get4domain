import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceCase, FinanceCaseDocument } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { FinanceService, FinanceSummary } from './finance.service';
import {
  CreateCaseDto, UpdateCaseDto,
  CreateCaseDocumentDto, UpdateCaseDocumentDto,
} from './dto/finance.dto';

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('summary') @ApiOperation({ summary: 'Finance summary (open cases, fees, deadlines, docs)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<FinanceSummary> { return this.service.summary(u.sub); }

  @Get('cases') listCases(@CurrentUser() u: AuthenticatedUser): Promise<FinanceCase[]> { return this.service.listCases(u.sub); }
  @Get('cases/:id') getCase(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<FinanceCase> { return this.service.getCase(u.sub, id); }
  @Post('cases') createCase(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateCaseDto): Promise<FinanceCase> { return this.service.createCase(u.sub, d); }
  @Patch('cases/:id') updateCase(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateCaseDto): Promise<FinanceCase> { return this.service.updateCase(u.sub, id, d); }
  @Delete('cases/:id') deleteCase(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<FinanceCase> { return this.service.deleteCase(u.sub, id); }

  @Get('documents') listDocuments(@CurrentUser() u: AuthenticatedUser): Promise<FinanceCaseDocument[]> { return this.service.listDocuments(u.sub); }
  @Post('cases/:id/documents') addDocument(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: CreateCaseDocumentDto): Promise<FinanceCaseDocument> { return this.service.addDocument(u.sub, id, d); }
  @Patch('documents/:id') updateDocument(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateCaseDocumentDto): Promise<FinanceCaseDocument> { return this.service.updateDocument(u.sub, id, d); }
  @Delete('documents/:id') deleteDocument(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<FinanceCaseDocument> { return this.service.deleteDocument(u.sub, id); }
}
