import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformSettingsService } from './platform-settings.service';
import { SetSettingDto } from './dto/set-setting.dto';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('platform-settings')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly service: PlatformSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all platform settings grouped by category (masked)' })
  getAll() {
    return this.service.getAll();
  }

  @Get(':category')
  @ApiOperation({ summary: 'Get settings for a single category (masked)' })
  getCategory(@Param('category') category: string) {
    return this.service.getCategory(category);
  }

  @Put(':category/:key')
  @ApiOperation({ summary: 'Set (encrypt + store) a platform setting value' })
  setSetting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('category') category: string,
    @Param('key') key: string,
    @Body() dto: SetSettingDto,
  ) {
    return this.service.setSetting(category, key, dto.value, user.email);
  }

  @Post(':category/:key/test')
  @ApiOperation({ summary: 'Test a platform setting (basic reachability check)' })
  testSetting(@Param('category') category: string, @Param('key') key: string) {
    return this.service.testSetting(category, key);
  }
}
