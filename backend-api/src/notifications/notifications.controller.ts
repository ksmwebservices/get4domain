import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService, ADMIN_RECIPIENT_ID } from './notifications.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { SendPushDto } from './dto/send-push.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current vendor/admin, unread first' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    return this.notificationsService.findForRecipient(isAdmin ? ADMIN_RECIPIENT_ID : user.sub);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for the current vendor/admin' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    return this.notificationsService.markAllRead(isAdmin ? ADMIN_RECIPIENT_ID : user.sub);
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Register a Web Push subscription for the current vendor/admin' })
  subscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubscribeDto) {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    return this.notificationsService.subscribe(
      isAdmin ? ADMIN_RECIPIENT_ID : user.sub,
      dto.userType,
      dto.endpoint,
      dto.keys.p256dh,
      dto.keys.auth,
      dto.device,
    );
  }

  @UseGuards(AdminGuard)
  @Post('push')
  @ApiOperation({ summary: 'Send a push notification to a specific vendor (admin only)' })
  push(@Body() dto: SendPushDto) {
    return this.notificationsService.notifyVendor(dto.vendorId, 'admin_push', dto.title, dto.body, { data: dto.data });
  }
}
