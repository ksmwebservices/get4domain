import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Actor } from '../../plans/admin/audit.service';
import { mailError } from '../mail.errors';
import { LANE_KEYS, MailboxPriceFacts, PriceStatus, lanePromotionAllowed, priceReady } from './core/mail-rules-core';
import { MailRulesSettingsService, promoLimitsOf } from './mail-rules-settings';

export interface LaneRow { key: string; label: string; description: string; allowsPromotion: boolean; sendingEnabled: boolean }
export interface PriceRow { id: string; key: string; kind: string; scope: string; label: string; pricePaise: number | null; includedCount: number | null; status: string; confirmedAt: Date | null; confirmedBy: string | null; confirmNote: string | null }

/** What the loader records. These are facts of Amendment 12 (the lanes) and its PROPOSED prices, which stay PENDING until the owner confirms the real cost. No timeframes and no invented numbers. */
export const SEED_LANES: ReadonlyArray<LaneRow> = [
  { key: 'SYSTEM', label: 'System mail', description: 'One-time codes, receipts and account notices from the send subdomain through the system sender. Never carries promotion.', allowsPromotion: false, sendingEnabled: false },
  { key: 'VENDOR_OFFICIAL', label: 'Business official mail', description: 'Enquiry replies, quotations and orders from the business own mailbox on its own domain. Promotional and bulk sending is not allowed from it.', allowsPromotion: false, sendingEnabled: false },
  { key: 'PROMOTIONS', label: 'Promotions', description: 'Campaigns to opted-in contacts only, from a separate promotions domain with its own sending account. Every message names the business, shows a postal address and carries a working unsubscribe link.', allowsPromotion: true, sendingEnabled: false },
];
export const SEED_PRICES: ReadonlyArray<Omit<PriceRow, 'id' | 'status' | 'confirmedAt' | 'confirmedBy' | 'confirmNote'>> = [
  { key: 'forwarding_any', kind: 'FORWARDING', scope: 'ANY', label: 'Forwarding address on the Get4Domain subdomain, any plan', pricePaise: 0, includedCount: null },
  { key: 'included_professional', kind: 'INCLUDED', scope: 'PROFESSIONAL', label: 'Mailboxes included with a custom domain, Professional', pricePaise: null, includedCount: 1 },
  { key: 'included_ecommerce', kind: 'INCLUDED', scope: 'ECOMMERCE', label: 'Mailboxes included with a custom domain, Ecommerce', pricePaise: null, includedCount: 1 },
  { key: 'addon_handyman', kind: 'ADD_ON', scope: 'HANDYMAN', label: 'A real mailbox for Handyman with a custom domain, per mailbox per month', pricePaise: 9900, includedCount: null },
  { key: 'extra_any', kind: 'EXTRA', scope: 'ANY', label: 'Each extra mailbox on any plan, per mailbox per month', pricePaise: 7900, includedCount: null },
];

/** The mail lanes, mailbox prices and promotion rules, read as data (Amendment 12 Q3 and Q4). Nothing here sends; there is no lane 2 or lane 3 sending code in this block. */
@Injectable()
export class MailRulesService {
  clock: () => Date = () => new Date();
  constructor(private readonly prisma: PrismaService, private readonly settings: MailRulesSettingsService) {}

  async overview() {
    const [lanes, prices, s] = await Promise.all([this.prisma.v3MailLane.findMany({ orderBy: { key: 'asc' } }), this.prisma.v3MailboxPrice.findMany({ orderBy: { key: 'asc' } }), this.settings.get()]);
    const order = (k: string) => LANE_KEYS.indexOf(k as never);
    return {
      lanes: lanes.sort((a, b) => order(a.key) - order(b.key)).map((l) => ({ key: l.key, label: l.label, description: l.description, allowsPromotion: l.allowsPromotion, sendingEnabled: l.sendingEnabled })),
      mailboxPrices: prices.map((p) => ({ id: p.id, key: p.key, kind: p.kind, scope: p.scope, label: p.label, pricePaise: p.pricePaise, includedCount: p.includedCount, status: p.status, confirmedAt: p.confirmedAt, confirmedBy: p.confirmedBy, confirmNote: p.confirmNote, ready: priceReady(p as MailboxPriceFacts & { status: PriceStatus }) })),
      promotionRules: { ...s, recorded: promoLimitsOf(s).perDay !== null },
      note: 'Recorded as data. Sending on lane 2 and lane 3 is not built; lane 3 stays off until counsel approves the messaging text. Mailbox prices stay PENDING until the real cost is confirmed.',
    };
  }

  /** The owner confirms a mailbox price after checking the real cost. PENDING to ACTIVE once, with a written note. */
  async confirmPrice(actor: Actor, id: string, noteIn: unknown) {
    const note = typeof noteIn === 'string' ? noteIn.replace(/\s+/g, ' ').trim() : ''; if (note.length < 5 || note.length > 300) throw mailError(400, 'MAIL_RULE_INVALID', 'A note of 5 to 300 characters is required.');
    const p = await this.prisma.v3MailboxPrice.findUnique({ where: { id: String(id).slice(0, 64) } }); if (!p) throw mailError(404, 'MAIL_RULE_NOT_FOUND', 'That price does not exist.');
    if (p.status !== 'PENDING') throw mailError(409, 'MAIL_RULE_STATE', 'That price is already confirmed.');
    if (!priceReady(p as MailboxPriceFacts & { status: PriceStatus })) throw mailError(400, 'MAIL_RULE_INVALID', 'That price does not state an amount or a count yet.');
    const done = await this.prisma.v3MailboxPrice.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'ACTIVE', confirmedAt: this.clock(), confirmedBy: actor.id ?? 'unknown', confirmNote: note } });
    if (done.count !== 1) throw mailError(409, 'MAIL_RULE_STATE', 'That price was just confirmed.');
    return { id: p.id, key: p.key, status: 'ACTIVE' };
  }

  /** Idempotent loader: creates the lanes and the proposed prices that are missing, never touches a row that exists. Returns what it created. */
  async loadSeed(apply: boolean): Promise<{ applied: boolean; lanes: string[]; prices: string[] }> {
    const haveL = new Set((await this.prisma.v3MailLane.findMany({ select: { key: true } })).map((l) => l.key)); const haveP = new Set((await this.prisma.v3MailboxPrice.findMany({ select: { key: true } })).map((p) => p.key));
    const lanes = SEED_LANES.filter((l) => !haveL.has(l.key)); const prices = SEED_PRICES.filter((p) => !haveP.has(p.key));
    for (const l of SEED_LANES) if (lanePromotionAllowed(l.key as never) !== l.allowsPromotion) throw new Error(`lane ${l.key}: promotion flag disagrees with the hard rule`);
    if (apply) {
      if (lanes.length) await this.prisma.v3MailLane.createMany({ data: lanes.map((l) => ({ ...l })), skipDuplicates: true });
      if (prices.length) await this.prisma.v3MailboxPrice.createMany({ data: prices.map((p) => ({ ...p, status: 'PENDING' })), skipDuplicates: true });
    }
    return { applied: apply, lanes: lanes.map((l) => l.key), prices: prices.map((p) => p.key) };
  }
}
