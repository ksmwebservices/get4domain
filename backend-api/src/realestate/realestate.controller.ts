import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Listing, Deal, PropertyVisit } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RealEstateService, RealEstateSummary } from './realestate.service';
import {
  CreateListingDto, UpdateListingDto, CreateDealDto, UpdateDealDto, CreateVisitDto, UpdateVisitDto,
} from './dto/realestate.dto';

@ApiTags('realestate')
@ApiBearerAuth()
@Controller('realestate')
export class RealEstateController {
  constructor(private readonly service: RealEstateService) {}

  @Get('summary') @ApiOperation({ summary: 'Real estate summary (pipeline value, won, listings, visits)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<RealEstateSummary> { return this.service.summary(u.sub); }

  @Get('listings') listListings(@CurrentUser() u: AuthenticatedUser): Promise<Listing[]> { return this.service.listListings(u.sub); }
  @Post('listings') createListing(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateListingDto): Promise<Listing> { return this.service.createListing(u.sub, d); }
  @Patch('listings/:id') updateListing(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateListingDto): Promise<Listing> { return this.service.updateListing(u.sub, id, d); }
  @Delete('listings/:id') deleteListing(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Listing> { return this.service.deleteListing(u.sub, id); }

  @Get('deals') listDeals(@CurrentUser() u: AuthenticatedUser): Promise<Deal[]> { return this.service.listDeals(u.sub); }
  @Post('deals') createDeal(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateDealDto): Promise<Deal> { return this.service.createDeal(u.sub, d); }
  @Patch('deals/:id') updateDeal(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateDealDto): Promise<Deal> { return this.service.updateDeal(u.sub, id, d); }
  @Delete('deals/:id') deleteDeal(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Deal> { return this.service.deleteDeal(u.sub, id); }

  @Get('visits') listVisits(@CurrentUser() u: AuthenticatedUser): Promise<PropertyVisit[]> { return this.service.listVisits(u.sub); }
  @Post('visits') createVisit(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateVisitDto): Promise<PropertyVisit> { return this.service.createVisit(u.sub, d); }
  @Patch('visits/:id') updateVisit(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateVisitDto): Promise<PropertyVisit> { return this.service.updateVisit(u.sub, id, d); }
  @Delete('visits/:id') deleteVisit(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<PropertyVisit> { return this.service.deleteVisit(u.sub, id); }
}
