import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsPositive, IsString } from 'class-validator';

/**
 * INTERNAL order input for PaymentsService.createOrder — every caller derives `amount` on the
 * server (invoice total / plan price / theme price). It is not accepted from HTTP clients;
 * the public endpoint takes CreateInvoiceOrderDto (an invoice id only).
 */
export class CreateOrderDto {
  @ApiProperty({ example: 2949882, description: 'Amount in paise (includes GST)' })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ required: false, default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'INV-2026-0001' })
  @IsString()
  receipt!: string;

  @ApiProperty({ required: false, description: 'Stamped on the Razorpay order so verification can bind a payment to its purpose' })
  @IsOptional()
  @IsObject()
  notes?: Record<string, string>;
}
