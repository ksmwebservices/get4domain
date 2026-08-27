import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Expense, PaymentRecord, GstFiling } from '@prisma/client';
import { AccountingService, AccountingSummary } from './accounting.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpsertGstFilingDto } from './dto/upsert-gst-filing.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('accounting')
@ApiBearerAuth()
@RequireModule('accounts')
@Controller('accounting')
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  @Get('expenses')
  @ApiOperation({ summary: "List the caller's expenses (vendorId-scoped); ?from=&to=" })
  list(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string): Promise<Expense[]> {
    return this.service.listExpenses(user.sub, from, to);
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Log an expense (GST exclusive)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseDto): Promise<Expense> {
    return this.service.createExpense(user.sub, dto);
  }

  @Delete('expenses/:id')
  @ApiOperation({ summary: 'Delete one of your expenses' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Expense> {
    return this.service.deleteExpense(user.sub, id);
  }

  @Get('expenses/:id/voucher')
  @ApiOperation({ summary: 'Branded expense-voucher HTML (client prints to PDF)' })
  async voucher(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<{ html: string }> {
    return { html: await this.service.renderExpenseHtml(user.sub, id) };
  }

  @Get('summary')
  @ApiOperation({ summary: 'P&L + GST statement for a period (vendorId-scoped)' })
  summary(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string): Promise<AccountingSummary> {
    return this.service.summary(user.sub, from, to);
  }

  // ── Phase 5: Payments ledger ────────────────────────────────────────────
  @Get('payments')
  @ApiOperation({ summary: "List the caller's payment records (vendorId-scoped); ?from=&to=" })
  listPayments(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string): Promise<PaymentRecord[]> {
    return this.service.listPayments(user.sub, from, to);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record an inward/outward payment' })
  createPayment(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePaymentDto): Promise<PaymentRecord> {
    return this.service.createPayment(user.sub, dto);
  }

  @Delete('payments/:id')
  @ApiOperation({ summary: 'Delete one of your payment records' })
  deletePayment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<PaymentRecord> {
    return this.service.deletePayment(user.sub, id);
  }

  // ── Phase 5: GST filing status ──────────────────────────────────────────
  @Get('gst-filings')
  @ApiOperation({ summary: "List the caller's GST filing statuses (vendorId-scoped)" })
  listGstFilings(@CurrentUser() user: AuthenticatedUser): Promise<GstFiling[]> {
    return this.service.listGstFilings(user.sub);
  }

  @Post('gst-filings')
  @ApiOperation({ summary: 'Create/update a GST filing status (idempotent per period+form)' })
  upsertGstFiling(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertGstFilingDto): Promise<GstFiling> {
    return this.service.upsertGstFiling(user.sub, dto);
  }
}
