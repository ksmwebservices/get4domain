import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { AiGeneratePageDto } from './dto/generate-page.dto';
import { CallSummaryDto } from './dto/call-summary.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Post('chat')
  @ApiOperation({ summary: 'Chat with the Get4Domain AI assistant (marketing site or vendor dashboard)' })
  chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }

  @ApiBearerAuth()
  @Post('generate-content')
  @ApiOperation({ summary: 'Generate campaign content for a channel (deducts wallet credits)' })
  generateContent(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateContentDto) {
    return this.aiService.generateContent(user.sub, dto);
  }

  @ApiBearerAuth()
  @Post('generate-page')
  @ApiOperation({ summary: 'Generate landing page copy with Claude AI' })
  generatePage(@Body() dto: AiGeneratePageDto) {
    return this.aiService.generatePage(dto);
  }

  @ApiBearerAuth()
  @Post('call-summary')
  @ApiOperation({ summary: 'Summarize a TeleCRM call note (deducts wallet credits)' })
  callSummary(@CurrentUser() user: AuthenticatedUser, @Body() dto: CallSummaryDto) {
    return this.aiService.callSummary(user.sub, dto);
  }
}
