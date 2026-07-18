import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Subscription } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Assign a plan/subscription to a vendor (admin only)' })
  create(@Body() dto: CreateSubscriptionDto): Promise<Subscription> {
    return this.subscriptionsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all subscriptions (admin only)' })
  findAll(): Promise<Subscription[]> {
    return this.subscriptionsService.findAll();
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate a subscription (admin only)' })
  activate(@Param('id') id: string): Promise<Subscription> {
    return this.subscriptionsService.activate(id);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription (admin only)' })
  cancel(@Param('id') id: string): Promise<Subscription> {
    return this.subscriptionsService.cancel(id);
  }
}
