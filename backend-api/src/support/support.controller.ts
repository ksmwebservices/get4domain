import { Body, Controller, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupportTicket } from '@prisma/client';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @ApiOperation({ summary: 'Create a support ticket as the authenticated vendor' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthenticatedUser): Promise<SupportTicket> {
    return this.supportService.create(user.sub, dto);
  }

  @UseGuards(AdminGuard)
  @Get()
  @ApiOperation({ summary: 'List all support tickets (admin only)' })
  findAll(): Promise<SupportTicket[]> {
    return this.supportService.findAll();
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'List tickets for a vendor (vendor sees own, admin sees any)' })
  findByVendor(
    @Param('vendorId') vendorId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SupportTicket[]> {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdmin && user.sub !== vendorId) {
      throw new ForbiddenException('You may only view your own support tickets');
    }
    return this.supportService.findByVendor(vendorId);
  }

  @UseGuards(AdminGuard)
  @Put(':id/reply')
  @ApiOperation({ summary: 'Reply to a support ticket (admin only)' })
  reply(@Param('id') id: string, @Body() dto: ReplyTicketDto): Promise<SupportTicket> {
    return this.supportService.reply(id, dto.adminReply);
  }

  @UseGuards(AdminGuard)
  @Put(':id/resolve')
  @ApiOperation({ summary: 'Mark a support ticket as resolved (admin only)' })
  resolve(@Param('id') id: string): Promise<SupportTicket> {
    return this.supportService.resolve(id);
  }
}
