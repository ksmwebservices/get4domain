import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsDefined, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CommercialAdminGuard } from '../commercial/foundation.services';
import { LeadspaceStaffGuard } from '../leadspace/staff.guard';
import { PackConfig } from './pack.types';
import { PacksService } from './packs.service';
import { StarterService } from './starter.service';

class CreatePackDto {
  @IsString() @MaxLength(60) key!: string;
  @IsString() @MaxLength(80) name!: string;
  @IsDefined() @IsObject() config!: PackConfig;
}
class UpdatePackDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() config?: PackConfig;
}
class DuplicatePackDto { @IsString() @MaxLength(60) key!: string; @IsString() @MaxLength(80) name!: string }
class CreateSiteDto {
  @IsString() @MaxLength(60) categoryKey!: string;
  @IsString() @MaxLength(120) businessName!: string;
  @IsString() @MaxLength(40) subdomain!: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}
class DesignDto { @IsString() @MaxLength(40) designKey!: string }
class GenerateDto {
  @IsString() @MaxLength(60) packKey!: string;
  @IsString() @MaxLength(120) businessName!: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}

/** Admin: Category packs. Any staff (including MARKETING) can read and preview; only admins change them. */
@ApiTags('admin-category-packs')
@ApiBearerAuth()
@Controller('admin/category-packs')
export class PacksAdminController {
  constructor(private readonly packs: PacksService, private readonly starter: StarterService) {}

  @UseGuards(CommercialAdminGuard) @Post('sites') @ApiOperation({ summary: 'Create one site from a category and business details. It starts as DRAFT: hidden from the public until it is published or claimed.' })
  createSite(@Body() dto: CreateSiteDto, @CurrentUser() u: AuthenticatedUser) { return this.starter.createSite(dto, u.sub); }

  @UseGuards(LeadspaceStaffGuard) @Get() @ApiOperation({ summary: 'All category packs' }) list() { return this.packs.list(); }
  @UseGuards(LeadspaceStaffGuard) @Get(':key') @ApiOperation({ summary: 'One pack' }) get(@Param('key') key: string) { return this.packs.get(key); }
  @UseGuards(LeadspaceStaffGuard) @Get(':key/preview') @ApiOperation({ summary: 'The pack filled with sample company details (writes nothing)' }) preview(@Param('key') key: string) { return this.packs.preview(key); }

  @UseGuards(CommercialAdminGuard) @Post() @ApiOperation({ summary: 'Create a pack. No deploy needed.' })
  create(@Body() dto: CreatePackDto, @CurrentUser() u: AuthenticatedUser) { return this.packs.create(dto.key, dto.name, dto.config, u.sub); }
  @UseGuards(CommercialAdminGuard) @Put(':key') @ApiOperation({ summary: 'Edit a pack, or switch it on or off' })
  update(@Param('key') key: string, @Body() dto: UpdatePackDto) { return this.packs.update(key, dto); }
  @UseGuards(CommercialAdminGuard) @Post(':key/duplicate') @ApiOperation({ summary: 'Copy a pack under a new key' })
  duplicate(@Param('key') key: string, @Body() dto: DuplicatePackDto, @CurrentUser() u: AuthenticatedUser) { return this.packs.duplicate(key, dto.key, dto.name, u.sub); }
  @UseGuards(CommercialAdminGuard) @Post('seed/starter') @ApiOperation({ summary: 'Create the 24 starter categories that are missing, each with its family, four designs and starter content; add them to older packs that have none. Never changes anything an admin edited.' })
  seed(@CurrentUser() u: AuthenticatedUser) { return this.packs.seedStarter(u.sub); }
}

/** Vendor: generate the first draft of the site from a category pack and the company details. */
@ApiTags('site-doc')
@ApiBearerAuth()
@RequireModule('website')
@Controller('site-doc/me')
export class PacksVendorController {
  constructor(private readonly packs: PacksService, private readonly starter: StarterService) {}

  @Get('designs') @ApiOperation({ summary: 'The four designs of your category, and the one in use' })
  designs(@CurrentUser() u: AuthenticatedUser) { return this.starter.designsOf(u.sub); }

  @Post('design') @ApiOperation({ summary: 'Switch to another of your four designs. Your content stays; the change is saved as a draft.' })
  design(@CurrentUser() u: AuthenticatedUser, @Body() dto: DesignDto) { return this.starter.switchDesign(u.sub, dto.designKey); }

  @Post('reset-starter') @ApiOperation({ summary: 'Fill what is empty or still sample from your category starter content. Never overwrites what you wrote.' })
  reset(@CurrentUser() u: AuthenticatedUser) { return this.starter.reset(u.sub); }

  @Get('categories') @ApiOperation({ summary: 'The categories a site can be generated from' })
  async categories() { return (await this.packs.list()).filter((p) => p.enabled).map((p) => ({ key: p.key, name: p.name })); }

  @Post('generate') @ApiOperation({ summary: 'Generate the site draft from a category and your company details. You then edit and publish it.' })
  generate(@CurrentUser() u: AuthenticatedUser, @Body() dto: GenerateDto) { return this.packs.generate(u.sub, dto.packKey, dto); }
}
