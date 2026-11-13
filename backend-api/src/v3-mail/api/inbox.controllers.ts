import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { InboxService } from '../inbox.service';

export class InboxListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['NEW', 'READ', 'ARCHIVED']) state?: string;
}
export class InboxStateDto { @IsIn(['NEW', 'READ', 'ARCHIVED']) state!: string }
/** The shape the Worker posts. Every field is checked again by the pure core; the decorators are what the whitelist needs to let them through. */
export class InboundEmailDto {
  @IsString() @MaxLength(254) to!: string;
  @IsString() @MaxLength(254) from!: string;
  @IsOptional() @IsString() @MaxLength(200) fromName?: string;
  @IsOptional() @IsString() @MaxLength(998) subject?: string;
  @IsString() @MaxLength(5_000_000) text!: string;
  @IsOptional() @IsString() @MaxLength(300) messageId?: string;
  @IsOptional() spamScore?: number;
  @Type(() => Number) @IsInt() @Min(0) sizeBytes!: number;
}

/** The enquiry inbox of a business. OWNER ONLY for now (messages carry customers' names and addresses). Reading is plan-gated in the service (a business whose plan ended does not read its inbox). */
@ApiTags('v3-inbox-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/inbox')
export class MeInboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get() @ApiOperation({ summary: 'My enquiry messages, newest first' })
  async list(@Tenant() t: TenantContext, @Query() q: InboxListDto) { const { page, pageSize } = pageArgs(q); const r = await this.inbox.list(t.vendorId, q.state, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Get('waiting') @ApiOperation({ summary: 'How many enquiries are waiting while the plan is not active (a count only; details unlock when the plan is active)' })
  waiting(@Tenant() t: TenantContext) { return this.inbox.waiting(t.vendorId); }
  @Get(':id') @ApiOperation({ summary: 'One enquiry message with its full text' })
  get(@Tenant() t: TenantContext, @Param('id') id: string) { return this.inbox.get(t.vendorId, id); }
  @Put(':id/state') @ApiOperation({ summary: 'Mark a message new, read or archived' })
  setState(@Tenant() t: TenantContext, @Param('id') id: string, @Body() b: InboxStateDto) { return this.inbox.setState(t.vendorId, id, b.state); }
}

/** Called only by the Cloudflare Email Worker. No sign-in: the request carries an HMAC signature over its raw body, checked before anything else. */
@ApiTags('v3-inbound-email')
@Public()
@Controller('v3/inbound/email')
export class InboundEmailController {
  constructor(private readonly inbox: InboxService) {}

  @Post() @HttpCode(200) @Throttle(RATE.webhook) @ApiOperation({ summary: 'Receive one enquiry message from the email Worker (signed request)' })
  receive(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-g4d-signature') signature: string | undefined, @Body() body: InboundEmailDto) {
    return this.inbox.receive(req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {}), signature, body as unknown as Record<string, unknown>);
  }
}
