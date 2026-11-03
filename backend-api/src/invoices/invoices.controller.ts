import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Invoice } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { assertOwnerOrStaff } from '../auth/guards/staff-access';
import { RouteKey } from '../common/decorators/route-key.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

function assertOwnerOrAdmin(user: AuthenticatedUser, vendorId: string, route: string): void {
  assertOwnerOrStaff(user, vendorId, route, 'You may only access your own invoices');
}

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @UseGuards(AdminGuard)
  @Post()
  @ApiOperation({ summary: 'Create an invoice (admin only)' })
  create(@Body() dto: CreateInvoiceDto): Promise<Invoice> {
    return this.invoicesService.createInvoice(dto);
  }

  @UseGuards(AdminGuard)
  @Get()
  @ApiOperation({ summary: 'List all invoices (admin only)' })
  findAll(): Promise<Invoice[]> {
    return this.invoicesService.findAll();
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'List invoices for a vendor (vendor sees own, admin sees any)' })
  findByVendor(@Param('vendorId') vendorId: string, @CurrentUser() user: AuthenticatedUser, @RouteKey() route: string): Promise<Invoice[]> {
    assertOwnerOrAdmin(user, vendorId, route);
    return this.invoicesService.findByVendor(vendorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single invoice (vendor sees own, admin sees any)' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @RouteKey() route: string) {
    const invoice = await this.invoicesService.findOne(id);
    assertOwnerOrAdmin(user, invoice.vendorId, route);
    return invoice;
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Get invoice as printable HTML (vendor sees own, admin sees any)' })
  async getPdf(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @RouteKey() route: string) {
    const invoice = await this.invoicesService.findOne(id);
    assertOwnerOrAdmin(user, invoice.vendorId, route);
    const html = await this.invoicesService.generatePDF(id);
    return { html };
  }

  @Post(':id/email')
  @ApiOperation({ summary: 'Email this invoice PDF to the vendor (vendor sends own, admin any)' })
  async email(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @RouteKey() route: string) {
    const invoice = await this.invoicesService.findOne(id);
    assertOwnerOrAdmin(user, invoice.vendorId, route);
    return this.invoicesService.sendInvoiceEmail(id);
  }

  @UseGuards(AdminGuard)
  @Post(':id/send-payment-link')
  @ApiOperation({ summary: 'Generate and email a Razorpay payment link for this invoice (admin only)' })
  sendPaymentLink(@Param('id') id: string): Promise<{ shortUrl: string }> {
    return this.invoicesService.sendPaymentLink(id);
  }

  @UseGuards(AdminGuard)
  @Post(':id/mark-paid')
  @ApiOperation({ summary: 'Manually mark an invoice as paid (admin only)' })
  markAsPaid(@Param('id') id: string, @Body('paymentId') paymentId: string): Promise<Invoice> {
    return this.invoicesService.markAsPaid(id, paymentId);
  }
}
