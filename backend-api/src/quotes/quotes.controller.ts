import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('admin-quotes')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @ApiOperation({ summary: 'Create and send a quote (Email/WhatsApp/SMS)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(user.email, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List sent quotes with status' })
  findAll() {
    return this.quotesService.findAll();
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update a quote status (sent/viewed/accepted)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateQuoteStatusDto) {
    return this.quotesService.updateStatus(id, dto.status);
  }
}
