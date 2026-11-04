import { Controller, Headers, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { PaymentSettlementService } from '../settlement.service';

/**
 * The payment provider's webhook. Public, so its ONLY protection is the signature over the RAW body: a wrong or missing signature is a 401 and nothing is processed. A valid event is
 * stored (redacted) once by its event id; a repeat is a 200 and changes nothing. Rate limited per IP.
 */
@ApiTags('v3-payments-webhook')
@Controller('v3/payments/razorpay')
export class PaymentsWebhookController {
  constructor(private readonly settlement: PaymentSettlementService) {}

  @Public() @Throttle(RATE.webhook)
  @Post('webhook') @HttpCode(200)
  @ApiOperation({ summary: 'Razorpay webhook (raw body signature verified, replay safe by event id, duplicates answer 200)' })
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Res({ passthrough: true }) res: Response, @Headers('x-razorpay-signature') signature?: string, @Headers('x-razorpay-event-id') eventId?: string) {
    const r = await this.settlement.handleWebhook(req.rawBody, signature, eventId);
    if (r.status === 'BAD_SIGNATURE') { res.status(401); return { received: false }; }
    return r.status === 'IGNORED' ? { received: true, ignored: true } : { received: true, ...(r.duplicate ? { duplicate: true } : {}) };
  }
}
