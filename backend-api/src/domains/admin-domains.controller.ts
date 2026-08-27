import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DomainRegistration } from '@prisma/client';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DomainsService } from './domains.service';
import { AdminRegisterDomainDto, AdminDomainActionDto } from './dto/admin-domain.dto';

/**
 * Admin-assist: complete domain steps on a vendor's behalf when they aren't
 * comfortable doing DNS changes themselves (dispatch 26-Aug-2026, Phase 2 item 4).
 * Same service + wallet-safety as the vendor self-service flow, admin-guarded.
 */
@ApiTags('admin-domains')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/domains')
export class AdminDomainsController {
  constructor(private readonly service: DomainsService) {}

  @Get()
  @ApiOperation({ summary: "List a vendor's domains" })
  list(@Query('vendorId') vendorId: string): Promise<DomainRegistration[]> {
    return this.service.listMine(vendorId);
  }

  @Post('register')
  @ApiOperation({ summary: "Register a domain on a vendor's behalf (charged to their wallet)" })
  register(@Body() dto: AdminRegisterDomainDto): Promise<DomainRegistration> {
    return this.service.register(dto.vendorId, { domain: dto.domain, years: dto.years });
  }

  @Post('connect')
  @ApiOperation({ summary: "Add an externally-owned domain for a vendor" })
  connect(@Body() dto: AdminDomainActionDto): Promise<DomainRegistration> {
    return this.service.connect(dto.vendorId, dto.domain);
  }

  @Post('verify')
  @ApiOperation({ summary: "Check DNS propagation for a vendor's domain and activate it" })
  verify(@Body() dto: AdminDomainActionDto) {
    return this.service.verifyMapping(dto.vendorId, dto.domain);
  }
}
