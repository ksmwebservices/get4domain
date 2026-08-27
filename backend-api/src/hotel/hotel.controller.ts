import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Room, RoomBooking } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { HotelService, HotelSummary } from './hotel.service';
import { CreateRoomDto, UpdateRoomDto, CreateRoomBookingDto, UpdateRoomBookingDto } from './dto/hotel.dto';

@ApiTags('hotel')
@ApiBearerAuth()
@Controller('hotel')
export class HotelController {
  constructor(private readonly service: HotelService) {}

  @Get('summary') @ApiOperation({ summary: 'Hotel ops summary (occupancy, housekeeping, revenue)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<HotelSummary> { return this.service.summary(u.sub); }

  @Get('rooms') listRooms(@CurrentUser() u: AuthenticatedUser): Promise<Room[]> { return this.service.listRooms(u.sub); }
  @Post('rooms') createRoom(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateRoomDto): Promise<Room> { return this.service.createRoom(u.sub, d); }
  @Patch('rooms/:id') updateRoom(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateRoomDto): Promise<Room> { return this.service.updateRoom(u.sub, id, d); }
  @Delete('rooms/:id') deleteRoom(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Room> { return this.service.deleteRoom(u.sub, id); }

  @Get('bookings') listBookings(@CurrentUser() u: AuthenticatedUser): Promise<RoomBooking[]> { return this.service.listBookings(u.sub); }
  @Post('bookings') createBooking(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateRoomBookingDto): Promise<RoomBooking> { return this.service.createBooking(u.sub, d); }
  @Patch('bookings/:id') updateBooking(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateRoomBookingDto): Promise<RoomBooking> { return this.service.updateBooking(u.sub, id, d); }
  @Delete('bookings/:id') deleteBooking(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<RoomBooking> { return this.service.deleteBooking(u.sub, id); }
}
