import { Global, Module } from '@nestjs/common';
import { WhatsappGatewayService } from './whatsapp/whatsapp-gateway.service';
import { WhatsappWebhookController } from './whatsapp/whatsapp-webhook.controller';

/** Shared messaging services (Dispatch A section 6): the WhatsApp provider abstraction and the common-number gateway. */
@Global()
@Module({ controllers: [WhatsappWebhookController], providers: [WhatsappGatewayService], exports: [WhatsappGatewayService] })
export class MessagingModule {}
