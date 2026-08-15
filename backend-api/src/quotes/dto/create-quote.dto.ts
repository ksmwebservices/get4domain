import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateQuoteDto {
  @ApiPropertyOptional({ description: 'Existing vendor id (omit for a new prospect)' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiProperty()
  @IsString()
  prospectName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prospectPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prospectEmail?: string;

  @ApiProperty({ enum: ['domainapp_plan', 'domaincampaign_wallet', 'custom'] })
  @IsIn(['domainapp_plan', 'domaincampaign_wallet', 'custom'])
  quoteType!: string;

  @ApiProperty({ example: 'DomainApp — monthly' })
  @IsString()
  itemLabel!: string;

  @ApiProperty({ example: 2499900, description: 'Amount in paise' })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: ['email', 'whatsapp', 'sms'] })
  @IsIn(['email', 'whatsapp', 'sms'])
  channel!: string;

  @ApiProperty({ description: 'The quote message body to send' })
  @IsString()
  message!: string;

  @ApiPropertyOptional({ description: 'Email subject (email channel)' })
  @IsOptional()
  @IsString()
  subject?: string;
}
