import { Body, Controller, ForbiddenException, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { WhatsappGatewayService } from './whatsapp-gateway.service';

/** Webhook of the common Get4Domain WhatsApp number: delivery status only. Inbound customer messages are dropped (no chat relay). */
@ApiTags('whatsapp-common')
@Public()
@Controller('messaging/whatsapp')
export class WhatsappWebhookController {
  constructor(private readonly gateway: WhatsappGatewayService) {}

  @Get('webhook')
  @ApiOperation({ summary: 'Provider subscription handshake for the common WhatsApp number' })
  handshake(@Query() query: Record<string, string | undefined>, @Res() res: Response): void {
    const challenge = this.gateway.getProvider().verifyHandshake(query);
    if (challenge === null) throw new ForbiddenException('The verification token does not match.');
    res.status(200).send(challenge);
  }

  @Post('webhook')
  @Throttle(RATE.whatsappWebhook)
  @ApiOperation({ summary: 'Delivery status from the common WhatsApp number (signature checked; inbound messages are dropped)' })
  async receive(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-hub-signature-256') signature: string | undefined, @Body() body: unknown): Promise<{ received: boolean }> {
    const r = await this.gateway.handleWebhook(req.rawBody ?? JSON.stringify(body ?? {}), signature, body);
    if (!r.ok) throw new ForbiddenException('The signature does not match.');
    return { received: true };
  }
}
