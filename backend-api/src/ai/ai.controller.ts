import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { AiGeneratePageDto } from './dto/generate-page.dto';
import { CallSummaryDto } from './dto/call-summary.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
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
  @Get('costs')
  @ApiOperation({ summary: 'Resolved per-use cost (paise) per AI Studio content type — single source of truth for showcase pricing' })
  costs(): Promise<Record<string, number>> {
    return this.aiService.contentCosts();
  }

  @ApiBearerAuth()
  @Post('generate-content')
  @ApiOperation({ summary: 'Generate campaign content for a channel (deducts wallet credits; free for internal admin staff)' })
  generateContent(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateContentDto) {
    return this.aiService.generateContent(user.sub, dto, isInternalStaff(user));
  }

  @ApiBearerAuth()
  @Post('generate-page')
  @ApiOperation({ summary: 'Generate landing page copy with Claude AI' })
  generatePage(@Body() dto: AiGeneratePageDto) {
    return this.aiService.generatePage(dto);
  }

  @ApiBearerAuth()
  @Post('call-summary')
  @ApiOperation({ summary: 'Summarize a TeleCRM call note (deducts wallet credits; free for internal admin staff)' })
  callSummary(@CurrentUser() user: AuthenticatedUser, @Body() dto: CallSummaryDto) {
    return this.aiService.callSummary(user.sub, dto, isInternalStaff(user));
  }

  @ApiBearerAuth()
  @Post('generate-image')
  @ApiOperation({ summary: 'Generate a design-only background image for a document (text overlaid client-side)' })
  generateImage(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateImageDto) {
    return this.aiService.generateDesignImage(user.sub, dto.prompt, isInternalStaff(user));
  }
}

/**
 * Internal Get4Domain staff (Vendor SUPER_ADMIN `admin@get4domain.com` and any
 * standalone AdminTeamMember) carry an `adminRole` / `kind: 'admin_member'` claim.
 * Their AI Studio usage on the Admin Platform is free — no wallet required — so
 * the team can test and use content generation without topping up credits.
 */
function isInternalStaff(user: AuthenticatedUser): boolean {
  return Boolean(user.adminRole) || user.kind === 'admin_member';
}
