import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DemoService } from './demo.service';
import { SeedVendorDto, DemoEnquiryDto, ConfirmBuyDto } from './dto/demo.dto';
import { Public } from '../common/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Public()
  @Get('site/:industry')
  @ApiOperation({ summary: 'Industry demo website payload (Phase 2): labels + demo content' })
  site(@Param('industry') industry: string) {
    return this.demo.getSite(industry);
  }

  @Public()
  @Post('enquiry')
  @ApiOperation({ summary: 'Demo-site enquiry — logs a lead + sends a WhatsApp confirmation (Fast2SMS)' })
  enquiry(@Body() dto: DemoEnquiryDto) {
    return this.demo.enquiry(dto.name, dto.phone, dto.industry, dto.message);
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post('seed')
  @ApiOperation({ summary: 'Seed a vendor with sample industry data (Phase 3; used by sandbox provisioning)' })
  seed(@Body() dto: SeedVendorDto) {
    return this.demo.seedVendor(dto.vendorId, dto.industry);
  }

  @ApiBearerAuth()
  @Post('buy/order')
  @ApiOperation({ summary: 'Phase 5 — create a Razorpay order to go live (₹6,999/yr) for the caller’s sandbox' })
  buyOrder(@CurrentUser() user: AuthenticatedUser) {
    return this.demo.createBuyOrder(user.sub);
  }

  @ApiBearerAuth()
  @Post('buy/confirm')
  @ApiOperation({ summary: 'Phase 5 & 6 — verify payment, convert the sandbox to a live account, return a real token' })
  buyConfirm(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmBuyDto) {
    return this.demo.convertSandbox(user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post('cleanup-sandboxes')
  @ApiOperation({ summary: 'Delete expired Book-Demo sandbox vendors + their seeded data (Phase 4 cleanup)' })
  cleanup() {
    return this.demo.cleanupExpiredSandboxes();
  }
}
