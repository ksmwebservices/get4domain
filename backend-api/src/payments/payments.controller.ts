import { BadRequestException, Body, Controller, Headers, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateInvoiceOrderDto } from './dto/create-invoice-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { RATE } from '../common/throttling';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @Throttle(RATE.payment)
  @Post('create-order')
  @ApiOperation({ summary: 'Create a Razorpay order to pay one of your own invoices (amount is taken from the invoice, never from the request)' })
  createOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceOrderDto) {
    return this.paymentsService.createInvoiceOrder(user, dto.invoiceId);
  }

  @ApiBearerAuth()
  @Throttle(RATE.payment)
  @Post('verify')
  @ApiOperation({ summary: 'Confirm a Razorpay payment with Razorpay itself (amount, invoice, vendor, captured) and mark the invoice paid' })
  verifyPayment(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(user, dto);
  }

  @Public()
  @Throttle(RATE.webhook)
  @Post('webhook')
  @ApiOperation({ summary: 'Razorpay webhook receiver (payment_link.paid, payment.captured)' })
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    const isValid = this.paymentsService.verifyWebhookSignature(req.rawBody.toString('utf8'), signature);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.paymentsService.handleWebhookEvent(req.body);
    return { received: true };
  }
}
