import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { RequiresFeature } from '../../plans/entitlements/requires-feature.decorator';
import { DocumentsService } from '../documents.service';

export class TaxProfileDto {
  @IsOptional() @IsBoolean() gstRegistered?: boolean;
  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(2) stateCode?: string;
  @IsOptional() @IsString() @MaxLength(160) legalName?: string;
  @IsOptional() @IsString() @MaxLength(400) address?: string;
  @IsOptional() @IsBoolean() compositionScheme?: boolean;
  @IsOptional() @IsString() @MaxLength(12) invoicePrefix?: string;
}
export class DocListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

/** The business's own receipts and invoices and its tax profile. OWNER ONLY (money and tax details), needs the plan feature payments.vendor_methods; the vendor is always the signed-in principal's vendor. */
@ApiTags('v3-documents-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('payments.vendor_methods')
@Controller('v3/me')
export class MeDocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get('tax-profile') @ApiOperation({ summary: 'My GST setting, GSTIN, legal name, address, composition choice and invoice prefix' })
  profile(@Tenant() t: TenantContext) { return this.docs.getProfile(t.vendorId); }
  @Put('tax-profile') @HttpCode(200) @ApiOperation({ summary: 'Save my tax profile: it decides tax invoice, bill of supply, bill or fee receipt (a GSTIN is checked, its state is read from it)' })
  saveProfile(@Tenant() t: TenantContext, @Body() dto: TaxProfileDto, @CurrentUser() u: AuthenticatedUser) { return this.docs.saveProfile(t.vendorId, dto, u?.sub ?? null); }
  @Get('documents') @ApiOperation({ summary: 'My receipts and invoices, newest first' })
  async list(@Tenant() t: TenantContext, @Query() q: DocListDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.docs.list(t.vendorId, skip, take); return paged(r.items, r.total, page, pageSize); }
  @Get('documents/:id') @ApiOperation({ summary: 'One receipt or invoice' })
  one(@Tenant() t: TenantContext, @Param('id') id: string) { return this.docs.get(t.vendorId, id); }
  @Post('documents/:id/resend') @HttpCode(200) @ApiOperation({ summary: 'Send the document link to the customer again by WhatsApp and e-mail' })
  resend(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() _req: Request) { return this.docs.resend(t.vendorId, id, u?.sub ?? null); }
  @Get('documents/:id/download') @ApiOperation({ summary: 'The PDF reference of a document (the renderer behind it is a fake in this build)' })
  download(@Tenant() t: TenantContext, @Param('id') id: string) { return this.docs.download(t.vendorId, id); }
}

/** A customer reads their receipt by its unguessable link. Public, rate limited, no cookie, no phone or e-mail in the answer. */
@ApiTags('v3-documents-public')
@Controller('v3/public/doc')
export class PublicDocController {
  constructor(private readonly docs: DocumentsService) {}
  @Public() @Throttle(RATE.requestSubmit) @Get(':code') @ApiOperation({ summary: 'The receipt or invoice for this link: business, lines, tax and total' })
  async view(@Param('code') code: string, @Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'no-store'); return this.docs.publicView(code); }
}
