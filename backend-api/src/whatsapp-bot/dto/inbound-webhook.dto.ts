import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Fast2SMS WhatsApp inbound webhook payload (incoming_message event).
 * Fields are validated loosely — it's an external provider payload; the receiver
 * defends by verifying the webhook_secret_key header and ignoring non-text events.
 */
export class InboundWebhookDto {
  @ApiProperty({ required: false, example: 'incoming_message' })
  @IsOptional()
  @IsString()
  webhook_type?: string;

  @ApiProperty({ required: false, example: '919999999999', description: "Sender's phone" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ required: false, example: 'text' })
  @IsOptional()
  @IsString()
  message_type?: string;

  @ApiProperty({ required: false, example: 'What is the price?', description: 'Message text' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiProperty({ required: false, example: 'wamid.HBg...' })
  @IsOptional()
  @IsString()
  message_id?: string;

  @ApiProperty({ required: false, example: '1122334455', description: "Vendor's WA number id" })
  @IsOptional()
  @IsString()
  phone_number_id?: string;
}
