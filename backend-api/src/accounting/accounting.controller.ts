import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Expense } from '@prisma/client';
import { AccountingService, AccountingSummary } from './accounting.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
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
}
