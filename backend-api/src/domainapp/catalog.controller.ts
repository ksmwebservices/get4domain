import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog-item.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('domainapp-catalog')
@ApiBearerAuth()
@Controller('domainapp/catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List catalog items for the current vendor (?search=&page=&limit=)' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListQueryDto) {
    return this.catalogService.findAll(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a catalog item' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCatalogItemDto) {
    return this.catalogService.create(user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single catalog item' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalogService.findOne(user.sub, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a catalog item' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.catalogService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a catalog item' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalogService.remove(user.sub, id);
  }
}
