import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { PublicRequestsService } from '../public-requests.service';
import { VendorWebhookService } from '../vendor-webhook.service';
import { ReportDto, SubmitOrderDto, SubmitRequestDto } from './dto/requests.dto';

/**
 * The public side of the bridge. Every route answers ONE plain 404 for anything that must reveal nothing (unknown host, Free or seeded site, suspended or removed business), is rate limited per
 * IP, idempotent where it creates something, and sets no cookie. The customer's request goes to the vendor; Get4Domain never receives or holds the customer's money.
 */
@ApiTags('v3-requests-public')
@Controller('v3/public')
export class PublicRequestsController {
  constructor(private readonly requests: PublicRequestsService) {}

  @Public() @Throttle(RATE.requestSubmit)
  @Post('sites/:host/requests') @HttpCode(200)
  @ApiOperation({ summary: 'Send an enquiry, appointment, quote or product enquiry to a Pro site\'s business (idempotent by key; consent for the current text is required)' })
  async submit(@Param('host') host: string, @Body() dto: SubmitRequestDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'no-store');
    return this.requests.submit(host, dto as never, req.ip ?? null);
  }

  @Public() @Throttle(RATE.requestSubmit)
  @Post('sites/:host/orders') @HttpCode(200)
  @ApiOperation({ summary: 'Turn a cart into an order request or an order; the answer says which payment step applies (the vendor\'s own gateway, cash on delivery, at the visit, or as the business arranges)' })
  async order(@Param('host') host: string, @Body() dto: SubmitOrderDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'no-store');
    return this.requests.order(host, dto as never, req.ip ?? null);
  }

  @Public() @Throttle(RATE.claimStatus)
  @Get('requests/track/:token')
  @ApiOperation({ summary: 'The status of a request and the business replies; a wrong, malformed or expired token is one plain 404' })
  async track(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'no-store');
    return this.requests.track(String(token).slice(0, 100));
  }

  @Public() @Throttle(RATE.reportSubmit)
  @Post('reports') @HttpCode(202)
  @ApiOperation({ summary: 'Report a business site. The answer is always the same.' })
  report(@Body() dto: ReportDto) { return this.requests.report(dto); }
}

/** Events from a vendor's OWN payment gateway. Public: its ONLY protection is the signature over the RAW body with that vendor's webhook secret. */
@ApiTags('v3-requests-webhook')
@Controller('v3/payments/vendor')
export class VendorWebhookController {
  constructor(private readonly webhook: VendorWebhookService) {}

  @Public() @Throttle(RATE.webhook)
  @Post(':vendorId/:methodId') @HttpCode(200)
  @ApiOperation({ summary: 'Payment event from the vendor\'s own gateway (raw body signature, replay safe by event id, duplicates answer 200, a mismatching amount never marks the order paid)' })
  async handle(@Param('vendorId') vendorId: string, @Param('methodId') methodId: string, @Req() req: Request & { rawBody?: Buffer }, @Headers('x-g4d-signature') signature?: string) {
    const r = await this.webhook.handle(String(vendorId).slice(0, 64), String(methodId).slice(0, 64), req.rawBody, signature);
    return { received: true, ...(r.status === 'DUPLICATE' ? { duplicate: true } : {}), ...(r.status === 'IGNORED' ? { ignored: true } : {}) };
  }
}
