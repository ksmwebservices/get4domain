import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { PackRecordsTabGuard, RecordRequestContext } from '../pack-records.guard';
import { PackRecordsService, TabLock } from '../pack-records.service';
import { WhoWrote } from '../pack-records.store';
import { RecordListDto, RecordWriteDto } from './pack-records.dto';

const lockOf = (req: Request): TabLock => ((req as unknown as { __packRecordContext?: RecordRequestContext }).__packRecordContext?.lock ?? { locked: false });
const who = (t: TenantContext): WhoWrote => ({ type: t.actor === 'team_member' ? 'TEAM_MEMBER' : 'VENDOR', id: t.memberId ?? t.vendorId });

/**
 * The records of one pack tab (Wave 2 Part A). `:packKey` is the tab's owner (a pack, capability or add-on key) and `:tabKey` the tab, both from the navigation answer. The guard answers for that one tab:
 * ACTIVE opens it, a LOCKED_PREVIEW tab can be read but never written, anything else is refused. The vendor is always the verified principal's.
 */
@ApiTags('v3-pack-records-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(PackRecordsTabGuard)
@Controller('v3/me/packs/:packKey/tabs/:tabKey')
export class MePackRecordsController {
  constructor(private readonly records: PackRecordsService) {}

  @Get('schema') @ApiOperation({ summary: 'The fields of this tab, for the record form and the list columns (money is in paise, before GST)' })
  schema(@Param('packKey') packKey: string, @Param('tabKey') tabKey: string, @Req() req: Request) { return this.records.schema(packKey, tabKey, lockOf(req)); }

  @Get('records') @ApiOperation({ summary: 'My records on this tab, newest first: search, filter by status, page; archived=true lists the archived ones' })
  list(@Tenant() t: TenantContext, @Param('packKey') packKey: string, @Param('tabKey') tabKey: string, @Query() q: RecordListDto, @Req() req: Request) { return this.records.list(t.vendorId, packKey, tabKey, q, lockOf(req)); }

  @Get('records/:id') @ApiOperation({ summary: 'One record' })
  one(@Tenant() t: TenantContext, @Param('packKey') packKey: string, @Param('tabKey') tabKey: string, @Param('id') id: string) { return this.records.get(t.vendorId, packKey, tabKey, id); }

  @Throttle(RATE.recordWrite) @Post('records') @HttpCode(200) @ApiOperation({ summary: 'Add a record; the fields are checked against the tab (unknown fields, wrong types, oversize values and markup are refused)' })
  create(@Tenant() t: TenantContext, @Param('packKey') packKey: string, @Param('tabKey') tabKey: string, @Body() dto: RecordWriteDto, @Req() req: Request) { return this.records.create(t.vendorId, packKey, tabKey, dto, who(t), lockOf(req)); }

  @Throttle(RATE.recordWrite) @Put('records/:id') @HttpCode(200) @ApiOperation({ summary: 'Change a record: only the fields sent change, the rest keep their value; send null to clear an optional field' })
  update(@Tenant() t: TenantContext, @Param('packKey') packKey: string, @Param('tabKey') tabKey: string, @Param('id') id: string, @Body() dto: RecordWriteDto, @Req() req: Request) { return this.records.update(t.vendorId, packKey, tabKey, id, dto, who(t), lockOf(req)); }

  @Throttle(RATE.recordWrite) @Post('records/:id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a record (never deleted)' })
  archive(@Tenant() t: TenantContext, @Param('packKey') packKey: string, @Param('tabKey') tabKey: string, @Param('id') id: string, @Req() req: Request) { return this.records.archive(t.vendorId, packKey, tabKey, id, true, who(t), lockOf(req)); }

  @Throttle(RATE.recordWrite) @Post('records/:id/restore') @HttpCode(200) @ApiOperation({ summary: 'Bring an archived record back' })
  restore(@Tenant() t: TenantContext, @Param('packKey') packKey: string, @Param('tabKey') tabKey: string, @Param('id') id: string, @Req() req: Request) { return this.records.archive(t.vendorId, packKey, tabKey, id, false, who(t), lockOf(req)); }
}
