import { Body, Controller, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Subscription } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Current DomainApp subscription for a vendor (vendor sees own, admin sees any)' })
  async findCurrentForVendor(@Param('vendorId') vendorId: string, @CurrentUser() user: AuthenticatedUser): Promise<Subscription | null> {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdmin && user.sub !== vendorId) {
      throw new ForbiddenException('You may only access your own subscription');
    }
    return this.subscriptionsService.findCurrentForVendor(vendorId);
  }

  @UseGuards(AdminGuard)
  @Post()
  @ApiOperation({ summary: 'Assign a plan/subscription to a vendor (admin only)' })
  create(@Body() dto: CreateSubscriptionDto): Promise<Subscription> {
    return this.subscriptionsService.create(dto);
  }

  @UseGuards(AdminGuard)
  @Get()
  @ApiOperation({ summary: 'List all subscriptions (admin only)' })
  findAll(): Promise<Subscription[]> {
    return this.subscriptionsService.findAll();
  }

  @UseGuards(AdminGuard)
  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate a subscription (admin only)' })
  activate(@Param('id') id: string): Promise<Subscription> {
    return this.subscriptionsService.activate(id);
  }

  @UseGuards(AdminGuard)
  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription (admin only)' })
  cancel(@Param('id') id: string): Promise<Subscription> {
    return this.subscriptionsService.cancel(id);
  }
}
