import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEmail, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BillOrderDto } from '../restaurant/dto/restaurant.dto';

/**
 * Input for the `restaurant.bill_order` action.
 *
 * On the REST route (`POST /restaurant/orders/:id/bill`) the order id is a PATH
 * param and the payment method is the body. The engine dispatches by a single
 * JSON payload, so this input reuses {@link BillOrderDto} VERBATIM (by extension —
 * it inherits `paymentMethod` and its validation) and adds the `orderId` that was
 * the path param. No booking/billing field is re-declared here.
 */
export class BillOrderActionInput extends BillOrderDto {
  @ApiProperty({ description: 'Id of the restaurant order to bill.' })
  @IsString()
  orderId!: string;
}

// `retail.create_sale` needs no wrapper: its action input IS `CreateSaleDto`
// verbatim (re-exported here so the registry imports both action inputs from
// one place). See `../retail/dto/retail.dto`.
export { CreateSaleDto } from '../retail/dto/retail.dto';

// ── Real Estate reference-industry action inputs ──
// enquiry and site-visit reuse the existing realestate DTOs VERBATIM (re-exported).
export { CreateDealDto, CreateVisitDto } from '../realestate/dto/realestate.dto';

/**
 * Input for the generic `engine.enquiry` action — the universal website lead-capture
 * every industry's generated site can fire. Lands in the vendor's real CRM call list.
 */
export class EngineEnquiryInput {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @MaxLength(20) phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @ApiPropertyOptional({ description: 'Industry key, recorded on the lead for context.' })
  @IsOptional() @IsString() @MaxLength(60) industry?: string;
}

/**
 * Input for `realestate.payment_cta` — a public booking-token / site-visit-fee
 * payment. Persists an enquiry (Deal) AND creates a Razorpay ORDER (inert until
 * captured) so the flow connects through the real payments backend, never a
 * parallel ledger. The amount is validated + clamped server-side to a sane band;
 * only the publishable Razorpay key_id is ever returned to the client.
 */
export class RealEstatePaymentInput {
  @ApiProperty({ description: "Customer's name." }) @IsString() @MaxLength(120) clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) clientPhone?: string;
  @ApiPropertyOptional({ description: 'Name/reference of the property the token is for.' })
  @IsOptional() @IsString() @MaxLength(200) propertyRef?: string;
  @ApiProperty({ example: 25000, description: 'Token amount in ₹ (rupees). Clamped to ₹100–₹5,00,000 server-side.' })
  @IsInt() @Min(100) @Max(500000) amount!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

/** One line in a public-site checkout cart. Prices are per-unit in ₹ (rupees). */
export class CheckoutLine {
  @ApiPropertyOptional({ description: 'CatalogItem id, when the line maps to a stocked product (enables stock decrement).' })
  @IsOptional() @IsString() @MaxLength(60) catalogItemId?: string;
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(999) qty!: number;
  @ApiProperty({ description: 'Per-unit price in ₹.' }) @IsNumber() @Min(0) price!: number;
}

/**
 * Input for `engine.checkout.order` (PUBLIC): the cart + buyer. The amount is
 * recomputed server-side from `items` — the client total is never trusted.
 */
export class CheckoutOrderInput {
  @ApiProperty({ type: [CheckoutLine] })
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CheckoutLine)
  items!: CheckoutLine[];
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @MaxLength(20) phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

/** Input for `engine.checkout.confirm` (PUBLIC): the same cart + the Razorpay result. */
export class CheckoutConfirmInput extends CheckoutOrderInput {
  @ApiProperty() @IsString() @MaxLength(120) razorpayOrderId!: string;
  @ApiProperty() @IsString() @MaxLength(120) razorpayPaymentId!: string;
  @ApiProperty() @IsString() @MaxLength(256) razorpaySignature!: string;
}
