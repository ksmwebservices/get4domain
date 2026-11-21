import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { MailRulesService } from './mail-rules.service';

export class ConfirmPriceDto { @IsString() @MaxLength(400) note!: string }

/** The recorded mail lanes, mailbox prices and promotion rules. Reading: OPERATIONS and SUPER_ADMIN. Confirming a price: SUPER_ADMIN only (it makes a price usable). Nothing here sends mail. */
@ApiTags('v3-mail-rules')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class MailRulesController {
  constructor(private readonly rules: MailRulesService) {}

  @Get('mail-rules') @ApiOperation({ summary: 'The three mail lanes, the mailbox prices (PENDING until confirmed) and the recorded promotion limits and opt-in proof rules' })
  overview() { return this.rules.overview(); }
  @Post('mailbox-prices/:id/confirm') @HttpCode(200) @ApiOperation({ summary: 'Confirm a mailbox price after checking the real cost (PENDING to ACTIVE, with a written note)' })
  confirm(@Param('id') id: string, @Body() b: ConfirmPriceDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.rules.confirmPrice(actorOf(u, req), id, b.note); }
}
