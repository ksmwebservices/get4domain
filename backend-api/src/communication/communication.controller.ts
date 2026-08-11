import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunicationService, Channel } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('communication')
@ApiBearerAuth()
@Controller('communication')
export class CommunicationController {
  constructor(private readonly service: CommunicationService) {}

  @Get('threads')
  @ApiOperation({ summary: 'Unified inbox threads (derived from contacts)' })
  threads(@CurrentUser() user: AuthenticatedUser) {
    return this.service.threads(user.sub);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a message (email real via Resend; WhatsApp/SMS via Fast2SMS) + persist to inbox' })
  send(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendMessageDto) {
    return this.service.send(user.sub, dto.channel, dto.to, dto.message, dto.subject, dto.contactId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Persisted message history for a contact + channel (inbox thread)' })
  history(@CurrentUser() user: AuthenticatedUser, @Query('contactId') contactId: string, @Query('channel') channel?: Channel) {
    return this.service.history(user.sub, contactId, channel);
  }
}
