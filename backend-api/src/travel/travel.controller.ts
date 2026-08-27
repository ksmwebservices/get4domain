import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Vehicle, Driver, Trip, VisaApplication } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TravelService } from './travel.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';
import { CreateTripDto, UpdateTripDto } from './dto/trip.dto';
import { CreateVisaDto, UpdateVisaDto } from './dto/visa.dto';

@ApiTags('travel')
@ApiBearerAuth()
@Controller('travel')
export class TravelController {
  constructor(private readonly service: TravelService) {}

  // Vehicles (Fleet)
  @Get('vehicles')
  @ApiOperation({ summary: "List the vendor's fleet vehicles" })
  listVehicles(@CurrentUser() user: AuthenticatedUser): Promise<Vehicle[]> {
    return this.service.listVehicles(user.sub);
  }
  @Post('vehicles')
  @ApiOperation({ summary: 'Add a vehicle to the fleet' })
  createVehicle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVehicleDto): Promise<Vehicle> {
    return this.service.createVehicle(user.sub, dto);
  }
  @Patch('vehicles/:id')
  @ApiOperation({ summary: 'Update a vehicle' })
  updateVehicle(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateVehicleDto): Promise<Vehicle> {
    return this.service.updateVehicle(user.sub, id, dto);
  }
  @Delete('vehicles/:id')
  @ApiOperation({ summary: 'Delete a vehicle' })
  deleteVehicle(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Vehicle> {
    return this.service.deleteVehicle(user.sub, id);
  }

  // Drivers
  @Get('drivers')
  @ApiOperation({ summary: "List the vendor's drivers" })
  listDrivers(@CurrentUser() user: AuthenticatedUser): Promise<Driver[]> {
    return this.service.listDrivers(user.sub);
  }
  @Post('drivers')
  @ApiOperation({ summary: 'Add a driver' })
  createDriver(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDriverDto): Promise<Driver> {
    return this.service.createDriver(user.sub, dto);
  }
  @Patch('drivers/:id')
  @ApiOperation({ summary: 'Update a driver' })
  updateDriver(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateDriverDto): Promise<Driver> {
    return this.service.updateDriver(user.sub, id, dto);
  }
  @Delete('drivers/:id')
  @ApiOperation({ summary: 'Delete a driver' })
  deleteDriver(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Driver> {
    return this.service.deleteDriver(user.sub, id);
  }

  // Trips
  @Get('trips')
  @ApiOperation({ summary: "List the vendor's trips (with assigned vehicle/driver + visas)" })
  listTrips(@CurrentUser() user: AuthenticatedUser): Promise<Trip[]> {
    return this.service.listTrips(user.sub);
  }
  @Post('trips')
  @ApiOperation({ summary: 'Create a trip / itinerary' })
  createTrip(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTripDto): Promise<Trip> {
    return this.service.createTrip(user.sub, dto);
  }
  @Patch('trips/:id')
  @ApiOperation({ summary: 'Update a trip (status, assignment, itinerary, costs)' })
  updateTrip(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTripDto): Promise<Trip> {
    return this.service.updateTrip(user.sub, id, dto);
  }
  @Delete('trips/:id')
  @ApiOperation({ summary: 'Delete a trip' })
  deleteTrip(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Trip> {
    return this.service.deleteTrip(user.sub, id);
  }

  // Visa applications
  @Get('visa')
  @ApiOperation({ summary: "List the vendor's visa applications" })
  listVisas(@CurrentUser() user: AuthenticatedUser): Promise<VisaApplication[]> {
    return this.service.listVisas(user.sub);
  }
  @Post('visa')
  @ApiOperation({ summary: 'Create a visa application' })
  createVisa(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVisaDto): Promise<VisaApplication> {
    return this.service.createVisa(user.sub, dto);
  }
  @Patch('visa/:id')
  @ApiOperation({ summary: 'Update a visa application (status workflow)' })
  updateVisa(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateVisaDto): Promise<VisaApplication> {
    return this.service.updateVisa(user.sub, id, dto);
  }
  @Delete('visa/:id')
  @ApiOperation({ summary: 'Delete a visa application' })
  deleteVisa(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<VisaApplication> {
    return this.service.deleteVisa(user.sub, id);
  }
}
