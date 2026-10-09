'use client';

// The LeadSpace app's data shapes and one thin client. Money is always whole paise; the server decides every price, limit and rule.
import { bos } from '@/bos/client';

export const ls = bos;

export const EVENT_LABEL: Record<string, string> = { ENQUIRY: 'Enquiries', BOOKING: 'Bookings', APPOINTMENT: 'Appointments', SITE_VISIT: 'Site visits', CART_ORDER: 'Orders' };
export const EVENT_ONE: Record<string, string> = { ENQUIRY: 'Enquiry', BOOKING: 'Booking', APPOINTMENT: 'Appointment', SITE_VISIT: 'Site visit', CART_ORDER: 'Order' };
export const STATUS_LABEL: Record<string, string> = { HELD: 'Waiting', DELIVERED: 'New', CONTACTED: 'Contacted', WON: 'Won', LOST: 'Lost', DISPUTED: 'Under review', CREDITED: 'Credited' };

export interface Summary {
  today: number; last7: number; last30: number; held: number; won: number; contacted: number; delivered: number; spentLast30Paise: number; pageViews: number; balancePaise: number;
  page: { status: string; verificationStatus: string; lowBalanceMode: string; slug: string } | null;
}
export interface LeadRow {
  id: string; type: string; typeLabel: string; status: string; held: boolean; customerName: string; customerPhone: string; summary: string; payload: Record<string, unknown> | null;
  priceChargedPaise: number; orderDecision: string | null; vendorNote: string | null; source: string | null; createdAt: string; deliveredAt: string | null; disputeStatus?: string | null;
}
export interface LedgerRow { id: string; type: 'CREDIT' | 'DEBIT'; amountPaise: number; balanceAfter: number; reason: string; note: string | null; createdAt: string }
export interface WalletData {
  balancePaise: number; held: number; ledger: LedgerRow[]; prices: Record<string, number | null>; lowBalanceMode: 'HOLD' | 'REJECT';
  lowBalanceThresholdsPaise: number[]; expiryMonths: number; refundWindowMonths: number; disputeWindowHours: number;
}
export interface Pack { id: string; label: string; payPaise: number; creditPaise: number; gstMode: 'INCLUSIVE' | 'EXCLUSIVE'; quote: { gstPaise: number; chargePaise: number } }
export interface PacksData { packs: Pack[]; custom: { minPaise: number; maxPaise: number; creditPercent: number; gstMode: 'INCLUSIVE' | 'EXCLUSIVE' } }
export interface Receipt { at: string; creditPaise: number; paidRef: string | null; invoiceId: string | null; invoiceNumber: string | null; totalPaise: number | null; balanceAfter: number }
export interface Category { id: string; label: string; goal: string; regulated?: string; blurb: string }
export interface ServiceItem { name: string; price?: number | string | null; description?: string | null; image?: string | null }
export interface Profile {
  id: string; slug: string; category: string; city: string; goal: string; mode: string; businessName: string; tagline: string | null; about: string | null; address: string | null; mapsLink: string | null;
  heroImage: string | null; services: ServiceItem[]; offer: { headline?: string; text?: string; validUntil?: string | null } | null; faqs: { q: string; a: string }[] | null; hours: string | null;
  serviceArea: string | null; existingPageUrl: string | null; reraNumber: string | null; verificationStatus: string; status: string; noindex: boolean; promotionEnabled: boolean; alertWhatsapp: string | null; suspendedReason: string | null;
}
export interface PageData {
  profile: Profile; url: string; embed: string; checklist: { done: boolean; text: string }[]; promotion: { allowed: boolean; reason: string | null }; categories: Category[];
  preview: { primaryButton: string; form: { fields: { key: string; label: string }[] }; disclaimer: string | null };
}
export interface PromoteJob { id: string; channel: string; scheduledFor: string; status: string; caption: string; postUrl: string | null; results: Record<string, unknown> | null }
export interface PromoteData {
  on: boolean; status: string; killSwitch: boolean; canTurnOn: boolean; whyNot: string | null; channels: string[]; perWeek: number; offer: string | null; manualUntil: string | null; autoApprove: boolean;
  upcoming: PromoteJob[]; posted: PromoteJob[];
}

export const PROMO_CHANNEL_LABEL: Record<string, string> = { FACEBOOK_PAGE: 'Facebook Page', INSTAGRAM: 'Instagram', TELEGRAM: 'Telegram channel', GOOGLE_BUSINESS: 'Google Business Profile', FACEBOOK_GROUPS: 'Facebook Groups (by our team)' };
export const JOB_STATUS_LABEL: Record<string, string> = { AWAITING_APPROVAL: 'Waiting for our team to approve', APPROVED: 'Approved', SCHEDULED: 'Scheduled', POSTED: 'Posted', FAILED: 'Could not be posted', SKIPPED: 'Skipped', DRAFT: 'Draft' };

/** A phone number the vendor can tap: only digits, with the country code. */
export const telHref = (phone: string): string => `tel:+91${phone.replace(/\D/g, '').slice(-10)}`;
export const waHref = (phone: string, text?: string): string => `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const ago = (iso: string): string => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};
