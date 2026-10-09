import { BadRequestException, Body, Controller, Get, Headers, Post, Put, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { RATE } from '../common/throttling';
import { CommercialAdminGuard } from '../commercial/foundation.services';
import { PaymentsService } from '../payments/payments.service';
import { ReconcileDto, RefillOrderDto, SavePackDto, VerifyRefillDto } from './leadspace.dto';
import { LeadRefillService } from './refill.service';

/** Vendor: buy credit for the LeadSpace wallet and see the tax invoices. Payment goes to Get4Domain's Razorpay. */
@ApiTags('leadspace')
@ApiBearerAuth()
@RequireModule('wallet')
@Controller('leadspace/wallet')
export class LeadspaceRefillController {
  constructor(private readonly refill: LeadRefillService) {}

  @Get('packs')
  @ApiOperation({ summary: 'Refill packs with the exact amount you will pay (GST included or added, as set) and the custom amount limits' })
  async packs() { return { packs: await this.refill.packs(), custom: await this.refill.customLimits() }; }

  @Post('refill')
  @Throttle(RATE.payment)
  @ApiOperation({ summary: 'Start a refill: returns a Razorpay order for a pack or a custom amount' })
  order(@CurrentUser() u: AuthenticatedUser, @Body() dto: RefillOrderDto) {
    if (!dto.packId && !dto.customPaise) throw new BadRequestException('Choose a pack or enter an amount.');
    return this.refill.createOrder(u.sub, dto);
  }

  @Post('refill/verify')
  @Throttle(RATE.payment)
  @ApiOperation({ summary: 'Confirm the payment with Razorpay, credit the wallet once, issue the tax invoice and release waiting customers' })
  verify(@CurrentUser() u: AuthenticatedUser, @Body() dto: VerifyRefillDto) { return this.refill.verify(u.sub, dto); }

  @Get('receipts')
  @ApiOperation({ summary: 'Every refill with its GST tax invoice' })
  receipts(@CurrentUser() u: AuthenticatedUser) { return this.refill.receipts(u.sub); }
}

/** Razorpay tells us a payment was captured even if the vendor closed the browser before the confirm call. Same credit rules, same idempotency. */
@ApiTags('leadspace-public')
@Public()
@Controller('leadspace/refill')
export class LeadspaceRefillWebhookController {
  constructor(private readonly refill: LeadRefillService, private readonly payments: PaymentsService) {}

  @Post('webhook')
  @Throttle(RATE.webhook)
  @ApiOperation({ summary: 'Razorpay webhook for LeadSpace refills (payment.captured). Signature checked.' })
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string, @Body() body: { event?: string; payload?: { payment?: { entity?: { id?: string } } } }) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});
    if (!this.payments.verifyWebhookSignature(raw, signature)) throw new BadRequestException('Invalid webhook signature');
    const id = body?.event === 'payment.captured' ? body.payload?.payment?.entity?.id : undefined;
    if (id) await this.refill.reconcile(id);
    return { received: true };
  }
}

/** Admin: refill packs and a way to credit a payment that was captured but never confirmed. */
@ApiTags('admin-leadspace')
@ApiBearerAuth()
@UseGuards(CommercialAdminGuard)
@Controller('admin/leadspace')
export class LeadspaceRefillAdminController {
  constructor(private readonly refill: LeadRefillService) {}

  @Get('packs')
  @ApiOperation({ summary: 'All refill packs, active or not, with the amount a customer would pay' })
  packs() { return this.refill.packs(false); }

  @Put('packs')
  @ApiOperation({ summary: 'Create or change a refill pack (price, credited amount, GST included or added)' })
  save(@Body() dto: SavePackDto) { return this.refill.savePack(dto); }

  @Get('refills')
  @ApiOperation({ summary: 'Recent refills across all vendors' })
  refills() { return this.refill.adminRefills(); }

  @Post('refills/reconcile')
  @ApiOperation({ summary: 'Credit a payment that Razorpay captured but the vendor never confirmed (idempotent)' })
  reconcile(@Body() dto: ReconcileDto) { return this.refill.reconcile(dto.razorpayPaymentId); }
}
