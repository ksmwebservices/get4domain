import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const DOC_TYPES = ['QUOTE', 'SALES_ORDER', 'SALES_INVOICE', 'CREDIT_NOTE', 'PURCHASE_BILL'] as const;
const MODES = ['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE', 'GATEWAY'] as const;

export class DocLineDto {
  @IsOptional() @IsString() @MaxLength(60) itemId?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsString() @MaxLength(60) variantKey?: string;
  @IsOptional() @IsString() @MaxLength(20) hsn?: string;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsNumber() @Min(0.0001) qty!: number;
  @IsOptional() @IsNumber() @Min(0) rate?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) gstRate?: number;
  @IsOptional() @IsString() @MaxLength(60) refLineId?: string;
  @IsOptional() @IsBoolean() restock?: boolean;
}

export class DocDto {
  @IsIn(DOC_TYPES as unknown as string[]) docType!: (typeof DOC_TYPES)[number];
  @IsOptional() @IsString() @MaxLength(60) partyId?: string;
  @IsOptional() @IsString() @MaxLength(120) partyName?: string;
  @IsOptional() @IsDateString() docDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsIn(['GST', 'NONE']) taxKind?: 'GST' | 'NONE';
  @IsOptional() @IsIn(['EXCLUSIVE', 'INCLUSIVE']) priceMode?: 'EXCLUSIVE' | 'INCLUSIVE';
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsNumber() @Min(0) shipping?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsString() @MaxLength(1000) terms?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => DocLineDto) lines!: DocLineDto[];
  @IsOptional() @IsString() @MaxLength(60) refDocId?: string;
  @IsOptional() @IsString() @MaxLength(60) supplierRef?: string;
  @IsOptional() @IsString() @MaxLength(80) idempotencyKey?: string;
  @IsOptional() @IsBoolean() roundOff?: boolean;
  /** Issue straight away (assign the number, move stock, post the books). */
  @IsOptional() @IsBoolean() issue?: boolean;
}

/** Editing a draft: the document type never changes. */
export class UpdateDocDto {
  @IsOptional() @IsString() @MaxLength(60) partyId?: string;
  @IsOptional() @IsString() @MaxLength(120) partyName?: string;
  @IsOptional() @IsDateString() docDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsIn(['GST', 'NONE']) taxKind?: 'GST' | 'NONE';
  @IsOptional() @IsIn(['EXCLUSIVE', 'INCLUSIVE']) priceMode?: 'EXCLUSIVE' | 'INCLUSIVE';
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsNumber() @Min(0) shipping?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsString() @MaxLength(1000) terms?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => DocLineDto) lines!: DocLineDto[];
  @IsOptional() @IsString() @MaxLength(60) supplierRef?: string;
  @IsOptional() @IsBoolean() roundOff?: boolean;
}

export class ReasonDto { @IsString() @MinLength(3) @MaxLength(200) reason!: string; }
export class ConvertDto { @IsIn(['SALES_ORDER', 'SALES_INVOICE']) to!: 'SALES_ORDER' | 'SALES_INVOICE'; /** Issue the new document straight away. */ @IsOptional() @IsBoolean() issue?: boolean; }
export class QuoteStatusDto { @IsIn(['ACCEPTED', 'REJECTED']) status!: 'ACCEPTED' | 'REJECTED'; }

export class CreditLineDto {
  @IsString() @MaxLength(60) refLineId!: string;
  @IsNumber() @Min(0.0001) qty!: number;
  @IsOptional() @IsBoolean() restock?: boolean;
}
export class CreditNoteDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreditLineDto) lines?: CreditLineDto[];
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @IsDateString() docDate?: string;
  /** Issue it straight away. */
  @IsOptional() @IsBoolean() issue?: boolean;
}

export class PayLineDto { @IsIn(MODES as unknown as string[]) mode!: string; @IsNumber() @Min(0.01) amount!: number; @IsOptional() @IsString() @MaxLength(80) reference?: string; }
export class CounterSaleDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => DocLineDto) lines!: DocLineDto[];
  @IsOptional() @IsString() @MaxLength(60) partyId?: string;
  @IsOptional() @IsString() @MaxLength(120) partyName?: string;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsIn(['GST', 'NONE']) taxKind?: 'GST' | 'NONE';
  @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => PayLineDto) payments!: PayLineDto[];
  @IsString() @MinLength(8) @MaxLength(80) idempotencyKey!: string;
}

export class AllocationDto { @IsString() @MaxLength(60) documentId!: string; @IsNumber() @Min(0.01) amount!: number; }
export class PaymentDto {
  @IsIn(['RECEIPT', 'PAYMENT_OUT']) kind!: 'RECEIPT' | 'PAYMENT_OUT';
  @IsOptional() @IsString() @MaxLength(60) partyId?: string;
  @IsOptional() @IsString() @MaxLength(120) partyName?: string;
  @IsIn(MODES as unknown as string[]) mode!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllocationDto) allocations?: AllocationDto[];
  @IsOptional() @IsBoolean() auto?: boolean;
  @IsOptional() @IsString() @MaxLength(80) idempotencyKey?: string;
}
export class ApplyAdvanceDto { @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AllocationDto) allocations!: AllocationDto[]; }

export class ExpenseDto {
  @IsOptional() @IsDateString() expenseDate?: string;
  @IsString() @MaxLength(10) category!: string;
  @IsString() @MinLength(2) @MaxLength(200) description!: string;
  @IsOptional() @IsString() @MaxLength(60) supplierId?: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) gstRate?: number;
  @IsOptional() @IsBoolean() amountIncludesGst?: boolean;
  @IsOptional() @IsBoolean() claimGst?: boolean;
  @IsIn(['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE']) paymentMode!: string;
  @IsOptional() @IsString() @MaxLength(500) attachment?: string;
  @IsOptional() @IsIn(['NONE', 'MONTHLY', 'QUARTERLY', 'YEARLY']) recurring?: 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  @IsOptional() @IsString() @MaxLength(80) idempotencyKey?: string;
}

export class SettingsDto {
  @IsOptional() @IsBoolean() gstRegistered?: boolean;
  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(120) legalName?: string;
  @IsOptional() @IsString() @MaxLength(60) state?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultGstRate?: number;
  @IsOptional() @IsIn(['EXCLUSIVE', 'INCLUSIVE']) priceMode?: string;
  @IsOptional() @IsBoolean() roundOff?: boolean;
  @IsOptional() @IsIn(['BLOCK', 'WARN', 'ALLOW']) negativeStock?: string;
  @IsOptional() @IsIn(['PAID', 'CONFIRMED', 'OFF']) orderInvoiceOn?: string;
  @IsOptional() @IsBoolean() purchaseUpdatesCost?: boolean;
  @IsOptional() @IsString() @MaxLength(600) bankDetails?: string;
  @IsOptional() @IsString() @MaxLength(80) upiId?: string;
  @IsOptional() @IsString() @MaxLength(600) terms?: string;
  @IsOptional() @IsString() @MaxLength(600) notes?: string;
  @IsOptional() prefixes?: Record<string, string>;
}

export class LockDto { @IsOptional() @IsDateString() lockedUntil?: string | null; }

export class PartyDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(5) @MaxLength(20) phone!: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsIn(['customer', 'supplier', 'both']) type?: 'customer' | 'supplier' | 'both';
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(300) shippingAddress?: string;
  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(60) state?: string;
  /** Rupees owed at the start (customer: they owe you; supplier: you owe them). Set once. */
  @IsOptional() @IsNumber() @Min(0) openingBalance?: number;
}
export class UpdatePartyDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsIn(['customer', 'supplier', 'both']) type?: 'customer' | 'supplier' | 'both';
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(300) shippingAddress?: string;
  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(60) state?: string;
}

export class LocationDto { @IsString() @MinLength(2) @MaxLength(60) name!: string; }
export class TransferDto {
  @IsString() @MaxLength(60) productId!: string;
  @IsInt() @Min(1) qty!: number;
  @IsString() @MaxLength(60) fromLocationId!: string;
  @IsString() @MaxLength(60) toLocationId!: string;
  @IsOptional() @IsString() @MaxLength(60) variantKey?: string;
  @IsOptional() @IsString() @MaxLength(80) idempotencyKey?: string;
}
export class ItemCostDto {
  @IsOptional() @IsString() @MaxLength(20) hsn?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) gstRate?: number;
  @IsOptional() @IsNumber() @Min(0) purchasePrice?: number;
}

export class RecurringDto {
  @IsString() @MaxLength(60) templateId!: string;
  @IsIn(['MONTHLY', 'QUARTERLY', 'YEARLY']) frequency!: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  @IsDateString() nextRunOn!: string;
  @IsOptional() @IsDateString() endsOn?: string;
}

export class EmailDocDto { @IsOptional() @IsString() @MaxLength(120) to?: string; }
export class AlertsDto { @IsBoolean() daily!: boolean; }
