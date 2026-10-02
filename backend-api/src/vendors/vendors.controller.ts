import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Vendor } from '@prisma/client';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

/** A vendor as returned to clients — never the bcrypt password hash. */
export type SafeVendor = Omit<Vendor, 'password'>;
function toSafeVendor(v: Vendor): SafeVendor {
  const { password: _password, ...safe } = v;
  return safe;
}

@ApiTags('vendors')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @ApiOperation({ summary: 'List all vendors (admin only)' })
  async findAll(): Promise<SafeVendor[]> {
    return (await this.vendorsService.findAll()).map(toSafeVendor);
  }

  @Post()
  @ApiOperation({ summary: 'Create a vendor and send welcome email (admin only)' })
  async create(@Body() dto: CreateVendorDto): Promise<SafeVendor> {
    return toSafeVendor(await this.vendorsService.create(dto));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single vendor by id (admin only)' })
  async findOne(@Param('id') id: string): Promise<SafeVendor> {
    return toSafeVendor(await this.vendorsService.findOne(id));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a vendor (admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateVendorDto): Promise<SafeVendor> {
    return toSafeVendor(await this.vendorsService.update(id, dto));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vendor (admin only)' })
  async remove(@Param('id') id: string): Promise<SafeVendor> {
    return toSafeVendor(await this.vendorsService.remove(id));
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend a vendor account (admin only)' })
  async suspend(@Param('id') id: string): Promise<SafeVendor> {
    return toSafeVendor(await this.vendorsService.suspend(id));
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Reactivate a suspended vendor account (admin only)' })
  async activate(@Param('id') id: string): Promise<SafeVendor> {
    return toSafeVendor(await this.vendorsService.activate(id));
  }
}
