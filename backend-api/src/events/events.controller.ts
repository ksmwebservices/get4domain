import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventBooking, EventVendorAssignment } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EventsService, EventsSummary } from './events.service';
import {
  CreateBookingDto, UpdateBookingDto,
  CreateEventVendorDto, UpdateEventVendorDto,
} from './dto/events.dto';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Get('summary') @ApiOperation({ summary: 'Events summary (upcoming events, value, vendor cost)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<EventsSummary> { return this.service.summary(u.sub); }

  @Get('bookings') listBookings(@CurrentUser() u: AuthenticatedUser): Promise<EventBooking[]> { return this.service.listBookings(u.sub); }
  @Get('bookings/:id') getBooking(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<EventBooking> { return this.service.getBooking(u.sub, id); }
  @Post('bookings') createBooking(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateBookingDto): Promise<EventBooking> { return this.service.createBooking(u.sub, d); }
  @Patch('bookings/:id') updateBooking(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateBookingDto): Promise<EventBooking> { return this.service.updateBooking(u.sub, id, d); }
  @Delete('bookings/:id') deleteBooking(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<EventBooking> { return this.service.deleteBooking(u.sub, id); }

  @Get('vendors') listVendors(@CurrentUser() u: AuthenticatedUser): Promise<EventVendorAssignment[]> { return this.service.listVendors(u.sub); }
  @Post('bookings/:id/vendors') addVendor(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: CreateEventVendorDto): Promise<EventVendorAssignment> { return this.service.addVendor(u.sub, id, d); }
  @Patch('vendors/:id') updateVendor(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateEventVendorDto): Promise<EventVendorAssignment> { return this.service.updateVendor(u.sub, id, d); }
  @Delete('vendors/:id') deleteVendor(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<EventVendorAssignment> { return this.service.deleteVendor(u.sub, id); }
}
