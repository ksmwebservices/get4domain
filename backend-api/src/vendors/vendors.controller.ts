import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Vendor } from '@prisma/client';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('vendors')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @ApiOperation({ summary: 'List all vendors (admin only)' })
  findAll(): Promise<Vendor[]> {
    return this.vendorsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a vendor and send welcome email (admin only)' })
  create(@Body() dto: CreateVendorDto): Promise<Vendor> {
    return this.vendorsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single vendor by id (admin only)' })
  findOne(@Param('id') id: string): Promise<Vendor> {
    return this.vendorsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a vendor (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto): Promise<Vendor> {
    return this.vendorsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vendor (admin only)' })
  remove(@Param('id') id: string): Promise<Vendor> {
    return this.vendorsService.remove(id);
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend a vendor account (admin only)' })
  suspend(@Param('id') id: string): Promise<Vendor> {
    return this.vendorsService.suspend(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Reactivate a suspended vendor account (admin only)' })
  activate(@Param('id') id: string): Promise<Vendor> {
    return this.vendorsService.activate(id);
  }
}
