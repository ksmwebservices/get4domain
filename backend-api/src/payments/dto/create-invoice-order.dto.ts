import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** Body for POST /payments/create-order: which of the caller's invoices to pay. The amount is server-side. */
export class CreateInvoiceOrderDto {
  @ApiProperty({ example: 'clxinvoice1234567890' })
  @IsString()
  @MaxLength(60)
  invoiceId!: string;
}
