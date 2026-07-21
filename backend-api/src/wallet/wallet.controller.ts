import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { TopupDto } from './dto/topup.dto';
import { VerifyTopupDto } from './dto/verify-topup.dto';
import { DeductDto } from './dto/deduct.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get the current vendor wallet balance and next credit expiry' })
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getBalance(user.sub);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get paginated wallet transaction history for the current vendor' })
  getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getTransactions(user.sub, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Post('topup')
  @ApiOperation({ summary: 'Create a Razorpay order to top up the wallet' })
  topup(@CurrentUser() user: AuthenticatedUser, @Body() dto: TopupDto) {
    return this.walletService.topup(user.sub, dto);
  }

  @Post('topup/verify')
  @ApiOperation({ summary: 'Verify a wallet top-up payment and credit the wallet with bonus' })
  verifyTopup(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyTopupDto) {
    return this.walletService.verifyTopup(user.sub, dto);
  }

  @UseGuards(AdminGuard)
  @Post('deduct')
  @ApiOperation({ summary: 'Deduct wallet credits for a service usage (admin/internal)' })
  deduct(@Body() dto: DeductDto) {
    return this.walletService.deduct(dto.vendorId, dto.amount, dto.description, dto.service);
  }
}
