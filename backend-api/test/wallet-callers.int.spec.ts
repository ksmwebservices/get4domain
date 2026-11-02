// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AiService } from '../src/ai/ai.service';
import { CampaignPagesService } from '../src/campaign-pages/campaign-pages.service';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { InvoicesService } from '../src/invoices/invoices.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { WhatsAppService } from '../src/notifications/whatsapp.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { WalletService } from '../src/wallet/wallet.service';
import { cleanupTenants, newPrisma, seedBareVendor, seedWallet } from './support/fixtures';

/**
 * The two callers that had money-handling defects:
 *  - POST /campaigns/:id/approve debited the wallet with no status guard (approve twice = charged twice, in parallel too)
 *  - the lead WhatsApp alert debited BEFORE sending and never refunded, so a vendor was charged for every lead even when
 *    WhatsApp is not configured (WhatsAppService.sendTemplate returns false then).
 * Real services and a real staging database; only the outside world (admin notification, the WhatsApp send) is a stub.
 */
describe('wallet callers (staging database)', () => {
  let prisma: PrismaClient;
  let wallet: WalletService;
  let campaigns: CampaignsService;
  let pages: CampaignPagesService;
  let seq = 0;
  const notifyAdmin = jest.fn();
  const notifyVendor = jest.fn();
  const sendTemplate = jest.fn();

  const newVendor = async (balance: number) => {
    seq += 1;
    const v = await seedBareVendor(prisma, `c${seq}`, RUN_ID);
    await seedWallet(prisma, v.vendorId, balance);
    return v.vendorId;
  };
  const balance = async (vendorId: string) => (await prisma.wallet.findUniqueOrThrow({ where: { vendorId } })).balance;
  const debits = (vendorId: string, service: string) => prisma.walletTransaction.count({ where: { vendorId, service, type: 'debit' } });

  beforeAll(async () => {
    prisma = newPrisma();
    process.env.RAZORPAY_KEY_ID = ['rzp', 'test', 'notarealkey0001'].join('_');     // dummy: constructing WalletService needs one; never used
    process.env.RAZORPAY_KEY_SECRET = 'not-a-real-secret-never-used';
    const db = prisma as unknown as PrismaService;
    wallet = new WalletService(db, {} as InvoicesService);
    campaigns = new CampaignsService(db, wallet, { notifyAdmin } as unknown as NotificationsService);
    pages = new CampaignPagesService(
      db, wallet, { sendTemplate } as unknown as WhatsAppService, { notifyVendor } as unknown as NotificationsService, {} as AiService,
    );
  }, 60000);

  beforeEach(() => { notifyAdmin.mockReset(); notifyVendor.mockReset(); sendTemplate.mockReset(); });
  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await prisma?.$disconnect(); }
  }, 120000);

  describe('POST /campaigns/:id/approve', () => {
    const newCampaign = (vendorId: string, walletCost: number, status = 'pending_approval') =>
      prisma.campaign.create({ data: { vendorId, name: 'V3TEST campaign', channels: ['whatsapp'], content: {}, walletCost, status } });

    it('5 parallel approvals of one campaign: exactly one succeeds, the wallet is debited once, the others are 409', async () => {
      const vendorId = await newVendor(100);
      const c = await newCampaign(vendorId, 40);
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => campaigns.approve(c.id, vendorId)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(ok).toBe(1);
      for (const r of rejected) expect(r.reason).toBeInstanceOf(ConflictException);
      expect(await balance(vendorId)).toBe(60);
      expect(await debits(vendorId, 'campaign_approval')).toBe(1);
      expect((await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('approved');
      expect(notifyAdmin).toHaveBeenCalledTimes(1);
    }, 120000);

    it('approving an already-approved campaign is a 409 and charges nothing', async () => {
      const vendorId = await newVendor(100);
      const c = await newCampaign(vendorId, 40);
      await campaigns.approve(c.id, vendorId);
      await expect(campaigns.approve(c.id, vendorId)).rejects.toBeInstanceOf(ConflictException);
      expect(await balance(vendorId)).toBe(60);
      expect(await debits(vendorId, 'campaign_approval')).toBe(1);
    }, 60000);

    it('a campaign that is not waiting for approval cannot be approved', async () => {
      const vendorId = await newVendor(100);
      const c = await newCampaign(vendorId, 40, 'draft');
      await expect(campaigns.approve(c.id, vendorId)).rejects.toBeInstanceOf(ConflictException);
      expect(await balance(vendorId)).toBe(100);
    }, 60000);

    it('not enough balance: refused, the wallet is untouched and the campaign stays pending (no half-done approval)', async () => {
      const vendorId = await newVendor(10);
      const c = await newCampaign(vendorId, 40);
      await expect(campaigns.approve(c.id, vendorId)).rejects.toThrow('INSUFFICIENT_WALLET_BALANCE');
      expect(await balance(vendorId)).toBe(10);
      expect((await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('pending_approval');
      expect(notifyAdmin).not.toHaveBeenCalled();
    }, 60000);

    it('a free campaign (cost 0) still approves, with no debit row', async () => {
      const vendorId = await newVendor(0);
      const c = await newCampaign(vendorId, 0);
      const approved = await campaigns.approve(c.id, vendorId);
      expect(approved.status).toBe('approved');
      expect(await debits(vendorId, 'campaign_approval')).toBe(0);
    }, 60000);

    it("another vendor's campaign is still 403, and charges nobody", async () => {
      const owner = await newVendor(100);
      const other = await newVendor(100);
      const c = await newCampaign(owner, 40);
      await expect(campaigns.approve(c.id, other)).rejects.toBeInstanceOf(ForbiddenException);
      expect(await balance(owner)).toBe(100);
      expect(await balance(other)).toBe(100);
    }, 60000);
  });

  describe('lead WhatsApp alert (₹1)', () => {
    const newPage = async (vendorId: string) =>
      prisma.campaignPage.create({
        data: { vendorId, slug: `v3t-${RUN_ID}-${++seq}`, title: 'V3TEST page', headline: 'h', benefits: [], phone: '9000000000', whatsapp: '9000000001' },
      });
    const submit = (slug: string, name = 'Asha') => pages.submitLead(slug, { name, phone: '9000000002', message: 'hi' } as never);
    const alert = (vendorId: string, leadId: string) =>
      (pages as unknown as { alertVendorByWhatsApp: (...a: unknown[]) => Promise<void> }).alertVendorByWhatsApp(vendorId, '9000000001', 'Asha', '9000000002', leadId);

    it('send succeeded: charged exactly once', async () => {
      const vendorId = await newVendor(500);
      const page = await newPage(vendorId);
      sendTemplate.mockResolvedValue(true);
      await submit(page.slug);
      expect(sendTemplate).toHaveBeenCalledTimes(1);
      expect(await balance(vendorId)).toBe(400);
      expect(await debits(vendorId, 'lead_wa_alert')).toBe(1);
    }, 60000);

    it('send reported failure (WhatsApp not configured returns false): NOT charged', async () => {
      const vendorId = await newVendor(500);
      const page = await newPage(vendorId);
      sendTemplate.mockResolvedValue(false);
      await submit(page.slug);
      expect(await balance(vendorId)).toBe(500);
      expect(await debits(vendorId, 'lead_wa_alert')).toBe(0);
    }, 60000);

    it('send threw: NOT charged, and the lead is still saved', async () => {
      const vendorId = await newVendor(500);
      const page = await newPage(vendorId);
      sendTemplate.mockRejectedValue(new Error('provider down'));
      await expect(submit(page.slug)).resolves.toEqual({ success: true });
      expect(await balance(vendorId)).toBe(500);
      expect(await prisma.campaignLead.count({ where: { vendorId } })).toBe(1);
    }, 60000);

    it('not enough balance for the alert: no message is sent and nothing is debited', async () => {
      const vendorId = await newVendor(50);
      const page = await newPage(vendorId);
      sendTemplate.mockResolvedValue(true);
      await submit(page.slug);
      expect(sendTemplate).not.toHaveBeenCalled();
      expect(await balance(vendorId)).toBe(50);
    }, 60000);

    it('the same lead alerted twice (a retry) is charged once', async () => {
      const vendorId = await newVendor(500);
      const page = await newPage(vendorId);
      sendTemplate.mockResolvedValue(true);
      const lead = await prisma.campaignLead.create({ data: { vendorId, campaignPageId: page.id, name: 'Asha', phone: '9000000002', source: 'campaign_page' } });
      await alert(vendorId, lead.id);
      await alert(vendorId, lead.id);
      expect(await debits(vendorId, 'lead_wa_alert')).toBe(1);
      expect(await balance(vendorId)).toBe(400);
    }, 60000);

    it('the lead is saved and the vendor notified even when everything about the alert fails', async () => {
      const vendorId = await newVendor(0);
      const page = await newPage(vendorId);
      sendTemplate.mockRejectedValue(new Error('x'));
      await submit(page.slug);
      expect(notifyVendor).toHaveBeenCalledTimes(1);
      expect(await prisma.campaignLead.count({ where: { vendorId } })).toBe(1);
    }, 60000);
  });

  it('sanity: BadRequestException is what an insufficient balance throws', async () => {
    const vendorId = await newVendor(1);
    await expect(wallet.deduct(vendorId, 5, 'x', 'test_sanity')).rejects.toBeInstanceOf(BadRequestException);
  }, 60000);
});
