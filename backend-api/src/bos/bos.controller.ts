import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Post, Put, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { BosSettingsService, DocType } from './core.services';
import { BosDocumentsService, DocInput } from './documents.service';
import { BosPaymentsService } from './payments.service';
import { BosCounterService, BosExpensesService, BosOrderBridge } from './flows.service';
import { BosPartiesService, BosPayNowService, BosStockViewsService, BosJobsService } from './more.services';
import { BosReportsService, parseRange, periodFor } from './reports.service';
import { BosCaPackService } from './export/ca-pack.service';
import { renderDocumentHtml } from './export/render';
import { EntitlementsService, RequireCapability } from './entitlements.service';
import { EXPENSE_HEADS, DEFAULT_ACCOUNTS } from './chart';
import {
  ApplyAdvanceDto, ConvertDto, CounterSaleDto, CreditNoteDto, DocDto, ExpenseDto, ItemCostDto, LocationDto, LockDto, PartyDto, PaymentDto, QuoteStatusDto, ReasonDto, RecurringDto, SettingsDto, TransferDto, UpdateDocDto, UpdatePartyDto,
} from './dto';

const SALES_TYPES: DocType[] = ['QUOTE', 'SALES_ORDER', 'SALES_INVOICE', 'CREDIT_NOTE'];

function toInput(dto: DocDto): DocInput { const { issue: _i, ...rest } = dto; void _i; return rest as DocInput; }

/** Quotes, sales orders, invoices, credit notes, receipts, outstanding, counter billing, expenses, settings, parties: available on EVERY plan. */
@ApiTags('bos')
@ApiBearerAuth()
@RequireModule('accounts')
@Controller('bos')
export class BosController {
  constructor(
    private readonly prisma: PrismaService, private readonly settings: BosSettingsService, private readonly docs: BosDocumentsService, private readonly payments: BosPaymentsService,
    private readonly counter: BosCounterService, private readonly expenses: BosExpensesService, private readonly bridge: BosOrderBridge, private readonly parties: BosPartiesService,
    private readonly reports: BosReportsService, private readonly ent: EntitlementsService,
  ) {}

  // — settings —
  @Get('settings')
  @ApiOperation({ summary: "The vendor's BOS settings (GST, state, prefixes, stock policy)" })
  async getSettings(@CurrentUser() u: AuthenticatedUser) { const s = await this.settings.get(u.sub); return { ...s, accountHeads: DEFAULT_ACCOUNTS.length }; }

  @Put('settings')
  @ApiOperation({ summary: 'Change BOS settings' })
  updateSettings(@CurrentUser() u: AuthenticatedUser, @Body() dto: SettingsDto) { return this.settings.update(u.sub, dto as never); }

  @Put('settings/lock')
  @RequireCapability('bos.period-lock')
  @ApiOperation({ summary: 'Lock every month up to a date (Pro)' })
  async lock(@CurrentUser() u: AuthenticatedUser, @Body() dto: LockDto) {
    await this.settings.get(u.sub);
    return this.prisma.bosSettings.update({ where: { vendorId: u.sub }, data: { lockedUntil: dto.lockedUntil ? new Date(dto.lockedUntil) : null } });
  }

  @Get('entitlements')
  @ApiOperation({ summary: 'What this vendor\'s plan switches on (the dashboard renders Locked from this)' })
  entitlements(@CurrentUser() u: AuthenticatedUser) { return this.ent.resolve(u.sub); }

  // — documents —
  @Get('documents')
  @ApiOperation({ summary: 'List quotes / orders / invoices / credit notes' })
  list(@CurrentUser() u: AuthenticatedUser, @Query('docType') docType: DocType, @Query('status') status?: string, @Query('partyId') partyId?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('search') search?: string, @Query('take') take?: string, @Query('skip') skip?: string) {
    if (!SALES_TYPES.includes(docType)) throw new BadRequestException('Choose which documents to list.');
    return this.docs.list(u.sub, { docType, status, partyId, from, to, search, take: take ? Number(take) : undefined, skip: skip ? Number(skip) : undefined });
  }

  @Post('documents')
  @ApiOperation({ summary: 'Create a quote / order / invoice / credit note (draft, or issued at once)' })
  async create(@CurrentUser() u: AuthenticatedUser, @Body() dto: DocDto) {
    if (!SALES_TYPES.includes(dto.docType)) throw new BadRequestException('Purchase bills are recorded under Purchases.');
    if (dto.issue) return this.docs.createAndIssue(u.sub, toInput(dto), { actor: u.email });
    return { doc: await this.docs.createDraft(u.sub, toInput(dto), u.email), warnings: [], replayed: false };
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'One document with its lines, payments and credit notes' })
  one(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) { return this.docs.get(u.sub, id); }

  @Put('documents/:id')
  @ApiOperation({ summary: 'Edit a draft' })
  update(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateDocDto) { return this.docs.updateDraft(u.sub, id, dto as unknown as DocInput, u.email); }

  @Delete('documents/:id')
  @ApiOperation({ summary: 'Delete a draft (an issued document is cancelled, never deleted)' })
  del(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) { return this.docs.deleteDraft(u.sub, id); }

  @Post('documents/:id/issue')
  @ApiOperation({ summary: 'Issue: gapless number, stock, books, all in one step' })
  issue(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) { return this.docs.issue(u.sub, id, { actor: u.email }); }

  @Post('documents/:id/cancel')
  @ApiOperation({ summary: 'Cancel an issued document (posts a reversal; nothing is deleted)' })
  cancel(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReasonDto) { return this.docs.cancel(u.sub, id, dto.reason, u.email); }

  @Post('documents/:id/convert')
  @ApiOperation({ summary: 'Quote to order or invoice; order to invoice' })
  async convert(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ConvertDto) {
    const draft = await this.docs.convert(u.sub, id, dto.to, u.email);
    return dto.issue ? this.docs.issue(u.sub, draft.id, { actor: u.email }) : { doc: draft, warnings: [], replayed: false };
  }

  @Post('documents/:id/status')
  @ApiOperation({ summary: 'Mark a sent quote accepted or rejected' })
  quoteStatus(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: QuoteStatusDto) { return this.docs.setQuoteStatus(u.sub, id, dto.status); }

  @Post('documents/:id/credit-note')
  @ApiOperation({ summary: 'Credit note for all or part of an invoice (returns, corrections)' })
  async creditNote(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreditNoteDto) {
    const draft = await this.docs.creditNoteFor(u.sub, id, { lines: dto.lines, reason: dto.reason, docDate: dto.docDate }, u.email);
    return dto.issue ? this.docs.issue(u.sub, draft.id, { actor: u.email }) : { doc: draft, warnings: [], replayed: false };
  }

  @Get('documents/:id/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Printable page for a document (save as PDF from the browser); ?thermal=1 for a till-roll layout' })
  async html(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Query('thermal') thermal?: string) { return this.render(u.sub, id, { thermal: thermal === '1' }); }

  @Get('documents/:id/share')
  @ApiOperation({ summary: 'The public link and a ready WhatsApp message for a document' })
  async share(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    const d = await this.docs.getRaw(u.sub, id);
    if (d.status === 'DRAFT' || !d.publicToken) throw new BadRequestException('Issue the document first, then share it.');
    const base = (process.env.FRONTEND_URL ?? 'https://get4domain.com').replace(/\/+$/, '');
    const link = `${base}/d/${d.publicToken}`;
    const party = d.partyId ? await this.prisma.contact.findFirst({ where: { id: d.partyId, vendorId: u.sub }, select: { phone: true, email: true, name: true } }) : null;
    const brand = await this.brand(u.sub);
    const text = `Hello${party?.name ? ` ${party.name}` : ''}, here is your ${d.docType === 'QUOTE' ? 'quote' : d.docType === 'CREDIT_NOTE' ? 'credit note' : 'invoice'} ${d.number} from ${brand.name} for ₹${(d.totalPaise / 100).toLocaleString('en-IN')}: ${link}`;
    const phone = (party?.phone ?? '').replace(/\D/g, '');
    return { link, text, whatsappUrl: `https://wa.me/${phone.length === 10 ? `91${phone}` : phone}?text=${encodeURIComponent(text)}`, email: party?.email ?? null };
  }

  // — counter —
  @Post('counter/sale')
  @ApiOperation({ summary: 'Counter billing: invoice + payment(s) + stock + books in one transaction' })
  sale(@CurrentUser() u: AuthenticatedUser, @Body() dto: CounterSaleDto) { return this.counter.sell(u.sub, dto, u.email); }

  @Get('counter/summary')
  @ApiOperation({ summary: "Today's counter bills by payment mode" })
  counterSummary(@CurrentUser() u: AuthenticatedUser) { return this.counter.summary(u.sub); }

  // — payments —
  @Post('payments')
  @ApiOperation({ summary: 'Record a receipt (money in) or a payment to a supplier' })
  async pay(@CurrentUser() u: AuthenticatedUser, @Body() dto: PaymentDto) {
    if (dto.kind === 'PAYMENT_OUT') await this.ent.check(u.sub, 'bos.purchases');
    const { kind, ...rest } = dto;
    return this.payments.record(u.sub, kind, rest, u.email);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Receipts and payments' })
  async listPayments(@CurrentUser() u: AuthenticatedUser, @Query('kind') kind?: 'RECEIPT' | 'PAYMENT_OUT', @Query('partyId') partyId?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('take') take?: string) {
    if (kind === 'PAYMENT_OUT') await this.ent.check(u.sub, 'bos.purchases');
    return this.payments.list(u.sub, { kind: kind ?? 'RECEIPT', partyId, from, to, take: take ? Number(take) : undefined });
  }

  @Post('payments/:id/cancel')
  @ApiOperation({ summary: 'Cancel a payment (reversal; the invoice becomes open again)' })
  cancelPay(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReasonDto) { return this.payments.cancel(u.sub, id, dto.reason); }

  @Post('payments/:id/apply')
  @ApiOperation({ summary: 'Apply an advance to invoices' })
  apply(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApplyAdvanceDto) { return this.payments.applyAdvance(u.sub, id, dto.allocations, u.email); }

  @Get('outstanding')
  @ApiOperation({ summary: 'Who owes you, with ageing (0-30, 31-60, 61-90, 90+)' })
  async outstanding(@CurrentUser() u: AuthenticatedUser, @Query('kind') kind?: 'CUSTOMER' | 'SUPPLIER') {
    if (kind === 'SUPPLIER') await this.ent.check(u.sub, 'bos.purchases');
    return this.payments.outstanding(u.sub, kind === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER');
  }

  @Get('parties/:id/statement')
  @ApiOperation({ summary: "A customer's or supplier's statement from the books" })
  statement(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) { return this.payments.statement(u.sub, id, from, to); }

  @Get('parties/:id/statement/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Printable statement' })
  async statementHtml(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    const s = await this.payments.statement(u.sub, id, from, to); const b = await this.brand(u.sub);
    const inr = (p: number): string => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const esc = (x: string): string => x.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Statement</title><style>body{font-family:Arial;max-width:760px;margin:24px auto;color:#0f172a}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #e2e8f0;text-align:left}td.r,th.r{text-align:right}</style></head><body><h2>${esc(b.name)}</h2><h3>Statement: ${esc(s.party.name)}</h3><p>Opening balance: ₹${inr(s.openingPaise)}</p><table><tr><th>Date</th><th>Type</th><th>Reference</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr>${s.rows.map((r) => `<tr><td>${r.date.toISOString().slice(0, 10)}</td><td>${esc(r.type)}</td><td>${esc(r.ref)}</td><td class="r">${r.debitPaise ? inr(r.debitPaise) : ''}</td><td class="r">${r.creditPaise ? inr(r.creditPaise) : ''}</td><td class="r">${inr(r.balancePaise)}</td></tr>`).join('')}</table><h3>Closing balance: ₹${inr(s.closingPaise)}</h3></body></html>`;
  }

  // — parties —
  @Get('parties')
  @ApiOperation({ summary: 'Customers or suppliers with what they owe / are owed' })
  async partyList(@CurrentUser() u: AuthenticatedUser, @Query('kind') kind?: 'customer' | 'supplier', @Query('search') search?: string) {
    if (kind === 'supplier') await this.ent.check(u.sub, 'bos.purchases');
    return this.parties.list(u.sub, { kind, search });
  }

  @Post('parties')
  @ApiOperation({ summary: 'Add a customer or supplier (with an opening balance if they already owe or are owed)' })
  async partyCreate(@CurrentUser() u: AuthenticatedUser, @Body() dto: PartyDto) {
    if (dto.type === 'supplier' || dto.type === 'both') await this.ent.check(u.sub, 'bos.purchases');
    return this.parties.create(u.sub, dto);
  }

  @Put('parties/:id')
  @ApiOperation({ summary: 'Edit a customer or supplier' })
  partyUpdate(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdatePartyDto) { return this.parties.update(u.sub, id, dto); }

  // — expenses —
  @Get('expense-heads')
  @ApiOperation({ summary: 'What an expense can be for' })
  heads() { return EXPENSE_HEADS.map((h) => ({ code: h.code, name: h.name })); }

  @Get('expenses')
  @ApiOperation({ summary: 'Expenses (every plan)' })
  expenseList(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string, @Query('category') category?: string) { return this.expenses.list(u.sub, { from, to, category }); }

  @Post('expenses')
  @ApiOperation({ summary: 'Record an expense (posts to the books)' })
  expenseCreate(@CurrentUser() u: AuthenticatedUser, @Body() dto: ExpenseDto) { return this.expenses.create(u.sub, dto, u.email); }

  @Post('expenses/:id/cancel')
  @ApiOperation({ summary: 'Cancel an expense (reversal)' })
  expenseCancel(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReasonDto) { return this.expenses.cancel(u.sub, id, dto.reason); }

  // — website orders —
  @Post('orders/reconcile')
  @ApiOperation({ summary: 'Create the invoices of website orders that were missed' })
  reconcile(@CurrentUser() u: AuthenticatedUser) { return this.bridge.reconcile(u.sub); }

  // — Accounts page numbers (every plan) —
  @Get('reports/summary')
  @ApiOperation({ summary: 'Sales, received, outstanding, GST collected, expenses for a period' })
  summary(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.summary(u.sub, parseRange(from, to)); }

  @Get('reports/today')
  @ApiOperation({ summary: 'Home: sales today, collected, outstanding' })
  today(@CurrentUser() u: AuthenticatedUser) { return this.reports.today(u.sub); }

  @Get('reports/sales-register')
  @ApiOperation({ summary: 'Sales register' })
  salesRegister(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.register(u.sub, 'SALES', parseRange(from, to)); }

  // — render helper —
  private async brand(vendorId: string) {
    const [v, cms] = await Promise.all([this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { businessName: true, phone: true, email: true } }), this.prisma.vendorCMS.findUnique({ where: { vendorId } })]);
    return { name: cms?.businessName || v?.businessName || 'Business', logo: cms?.logo, phone: cms?.phone ?? v?.phone, email: cms?.email ?? v?.email, address: cms?.address };
  }

  async render(vendorId: string, id: string, opts: { thermal?: boolean; payUrl?: string | null }) {
    const [d, s, brand] = await Promise.all([this.docs.getRaw(vendorId, id), this.settings.get(vendorId), this.brand(vendorId)]);
    return renderDocumentHtml(d, brand, s, opts);
  }
}

/** Purchases, suppliers, payables, input GST (Pro). Refused on Essentials with PLAN_REQUIRED; nothing is lost either way. */
@ApiTags('bos-purchases')
@ApiBearerAuth()
@RequireModule('accounts')
@RequireCapability('bos.purchases')
@Controller('bos/purchases')
export class BosPurchasesController {
  constructor(private readonly docs: BosDocumentsService) {}

  @Get() @ApiOperation({ summary: 'Purchase bills' })
  list(@CurrentUser() u: AuthenticatedUser, @Query('status') status?: string, @Query('partyId') partyId?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('search') search?: string) { return this.docs.list(u.sub, { docType: 'PURCHASE_BILL', status, partyId, from, to, search }); }

  @Post() @ApiOperation({ summary: 'Record a purchase bill (stock in, cost updated, input GST, payable)' })
  async create(@CurrentUser() u: AuthenticatedUser, @Body() dto: DocDto) {
    const input = { ...toInput(dto), docType: 'PURCHASE_BILL' as const };
    if (dto.issue) return this.docs.createAndIssue(u.sub, input, { actor: u.email });
    return { doc: await this.docs.createDraft(u.sub, input, u.email), warnings: [], replayed: false };
  }

  @Get(':id') @ApiOperation({ summary: 'One purchase bill' })
  one(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) { return this.docs.get(u.sub, id); }

  @Post(':id/issue') @ApiOperation({ summary: 'Issue a draft purchase bill' })
  issue(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) { return this.docs.issue(u.sub, id, { actor: u.email }); }

  @Post(':id/cancel') @ApiOperation({ summary: 'Cancel a purchase bill (reversal)' })
  cancel(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReasonDto) { return this.docs.cancel(u.sub, id, dto.reason, u.email); }
}

/** Stock screens. The dashboard Stock page, variants, locations (Pro), transfers (Pro), valuation (Pro). */
@ApiTags('bos-stock')
@ApiBearerAuth()
@RequireModule('website')
@Controller('bos/stock')
export class BosStockController {
  constructor(private readonly views: BosStockViewsService, private readonly reports: BosReportsService) {}

  @Get() @ApiOperation({ summary: 'Items with on-hand, low flag, cost and value ("Not tracked" when stock is not tracked)' })
  overview(@CurrentUser() u: AuthenticatedUser, @Query('search') search?: string, @Query('low') low?: string) { return this.views.overview(u.sub, { search, lowOnly: low === '1' }); }

  @Get('low') @ApiOperation({ summary: 'Items at or below their alert level' })
  low(@CurrentUser() u: AuthenticatedUser) { return this.views.low(u.sub); }

  @Get('locations') @ApiOperation({ summary: 'Stock locations' })
  locations(@CurrentUser() u: AuthenticatedUser) { return this.views.locations(u.sub); }

  @Post('locations') @RequireCapability('bos.multi-location') @ApiOperation({ summary: 'Add a stock location (Pro)' })
  addLocation(@CurrentUser() u: AuthenticatedUser, @Body() dto: LocationDto) { return this.views.addLocation(u.sub, dto.name); }

  @Post('transfer') @RequireCapability('bos.multi-location') @ApiOperation({ summary: 'Move stock between locations (Pro)' })
  transfer(@CurrentUser() u: AuthenticatedUser, @Body() dto: TransferDto) { return this.views.transfer(u.sub, dto, u.email); }

  @Get('valuation') @RequireCapability('bos.stock-valuation') @ApiOperation({ summary: 'Stock valuation at cost (Pro)' })
  valuation(@CurrentUser() u: AuthenticatedUser) { return this.reports.stockValuation(u.sub); }

  @Put('items/:id') @ApiOperation({ summary: 'HSN, GST rate and purchase price of an item' })
  item(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ItemCostDto) { return this.views.setItemFields(u.sub, id, dto); }

  @Get('items/:id') @ApiOperation({ summary: 'One item: variants, locations, history' })
  detail(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) { return this.views.detail(u.sub, id); }
}

/** The full books, GST and exports (Pro). */
@ApiTags('bos-books')
@ApiBearerAuth()
@RequireModule('accounts')
@Controller('bos/books')
export class BosBooksController {
  constructor(private readonly reports: BosReportsService, private readonly pack: BosCaPackService, private readonly payments: BosPaymentsService, private readonly jobs: BosJobsService) {}

  @Get('trial-balance') @RequireCapability('bos.books') @ApiOperation({ summary: 'Trial balance' })
  tb(@CurrentUser() u: AuthenticatedUser, @Query('to') to?: string) { return this.reports.trialBalance(u.sub, parseRange(undefined, to).to); }

  @Get('profit-and-loss') @RequireCapability('bos.books') @ApiOperation({ summary: 'Profit and loss' })
  pl(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.profitAndLoss(u.sub, parseRange(from, to)); }

  @Get('balance-sheet') @RequireCapability('bos.books') @ApiOperation({ summary: 'Balance sheet' })
  bs(@CurrentUser() u: AuthenticatedUser, @Query('to') to?: string) { return this.reports.balanceSheet(u.sub, parseRange(undefined, to).to); }

  @Get('ledger/:code') @RequireCapability('bos.books') @ApiOperation({ summary: 'Ledger of one account' })
  ledger(@CurrentUser() u: AuthenticatedUser, @Param('code') code: string, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.ledger(u.sub, code, parseRange(from, to)); }

  @Get('day-book') @RequireCapability('bos.books') @ApiOperation({ summary: 'Day book' })
  day(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.dayBook(u.sub, parseRange(from, to)); }

  @Get('item-profit') @RequireCapability('bos.books') @ApiOperation({ summary: 'Item-wise profit' })
  itemProfit(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.itemProfit(u.sub, parseRange(from, to)); }

  @Get('purchase-register') @RequireCapability('bos.purchases') @ApiOperation({ summary: 'Purchase register' })
  purchaseRegister(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.register(u.sub, 'PURCHASE', parseRange(from, to)); }

  @Get('gst-summary') @RequireCapability('bos.gst-reports') @ApiOperation({ summary: 'GSTR-1 and GSTR-3B style tables' })
  gst(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.gstSummary(u.sub, parseRange(from, to)); }

  @Get('hsn-summary') @RequireCapability('bos.gst-reports') @ApiOperation({ summary: 'HSN summary' })
  hsn(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.hsn(u.sub, parseRange(from, to)); }

  @Get('ca-pack') @RequireCapability('bos.ca-pack') @ApiOperation({ summary: 'CA pack: Excel workbook + summary + attachments list in one zip (kind=month|quarter|year|fy, value=2026-04 | 2026-Q2 | 2026 | 26-27)' })
  async caPack(@CurrentUser() u: AuthenticatedUser, @Res({ passthrough: true }) res: Response, @Query('kind') kind: 'month' | 'quarter' | 'year' | 'fy', @Query('value') value: string, @Query('format') format?: 'zip' | 'xlsx') {
    if (!['month', 'quarter', 'year', 'fy'].includes(kind) || !value) throw new BadRequestException('Choose the period: a month, a quarter, a calendar year or a financial year.');
    const range = periodFor(kind, value);
    const out = format === 'xlsx' ? await this.pack.workbook(u.sub, range) : await this.pack.pack(u.sub, range);
    res.set({ 'Content-Type': format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/zip', 'Content-Disposition': `attachment; filename="${out.filename}"` });
    return new StreamableFile(out.data);
  }

  @Get('recurring') @RequireCapability('bos.recurring') @ApiOperation({ summary: 'Recurring invoices' })
  recurring(@CurrentUser() u: AuthenticatedUser) { return this.jobs.list(u.sub); }

  @Post('recurring') @RequireCapability('bos.recurring') @ApiOperation({ summary: 'Repeat an invoice monthly / quarterly / yearly' })
  addRecurring(@CurrentUser() u: AuthenticatedUser, @Body() dto: RecurringDto) { return this.jobs.createRecurring(u.sub, dto); }

  @Post('recurring/:id/stop') @RequireCapability('bos.recurring') @ApiOperation({ summary: 'Stop a recurring invoice' })
  stop(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) { return this.jobs.stopRecurring(u.sub, id); }
}

/** The public page behind a shared link: no sign-in. The token is long and random; it shows exactly one document. */
@ApiTags('bos-public')
@Controller('public/bos')
export class BosPublicController {
  constructor(private readonly prisma: PrismaService, private readonly docs: BosDocumentsService, private readonly settings: BosSettingsService, private readonly payNow: BosPayNowService) {}

  private async load(token: string) {
    if (!token || token.length < 20) throw new BadRequestException('This link is not valid.');
    const d = await this.prisma.bosDocument.findUnique({ where: { publicToken: token }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
    if (!d || d.status === 'DRAFT') throw new BadRequestException('This link is not valid.');
    return d;
  }

  @Public()
  @Get('doc/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Public page of a shared quote / invoice / credit note' })
  async page(@Param('token') token: string, @Query('thermal') thermal?: string) {
    const d = await this.load(token);
    const [s, v, cms] = await Promise.all([this.settings.get(d.vendorId), this.prisma.vendor.findUnique({ where: { id: d.vendorId }, select: { businessName: true, phone: true, email: true } }), this.prisma.vendorCMS.findUnique({ where: { vendorId: d.vendorId } })]);
    const canPay = d.docType === 'SALES_INVOICE' && ['ISSUED', 'PART_PAID'].includes(d.status) && (await this.payNow.available(d.vendorId));
    const base = (process.env.FRONTEND_URL ?? 'https://get4domain.com').replace(/\/+$/, '');
    return renderDocumentHtml(d, { name: cms?.businessName || v?.businessName || 'Business', logo: cms?.logo, phone: cms?.phone ?? v?.phone, email: cms?.email ?? v?.email, address: cms?.address }, s, { thermal: thermal === '1', payUrl: canPay ? `${base}/d/${token}/pay` : null });
  }

  @Public()
  @Get('doc/:token/pay-info')
  @ApiOperation({ summary: 'Is online payment available, and how much is due' })
  async payInfo(@Param('token') token: string) {
    const d = await this.load(token);
    return { available: d.docType === 'SALES_INVOICE' && ['ISSUED', 'PART_PAID'].includes(d.status) && (await this.payNow.available(d.vendorId)), duePaise: Math.max(0, d.totalPaise - d.paidPaise), number: d.number };
  }

  @Public()
  @Post('doc/:token/pay-order')
  @ApiOperation({ summary: "Start a payment with the vendor's own Razorpay (the amount comes from the server)" })
  payOrder(@Param('token') token: string) { return this.payNow.createOrder(token); }

  @Public()
  @Post('doc/:token/pay-confirm')
  @ApiOperation({ summary: 'Confirm a captured payment and record the receipt' })
  payConfirm(@Param('token') token: string, @Body() body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    if (!body?.razorpayOrderId || !body?.razorpayPaymentId || !body?.razorpaySignature) throw new BadRequestException('Payment details are missing.');
    return this.payNow.confirm(token, body);
  }
}
