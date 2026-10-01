import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { RespondProposalDto } from './dto/respond-proposal.dto';
import { renderProposalHtml } from './templates/proposal.template';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a single quote/proposal' })
  findOne(@Param('id') id: string) {
    return this.quotesService.findOne(id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update a quote status (draft/sent/viewed/accepted/declined)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateQuoteStatusDto) {
    return this.quotesService.updateStatus(id, dto.status);
  }

  @Post('proposals')
  @ApiOperation({ summary: 'Save a multi-line Managed Services proposal as a draft (not sent)' })
  createProposal(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProposalDto) {
    return this.quotesService.createProposal(user.email, dto);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Printable HTML proposal document (browser print-to-PDF)' })
  async getPdf(@Param('id') id: string): Promise<{ html: string }> {
    return { html: await this.quotesService.generatePdfHtml(id) };
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Generate (or return existing) public share link for this proposal' })
  createShareLink(@Param('id') id: string) {
    return this.quotesService.createShareLink(id);
  }
}

// ── Public surface — the prospect's shareable link, no auth ──
@ApiTags('admin-quotes')
@Controller('quotes/public')
export class PublicQuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Public read-only view of a shared proposal' })
  async getPublic(@Param('token') token: string): Promise<{ html: string; status: string }> {
    const quote = await this.quotesService.findByShareToken(token);
    const items = (quote.items as unknown as { label: string; qty: number; rate: number }[] | null) ?? [
      { label: quote.itemLabel, qty: 1, rate: quote.amount },
    ];
    return { html: renderProposalHtml(quote, items), status: quote.status };
  }

  @Public()
  @Put(':token/respond')
  @ApiOperation({ summary: 'Prospect accepts or declines a shared proposal' })
  respond(@Param('token') token: string, @Body() dto: RespondProposalDto) {
    return this.quotesService.respondByShareToken(token, dto.status);
  }
}
