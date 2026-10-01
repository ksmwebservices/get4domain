import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Invoice, Lead, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateDomainCampaignEnquiryDto } from './dto/create-enquiry.dto';
import { RecordDomainCampaignSpendDto } from './dto/record-spend.dto';

/** Minimum monthly fee — floor that wins whenever 10% of spend is below it. */
export const DOMAIN_CAMPAIGN_MIN_FEE_PAISE = 999900; // ₹9,999
export const DOMAIN_CAMPAIGN_FEE_RATE = 0.1;

export interface DomainCampaignRecordRow {
  id: string;
  vendorId: string;
  month: string;
  adSpendPaise: number;
  feePaise: number;
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

  /** MAX(10% of ad spend, ₹9,999) — the one place this calculation happens. */
  calculateFee(adSpendPaise: number): number {
    return Math.max(Math.round(adSpendPaise * DOMAIN_CAMPAIGN_FEE_RATE), DOMAIN_CAMPAIGN_MIN_FEE_PAISE);
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
   * nominal placeholder (the ₹9,999 floor); the real monthly fee lives on
   * DomainCampaignRecord, since it varies by ad spend.
   */
  async addClient(vendorId: string): Promise<Subscription> {
    const existing = await this.prisma.subscription.findFirst({ where: { vendorId, product: 'DOMAIN_CAMPAIGN' } });
    if (existing) return existing;
    return this.prisma.subscription.create({
      data: { vendorId, product: 'DOMAIN_CAMPAIGN', plan: 'STARTUP', amount: DOMAIN_CAMPAIGN_MIN_FEE_PAISE, status: 'ACTIVE', startDate: new Date() },
    });
  }

  async listClients(): Promise<(Subscription & { vendor: { businessName: string; name: string; email: string } })[]> {
    return this.prisma.subscription.findMany({
      where: { product: 'DOMAIN_CAMPAIGN' },
      include: { vendor: { select: { businessName: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── DomainCampaignRecord — raw SQL (table exists in the migration file but
  // is not yet applied to the live DB; `prisma generate` is also blocked this
  // session, so the Prisma Client has no typed accessor for this model yet).
  // Once KSM runs `npx prisma migrate deploy` + `npx prisma generate`, this
  // can be switched to `this.prisma.domainCampaignRecord.*` — the SQL below
  // matches the schema.prisma model exactly, so no behavior changes either way.

  async recordSpend(dto: RecordDomainCampaignSpendDto): Promise<DomainCampaignRecordRow> {
    const feePaise = this.calculateFee(dto.adSpendPaise);
    const id = crypto.randomUUID();
    const rows = await this.prisma.$queryRawUnsafe<DomainCampaignRecordRow[]>(
      `INSERT INTO "g4d_domain_campaign_records" ("id","vendorId","month","adSpendPaise","feePaise","notes","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,now(),now())
       ON CONFLICT ("vendorId","month") DO UPDATE SET "adSpendPaise"=EXCLUDED."adSpendPaise", "feePaise"=EXCLUDED."feePaise", "notes"=EXCLUDED."notes", "updatedAt"=now()
       RETURNING *;`,
      id, dto.vendorId, dto.month, dto.adSpendPaise, feePaise, dto.notes ?? null,
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
   * calculation transparently (spend, rate, whether the floor applied).
   */
  async generateInvoice(recordId: string): Promise<Invoice> {
    const record = await this.getRecord(recordId);
    const sub = await this.prisma.subscription.findFirst({ where: { vendorId: record.vendorId, product: 'DOMAIN_CAMPAIGN' } });

    const spendRupees = (record.adSpendPaise / 100).toLocaleString('en-IN');
    const pctFeePaise = Math.round(record.adSpendPaise * DOMAIN_CAMPAIGN_FEE_RATE);
    const floorApplied = pctFeePaise < DOMAIN_CAMPAIGN_MIN_FEE_PAISE;
    const calcNote = floorApplied
      ? `10% of ₹${spendRupees} = ₹${(pctFeePaise / 100).toLocaleString('en-IN')}, below the ₹9,999 minimum — ₹9,999 minimum fee applied`
      : `10% of ₹${spendRupees} ad spend`;
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
