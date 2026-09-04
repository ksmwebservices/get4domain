import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lead } from '@prisma/client';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { VerifyDemoLeadDto } from './dto/verify-demo-lead.dto';
import { DemoVisitDto, DemoVisitResult } from './dto/demo-visit.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Save a demo booking lead from the public Book a Demo form' })
  create(@Body() dto: CreateLeadDto): Promise<Lead> {
    return this.leadsService.create(dto);
  }

  @Public()
  @Post('demo')
  @ApiOperation({ summary: 'Book-Demo Phase 1 — verify OTP, create a verified lead, provision a sandbox (Phase 4)' })
  verifyDemo(@Body() dto: VerifyDemoLeadDto) {
    return this.leadsService.verifyDemoLead(dto);
  }

  @Public()
  @Post('demo/visit')
  @ApiOperation({ summary: 'Record a demo view on the OTP-gate lead; enforce category scope + 3-visit cap' })
  demoVisit(@Body() dto: DemoVisitDto): Promise<DemoVisitResult> {
    return this.leadsService.recordDemoVisit(dto.phone, dto.category, dto.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get()
  @ApiOperation({ summary: 'List all demo booking leads (admin only)' })
  findAll(): Promise<Lead[]> {
    return this.leadsService.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Put(':id/status')
  @ApiOperation({ summary: 'Update a lead status: pending, called, or converted (admin only)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto): Promise<Lead> {
    return this.leadsService.updateStatus(id, dto.status);
  }
}
