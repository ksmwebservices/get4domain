import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DomainRegistration } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DomainsService, DomainSearchResult } from './domains.service';
import { RegisterDomainDto } from './dto/register-domain.dto';
import { ConnectDomainDto } from './dto/connect-domain.dto';

@ApiTags('domains')
@ApiBearerAuth()
@Controller('domains')
export class DomainsController {
  constructor(private readonly service: DomainsService) {}

  @Get('config')
  @ApiOperation({ summary: 'Whether domain search is live + this vendor’s DNS mapping targets' })
  config(@CurrentUser() user: AuthenticatedUser) {
    return this.service.configFor(user.sub);
  }

  @Get('search')
  @ApiOperation({ summary: 'Real domain availability + price via ResellerClub' })
  search(@Query('query') query: string): Promise<DomainSearchResult[]> {
    return this.service.search(query ?? '');
  }

  @Get('mine')
  @ApiOperation({ summary: 'Domains registered or connected by the current vendor' })
  mine(@CurrentUser() user: AuthenticatedUser): Promise<DomainRegistration[]> {
    return this.service.listMine(user.sub);
  }

  @Post('register')
  @ApiOperation({ summary: 'Buy a domain, charged to the vendor wallet (refunded on registrar failure)' })
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDomainDto): Promise<DomainRegistration> {
    return this.service.register(user.sub, dto);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Register intent to point an externally-owned domain at the platform' })
  connect(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConnectDomainDto): Promise<DomainRegistration> {
    return this.service.connect(user.sub, dto.domain);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Check DNS propagation and activate the domain once it points at us' })
  verify(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConnectDomainDto) {
    return this.service.verifyMapping(user.sub, dto.domain);
  }
}
