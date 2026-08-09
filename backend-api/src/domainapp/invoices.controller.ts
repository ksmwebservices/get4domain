import { Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { DomainAppInvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/invoice.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('domainapp-invoices')
@ApiBearerAuth()
@Controller('domainapp/invoices')
export class DomainAppInvoicesController {
  constructor(private readonly invoicesService: DomainAppInvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices for the current vendor (?status=&search=&page=&limit=)' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListQueryDto) {
    return this.invoicesService.findAll(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a GST-compliant invoice' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single invoice' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.findOne(user.sub, id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Get a printable HTML invoice (browser print-to-PDF)' })
  async pdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.invoicesService.renderPdfHtml(user.sub, id);
    res.type('html').send(html);
  }

  @Post(':id/send-link')
  @ApiOperation({ summary: 'Create a Razorpay payment link for the invoice' })
  sendLink(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.sendLink(user.sub, id);
  }

  @Put(':id/mark-paid')
  @ApiOperation({ summary: 'Mark an invoice as paid' })
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.markPaid(user.sub, id);
  }
}
