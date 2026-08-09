import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
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
  @ApiOperation({ summary: 'Send a message (email real via Resend; WhatsApp/SMS mocked)' })
  send(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendMessageDto) {
    return this.service.send(user.sub, dto.channel, dto.to, dto.message, dto.subject);
  }
}
