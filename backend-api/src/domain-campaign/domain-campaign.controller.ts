import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Invoice, Lead, Subscription } from '@prisma/client';
import { DomainCampaignService, DomainCampaignRecordRow } from './domain-campaign.service';
import { CreateDomainCampaignEnquiryDto } from './dto/create-enquiry.dto';
import { RecordDomainCampaignSpendDto } from './dto/record-spend.dto';
import { AddDomainCampaignClientDto } from './dto/add-client.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('domain-campaign')
@Controller('domain-campaign')
export class DomainCampaignController {
  constructor(private readonly service: DomainCampaignService) {}

  @Public()
  @Post('enquiry')
  @ApiOperation({ summary: 'Public "Get Started" enquiry from the DomainCampaign marketing page' })
  createEnquiry(@Body() dto: CreateDomainCampaignEnquiryDto) {
    return this.service.createEnquiry(dto);
  }

  @ApiBearerAuth()
  @Post('clients/me')
  @ApiOperation({ summary: '"Add DomainCampaign" CTA from an existing vendor\'s dashboard — records an enquiry pre-filled with their own details' })
  async addFromDashboard(@CurrentUser() user: AuthenticatedUser, @Body() dto: Omit<CreateDomainCampaignEnquiryDto, 'vendorId'>) {
    return this.service.createEnquiry({ ...dto, vendorId: user.sub });
  }
}

@ApiTags('domain-campaign')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/domain-campaign')
export class AdminDomainCampaignController {
  constructor(private readonly service: DomainCampaignService) {}

  @Get('leads')
  @ApiOperation({ summary: 'List DomainCampaign leads (admin only)' })
  listLeads(): Promise<Lead[]> {
    return this.service.listLeads();
  }

  @Post('clients')
  @ApiOperation({ summary: 'Onboard a vendor as a DomainCampaign client (admin only)' })
  addClient(@Body() dto: AddDomainCampaignClientDto): Promise<Subscription> {
    return this.service.addClient(dto.vendorId);
  }

  @Get('clients')
  @ApiOperation({ summary: 'List DomainCampaign clients (admin only)' })
  listClients() {
    return this.service.listClients();
  }

  @Get('records')
  @ApiOperation({ summary: 'List every recorded monthly ad-spend/fee record, all clients (admin only)' })
  getAllRecords(): Promise<DomainCampaignRecordRow[]> {
    return this.service.getAllRecords();
  }

  @Post('records')
  @ApiOperation({ summary: 'Record (or update) a client\'s monthly ad spend — fee follows the PRD §88 spend brackets, or the custom amount for Enterprise clients (admin only)' })
  recordSpend(@Body() dto: RecordDomainCampaignSpendDto): Promise<DomainCampaignRecordRow> {
    return this.service.recordSpend(dto);
  }

  @Get('records/vendor/:vendorId')
  @ApiOperation({ summary: 'Billing history for one DomainCampaign client (admin only)' })
  getBillingHistory(@Param('vendorId') vendorId: string): Promise<DomainCampaignRecordRow[]> {
    return this.service.getBillingHistory(vendorId);
  }

  @Post('records/:id/invoice')
  @ApiOperation({ summary: 'Generate the monthly invoice/statement for a recorded spend (admin only)' })
  generateInvoice(@Param('id') id: string): Promise<Invoice> {
    return this.service.generateInvoice(id);
  }
}
