import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsDefined, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CommercialAdminGuard } from '../commercial/foundation.services';
import { LeadspaceStaffGuard } from '../leadspace/staff.guard';
import { PackConfig } from './pack.types';
import { PacksService } from './packs.service';

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
  constructor(private readonly packs: PacksService) {}

  @UseGuards(LeadspaceStaffGuard) @Get() @ApiOperation({ summary: 'All category packs' }) list() { return this.packs.list(); }
  @UseGuards(LeadspaceStaffGuard) @Get(':key') @ApiOperation({ summary: 'One pack' }) get(@Param('key') key: string) { return this.packs.get(key); }
  @UseGuards(LeadspaceStaffGuard) @Get(':key/preview') @ApiOperation({ summary: 'The pack filled with sample company details (writes nothing)' }) preview(@Param('key') key: string) { return this.packs.preview(key); }

  @UseGuards(CommercialAdminGuard) @Post() @ApiOperation({ summary: 'Create a pack. No deploy needed.' })
  create(@Body() dto: CreatePackDto, @CurrentUser() u: AuthenticatedUser) { return this.packs.create(dto.key, dto.name, dto.config, u.sub); }
  @UseGuards(CommercialAdminGuard) @Put(':key') @ApiOperation({ summary: 'Edit a pack, or switch it on or off' })
  update(@Param('key') key: string, @Body() dto: UpdatePackDto) { return this.packs.update(key, dto); }
  @UseGuards(CommercialAdminGuard) @Post(':key/duplicate') @ApiOperation({ summary: 'Copy a pack under a new key' })
  duplicate(@Param('key') key: string, @Body() dto: DuplicatePackDto, @CurrentUser() u: AuthenticatedUser) { return this.packs.duplicate(key, dto.key, dto.name, u.sub); }
  @UseGuards(CommercialAdminGuard) @Post('seed/starter') @ApiOperation({ summary: 'Create the starter packs that are missing (12 LeadSpace trades + 20 industries). Never changes an existing pack.' })
  seed(@CurrentUser() u: AuthenticatedUser) { return this.packs.seedStarter(u.sub); }
}

/** Vendor: generate the first draft of the site from a category pack and the company details. */
@ApiTags('site-doc')
@ApiBearerAuth()
@RequireModule('website')
@Controller('site-doc/me')
export class PacksVendorController {
  constructor(private readonly packs: PacksService) {}

  @Get('categories') @ApiOperation({ summary: 'The categories a site can be generated from' })
  async categories() { return (await this.packs.list()).filter((p) => p.enabled).map((p) => ({ key: p.key, name: p.name })); }

  @Post('generate') @ApiOperation({ summary: 'Generate the site draft from a category and your company details. You then edit and publish it.' })
  generate(@CurrentUser() u: AuthenticatedUser, @Body() dto: GenerateDto) { return this.packs.generate(u.sub, dto.packKey, dto); }
}
