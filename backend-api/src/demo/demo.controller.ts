import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DemoService } from './demo.service';
import { SeedVendorDto, DemoEnquiryDto } from './dto/demo.dto';
import { Public } from '../common/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';

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
}
