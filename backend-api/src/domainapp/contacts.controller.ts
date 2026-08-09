import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('domainapp-contacts')
@ApiBearerAuth()
@Controller('domainapp/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts for the current vendor (?type=&search=&page=&limit=)' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListQueryDto) {
    return this.contactsService.findAll(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a contact' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single contact' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.contactsService.findOne(user.sub, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contact' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.contactsService.remove(user.sub, id);
  }
}
