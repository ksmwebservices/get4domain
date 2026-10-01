import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lead, ManagedServiceCatalogItem } from '@prisma/client';
import { ManagedServicesService } from './managed-services.service';
import { CreateManagedServicesEnquiryDto } from './dto/create-enquiry.dto';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog-item.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('managed-services')
@Controller('managed-services')
export class ManagedServicesController {
  constructor(private readonly service: ManagedServicesService) {}

  @Public()
  @Post('enquiry')
  @ApiOperation({ summary: 'Public "Get a Custom Quote" enquiry from the Managed Services page' })
  createEnquiry(@Body() dto: CreateManagedServicesEnquiryDto) {
    return this.service.createEnquiry(dto);
  }
}

@ApiTags('managed-services')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/managed-services')
export class AdminManagedServicesController {
  constructor(private readonly service: ManagedServicesService) {}

  @Get('leads')
  @ApiOperation({ summary: 'List Managed Services leads (admin only)' })
  listLeads(): Promise<Lead[]> {
    return this.service.listLeads();
  }

  @Get('catalog')
  @ApiOperation({ summary: "List the editable rate catalog (admin only; ?all=1 includes inactive)" })
  getCatalog(@Query('all') all?: string): Promise<ManagedServiceCatalogItem[]> {
    return this.service.getCatalog(all === '1');
  }

  @Post('catalog')
  @ApiOperation({ summary: 'Add a catalog line item (admin only)' })
  createCatalogItem(@Body() dto: CreateCatalogItemDto): Promise<ManagedServiceCatalogItem> {
    return this.service.createCatalogItem(dto);
  }

  @Put('catalog/:id')
  @ApiOperation({ summary: 'Edit a catalog line item / its default rate (admin only)' })
  updateCatalogItem(@Param('id') id: string, @Body() dto: UpdateCatalogItemDto): Promise<ManagedServiceCatalogItem> {
    return this.service.updateCatalogItem(id, dto);
  }
}
