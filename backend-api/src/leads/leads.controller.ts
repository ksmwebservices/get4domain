import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lead } from '@prisma/client';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
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
