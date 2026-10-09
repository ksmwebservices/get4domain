import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeadspaceStaffGuard } from '../leadspace/staff.guard';
import { SocialAccountsService } from './social-accounts.service';
import { SocialPublisherService } from './social-publisher.service';
import { SaveAccountDto } from './social.dto';

/** Admin: Get4Domain's own Pages and channels, the post log, and a button to post what is due now. */
@ApiTags('admin-social')
@ApiBearerAuth()
@UseGuards(LeadspaceStaffGuard)
@Controller('admin/social')
export class SocialAdminController {
  constructor(private readonly accounts: SocialAccountsService, private readonly publisher: SocialPublisherService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Connected accounts (tokens are never shown)' })
  list(@Query('ownerType') ownerType?: string, @Query('vendorId') vendorId?: string, @Query('channel') channel?: string) { return this.accounts.list({ ownerType, vendorId, channel }); }

  @Put('accounts')
  @ApiOperation({ summary: 'Create or change an account. The token is saved encrypted and never returned.' })
  save(@Body() dto: SaveAccountDto) { return this.accounts.save(dto); }

  @Post('accounts/:id/test')
  @ApiOperation({ summary: 'Check that the saved token works (a read-only call to the network)' })
  test(@Param('id') id: string) { return this.publisher.testConnection(id); }

  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Disconnect an account: the token is removed and posting stops; history stays' })
  disconnect(@Param('id') id: string) { return this.accounts.disconnect(id); }

  @Get('posts')
  @ApiOperation({ summary: 'The post log: what was scheduled, posted, retried or failed, and why' })
  posts(@Query('accountId') accountId?: string, @Query('status') status?: string, @Query('take') take?: string) { return this.publisher.log({ accountId, status, take: take ? Number(take) : undefined }); }

  @Post('run')
  @ApiOperation({ summary: 'Post what is due now (the scheduler also does this every two minutes)' })
  run() { return this.publisher.runDue(); }

  @Post('posts/:id/cancel')
  @ApiOperation({ summary: 'Cancel a post that has not been sent yet' })
  cancel(@Param('id') id: string) { return this.publisher.cancel(id); }
}
