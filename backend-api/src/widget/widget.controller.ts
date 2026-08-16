import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WidgetService } from './widget.service';
import { WidgetChatDto, WidgetLeadDto } from './dto/widget.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

const API_BASE = process.env.PUBLIC_API_URL || 'https://gapi.get4domain.com';

@ApiTags('widget')
@Controller('widget')
export class WidgetController {
  constructor(private readonly service: WidgetService) {}

  @ApiBearerAuth()
  @Get('my-key')
  @ApiOperation({ summary: "The caller vendor's embeddable-widget key + paste snippet (3B)" })
  async myKey(@CurrentUser() user: AuthenticatedUser) {
    const key = await this.service.ensureKey(user.sub);
    return {
      widgetKey: key,
      snippet: `<script src="${API_BASE}/widget/embed.js" data-key="${key}" async></script>`,
      leadApi: `${API_BASE}/widget/lead`,
    };
  }

  @Public()
  @Get('config/:key')
  @ApiOperation({ summary: 'Public widget config for a key (business name, industry)' })
  config(@Param('key') key: string) {
    return this.service.config(key);
  }

  @Public()
  @Post('lead')
  @ApiOperation({ summary: 'Submit a lead via the widget/API → same vendor CRM pipeline' })
  lead(@Body() dto: WidgetLeadDto) {
    return this.service.createLead(dto);
  }

  @Public()
  @Post('chat')
  @ApiOperation({ summary: 'Widget chat → the Claude assistant (2B), vendor-scoped' })
  chat(@Body() dto: WidgetChatDto) {
    return this.service.chat(dto);
  }

  @Public()
  @Get('embed.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'The embeddable widget script' })
  embed(): string {
    return this.service.embedJs(API_BASE);
  }
}
