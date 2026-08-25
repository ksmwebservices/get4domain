import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, UnauthorizedException, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { KnowledgeBaseService } from './knowledge-base.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { CreateKbEntryDto, UpdateKbEntryDto } from './dto/kb-entry.dto';
import { InboundWebhookDto } from './dto/inbound-webhook.dto';

@ApiTags('whatsapp-bot')
@Controller('whatsapp-bot')
export class WhatsappBotController {
  private readonly logger = new Logger(WhatsappBotController.name);

  constructor(
    private readonly kb: KnowledgeBaseService,
    private readonly bot: WhatsappBotService,
    private readonly whatsapp: WhatsappService,
  ) {}

  // ── Section A: vendor-managed knowledge base CRUD (JWT-guarded) ──────────────

  @Get('kb')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current vendor's WhatsApp-bot knowledge base" })
  listKb(@CurrentUser() user: AuthenticatedUser) {
    return this.kb.list(user.sub);
  }

  @Post('kb')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a knowledge-base Q&A entry' })
  createKb(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateKbEntryDto) {
    return this.kb.create(user.sub, dto);
  }

  @Patch('kb/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a knowledge-base entry' })
  updateKb(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateKbEntryDto) {
    return this.kb.update(id, user.sub, dto);
  }

  @Delete('kb/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a knowledge-base entry' })
  removeKb(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.kb.remove(id, user.sub);
  }

  // ── Section B: public inbound webhook (Fast2SMS incoming_message) ────────────

  @Public()
  @Post('webhook')
  @HttpCode(200)
  // Relax the global forbidNonWhitelisted pipe here: an external provider payload
  // may carry extra fields — strip them rather than 400 (which would trigger retries).
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }))
  @ApiOperation({ summary: 'Fast2SMS WhatsApp inbound webhook (verifies webhook_secret_key header)' })
  async webhook(@Body() dto: InboundWebhookDto, @Headers('webhook_secret_key') secretHeader?: string) {
    // Security: when a webhook secret is configured (Admin → Integrations), the
    // header MUST match. Constant-time compare to avoid timing leaks. If no secret
    // is configured yet (mock/dev, pre-go-live) the endpoint stays open for testing.
    const expected = await this.whatsapp.getWebhookSecret();
    if (expected) {
      if (!secretHeader || !this.safeEqual(secretHeader, expected)) {
        this.logger.warn('Rejected WhatsApp webhook: missing/invalid webhook_secret_key');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // Only act on inbound text messages; ack everything else so the provider stops retrying.
    if (dto.webhook_type && dto.webhook_type !== 'incoming_message') return { ok: true, ignored: dto.webhook_type };
    if (dto.message_type && dto.message_type !== 'text') return { ok: true, ignored: `type:${dto.message_type}` };

    const result = await this.bot.handleInbound({
      from: dto.from,
      body: dto.body,
      phoneNumberId: dto.phone_number_id,
      messageId: dto.message_id,
    });
    return { ok: true, ...result };
  }

  private safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
}
