import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Invoice, Lead, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateDomainCampaignEnquiryDto } from './dto/create-enquiry.dto';
import { RecordDomainCampaignSpendDto } from './dto/record-spend.dto';
import { DC_BRACKET_1_FEE_PAISE, DC_BRACKET_LABEL, dcBracketFee, dcBracketFor, dcResolveFee } from './domain-campaign-fee';

export interface DomainCampaignRecordRow {
  id: string;
  vendorId: string;
  month: string;
  adSpendPaise: number;
  feePaise: number;
  isCustomFee: boolean;
  invoiceId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DomainCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly invoicesService: InvoicesService,
  ) {}

  /** PRD §88 bracket fee for a month's ad spend (see domain-campaign-fee.ts). */
  calculateFee(adSpendPaise: number): number {
    return dcBracketFee(adSpendPaise);
  }

  /**
   * Public "Get Started" enquiry (and the dashboard "Add DomainCampaign" CTA,
   * which calls this same endpoint pre-filled with the vendor's own details).
   * Recorded on the existing leads pipeline, tagged source: 'domain-campaign'
   * — same pattern as managed-services.service.ts's createEnquiry(). When
   * dto.vendorId is set (dashboard CTA only), it's recorded in the lead's
   * notes so admin staff can see this is an existing paying vendor, not a
   * cold lead.
   */
  async createEnquiry(dto: CreateDomainCampaignEnquiryDto): Promise<{ queued: boolean; leadId: string }> {
    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
        business: dto.business,
        industry: 'domain-campaign',
        interest: 'DomainCampaign — managed paid ads & organic growth',
        source: 'domain-campaign',
        status: 'pending',
        message: dto.message ?? null,
        notes: dto.vendorId ? `Existing vendor — ID: ${dto.vendorId}` : null,
      },
    });

    await this.emailService.sendAdminNotification(
      'New DomainCampaign enquiry',
      `${dto.name} (${dto.business}) — ${dto.phone}${dto.email ? `, ${dto.email}` : ''} wants DomainCampaign.${dto.vendorId ? ' Existing vendor.' : ''}${dto.message ? ` Message: ${dto.message}` : ''}`,
    );
    await this.notificationsService.notifyAdmin(
      'domain_campaign_enquiry',
      'DomainCampaign enquiry',
      `${dto.name} (${dto.business}) wants managed paid ads & growth.`,
      { priority: 'HIGH', actionRequired: true, actionType: 'view_lead', actionData: { leadId: lead.id } },
    );

    return { queued: true, leadId: lead.id };
  }

  async listLeads(): Promise<Lead[]> {
    return this.prisma.lead.findMany({ where: { source: 'domain-campaign' }, orderBy: { createdAt: 'desc' } });
  }

  /**
   * Client status is a Subscription row with product: DOMAIN_CAMPAIGN (that
   * enum value existed, unused, before this dispatch) — idempotent, returns
   * the existing row if the vendor is already a client. `amount` is a
   * nominal placeholder (the entry-bracket fee); the real monthly fee lives on
   * DomainCampaignRecord, since it varies by ad spend bracket.
   */
  async addClient(vendorId: string): Promise<Subscription> {
    const existing = await this.prisma.subscription.findFirst({ where: { vendorId, product: 'DOMAIN_CAMPAIGN' } });
    if (existing) return existing;
    return this.prisma.subscription.create({
      data: { vendorId, product: 'DOMAIN_CAMPAIGN', plan: 'STARTUP', amount: DC_BRACKET_1_FEE_PAISE, status: 'ACTIVE', startDate: new Date() },
    });
  }

  async listClients(): Promise<(Subscription & { vendor: { businessName: string; name: string; email: string } })[]> {
    return this.prisma.subscription.findMany({
      where: { product: 'DOMAIN_CAMPAIGN' },
      include: { vendor: { select: { businessName: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── DomainCampaignRecord — parameterized raw SQL: the Prisma Client has no
  // typed accessor for this model yet (client not regenerated for it). The SQL
  // matches schema.prisma exactly, so it can be swapped for
  // `this.prisma.domainCampaignRecord.*` after `npx prisma generate` with no
  // behavior change. DEPLOY ORDER: the isCustomFee column (migration
  // 20261002120000_domain_campaign_custom_fee) must be applied BEFORE this code
  // is deployed, otherwise recordSpend fails with "column does not exist".

  async recordSpend(dto: RecordDomainCampaignSpendDto): Promise<DomainCampaignRecordRow> {
    const isCustomFee = dto.isCustomFee === true;
    let feePaise: number;
    try {
      feePaise = dcResolveFee(dto.adSpendPaise, isCustomFee, dto.customFeePaise);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid fee');
    }
    const id = crypto.randomUUID();
    const rows = await this.prisma.$queryRawUnsafe<DomainCampaignRecordRow[]>(
      `INSERT INTO "g4d_domain_campaign_records" ("id","vendorId","month","adSpendPaise","feePaise","isCustomFee","notes","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
       ON CONFLICT ("vendorId","month") DO UPDATE SET "adSpendPaise"=EXCLUDED."adSpendPaise", "feePaise"=EXCLUDED."feePaise", "isCustomFee"=EXCLUDED."isCustomFee", "notes"=EXCLUDED."notes", "updatedAt"=now()
       RETURNING *;`,
      id, dto.vendorId, dto.month, dto.adSpendPaise, feePaise, isCustomFee, dto.notes ?? null,
    );
    return rows[0];
  }

  async getBillingHistory(vendorId: string): Promise<DomainCampaignRecordRow[]> {
    return this.prisma.$queryRawUnsafe<DomainCampaignRecordRow[]>(
      `SELECT * FROM "g4d_domain_campaign_records" WHERE "vendorId" = $1 ORDER BY "month" DESC;`,
      vendorId,
    );
  }

  async getAllRecords(): Promise<DomainCampaignRecordRow[]> {
    return this.prisma.$queryRawUnsafe<DomainCampaignRecordRow[]>(
      `SELECT * FROM "g4d_domain_campaign_records" ORDER BY "month" DESC, "createdAt" DESC;`,
    );
  }

  private async getRecord(recordId: string): Promise<DomainCampaignRecordRow> {
    const rows = await this.prisma.$queryRawUnsafe<DomainCampaignRecordRow[]>(
      `SELECT * FROM "g4d_domain_campaign_records" WHERE "id" = $1;`,
      recordId,
    );
    if (!rows[0]) throw new NotFoundException('DomainCampaign record not found');
    return rows[0];
  }

  /**
   * Generate the monthly invoice/statement for a recorded spend, reusing the
   * platform's existing generic invoice-generation path (InvoicesService.
   * createInvoice — same one every other admin-raised invoice uses) rather
   * than building a parallel system. The description spells out the
   * calculation transparently (spend, which bracket applied, or custom fee).
   */
  async generateInvoice(recordId: string): Promise<Invoice> {
    const record = await this.getRecord(recordId);
    const sub = await this.prisma.subscription.findFirst({ where: { vendorId: record.vendorId, product: 'DOMAIN_CAMPAIGN' } });

    const spendRupees = (record.adSpendPaise / 100).toLocaleString('en-IN');
    const feeRupees = (record.feePaise / 100).toLocaleString('en-IN');
    const calcNote = record.isCustomFee
      ? `ad spend ₹${spendRupees}; custom Enterprise/multi-brand fee ₹${feeRupees}`
      : `ad spend ₹${spendRupees} — ${DC_BRACKET_LABEL[dcBracketFor(record.adSpendPaise)]} bracket, ₹${feeRupees} management fee`;
    const description = `DomainCampaign — ${record.month} management fee (${calcNote})`;

    const invoice = await this.invoicesService.createInvoice({
      vendorId: record.vendorId,
      subscriptionId: sub?.id,
      description,
      amount: record.feePaise,
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE "g4d_domain_campaign_records" SET "invoiceId" = $1, "updatedAt" = now() WHERE "id" = $2;`,
      invoice.id, record.id,
    );

    return invoice;
  }
}
