import {
  Body,
  Controller,
  ForbiddenException,
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
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

function assertOwnerOrAdmin(user: AuthenticatedUser, vendorId: string): void {
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  if (!isAdmin && user.sub !== vendorId) {
    throw new ForbiddenException('You may only access your own invoices');
  }
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
  findByVendor(@Param('vendorId') vendorId: string, @CurrentUser() user: AuthenticatedUser): Promise<Invoice[]> {
    assertOwnerOrAdmin(user, vendorId);
    return this.invoicesService.findByVendor(vendorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single invoice (vendor sees own, admin sees any)' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const invoice = await this.invoicesService.findOne(id);
    assertOwnerOrAdmin(user, invoice.vendorId);
    return invoice;
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Get invoice as printable HTML (vendor sees own, admin sees any)' })
  async getPdf(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const invoice = await this.invoicesService.findOne(id);
    assertOwnerOrAdmin(user, invoice.vendorId);
    const html = await this.invoicesService.generatePDF(id);
    return { html };
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
