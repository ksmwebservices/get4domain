import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminVendorSiteService } from './admin-vendor-site.service';
import { CategoryTreeQueryDto, CreateVendorWithSiteDto } from './admin-vendor-site.dto';

/** Staff (SALES included) create a business with its site on behalf of an owner, and pick its category (B2.2). Role matrix: SUPER_ADMIN, OPERATIONS (ADMIN inherits) and SALES. */
@ApiTags('v3-admin-vendor-site')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminVendorSiteController {
  constructor(private readonly service: AdminVendorSiteService) {}

  @Get('categories/tree')
  @ApiOperation({ summary: 'The category picker: every category (all 196 of the catalogue plus the kit-only ones) grouped by family with its sub categories; ?q= searches by name' })
  tree(@Query() q: CategoryTreeQueryDto) { return this.service.tree(q.q); }

  @Post('vendor-sites') @HttpCode(201)
  @ApiOperation({ summary: 'Create a business with its Free plan and live trial site on behalf of an owner. Runs the shared duplicate check. Returns the site address.' })
  create(@Body() dto: CreateVendorWithSiteDto, @CurrentUser() user: AuthenticatedUser) { return this.service.create(dto, { id: user.sub, role: String(user.adminRole ?? 'MARKETING'), label: user.staffLabel ?? null }); }
}
