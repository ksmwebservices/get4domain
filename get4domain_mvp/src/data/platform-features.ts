/**
 * Single source of truth for the customer-facing feature story: what the platform does
 * (CAPABILITIES) and which product includes what (buildMatrix). Home, Features, Pricing and
 * Industries all render from here so the pages can never drift apart.
 *
 * Tier boundaries follow the 01-Oct-2026 plan definitions: Workspace = website + CRM/TeleCRM +
 * auto-bot + invoicing/expenses + growth bundle; BOS = Workspace + WhatsApp bot reply, task
 * management, full accounting (P&L, GSTR), HRM and inventory. Numbers that vary by plan come
 * from the live PlanTerm objects.
 */
import type { PlanTerm } from '@/lib/pricing';

export interface Capability {
  id: string;
  title: string;
  description: string;
  /** lucide icon name, resolved by the renderer */
  icon: string;
  details: string[];
  /** 'Included' unless it draws from the pay-per-use wallet. */
  billing: 'Included' | 'Included + pay-per-use';
}

export const CAPABILITIES: Capability[] = [
  { id: 'crm', icon: 'Users', title: 'CRM, TeleCRM & lead capture', billing: 'Included',
    description: 'Every enquiry from your website, WhatsApp and calls lands in one pipeline — with calling, follow-ups and full customer history.',
    details: ['Lead pipeline (Kanban)', 'TeleCRM call queue & call records', 'Follow-up reminders', 'Website lead-capture forms'] },
  { id: 'comms', icon: 'MessageCircle', title: 'Auto-bot & Communication Hub', billing: 'Included + pay-per-use',
    description: 'A website auto-bot replies to visitors instantly, and one inbox runs your WhatsApp, SMS and email conversations and campaigns.',
    details: ['Website auto-bot reply', 'WhatsApp Business API (no monthly platform fee)', 'Transactional & promotional SMS', 'Email campaigns & newsletters'] },
  { id: 'accounting', icon: 'Receipt', title: 'Accounting & GST', billing: 'Included',
    description: 'GST invoices, expenses and a live profit-and-loss — with GSTR filing tracked so nothing is missed at return time.',
    details: ['GST invoicing & receipts', 'Expense tracking with GST', 'Profit & loss statement', 'GSTR filing & due-date tracking'] },
  { id: 'hrm', icon: 'UserCog', title: 'HRM', billing: 'Included',
    description: 'Run your team from the same dashboard — staff records, attendance and payroll without a separate HR tool.',
    details: ['Staff records & roles', 'Attendance tracking', 'Payroll', 'Team access with permissions'] },
  { id: 'inventory', icon: 'Boxes', title: 'Inventory management', billing: 'Included',
    description: 'Know what you have, what is selling and what to reorder — stock moves with every sale and order.',
    details: ['Stock levels & reorder alerts', 'Products & services catalog', 'POS and online-order stock updates', 'Stock value at a glance'] },
  { id: 'ai', icon: 'Bot', title: 'AI Studio', billing: 'Included + pay-per-use',
    description: 'Create marketing content, images and blog articles in seconds — written and designed for your business and industry.',
    details: ['Content & captions', 'Images, posters & reels', 'Blog writing', 'One-time AI Studio credit with every plan'] },
  { id: 'seo', icon: 'Search', title: 'SEO, GEO & AEO', billing: 'Included',
    description: 'Get found on Google, in local search and in AI answers — keyword and meta tag/description optimization for the keywords you choose.',
    details: ['Keyword optimization', 'Meta title & description optimization', 'Local (GEO) visibility', 'Answer-engine (AEO) optimization'] },
  { id: 'google', icon: 'MapPin', title: 'Google Business Profile, Analytics & Search Console', billing: 'Included',
    description: 'Your Google presence set up and connected — listing, traffic analytics and search performance in one place.',
    details: ['Google Business Profile listing', 'Google Analytics', 'Google Search Console', 'Directory listings'] },
  { id: 'backlinks', icon: 'Link2', title: 'Backlinks & off-page SEO', billing: 'Included',
    description: 'Authority-building links and listings that lift your rankings beyond your own website.',
    details: ['Backlink building', 'Directory & listing submissions', 'Off-page SEO', 'Ongoing authority growth'] },
  { id: 'social', icon: 'Share2', title: 'Social media management & posting', billing: 'Included + pay-per-use',
    description: 'Plan, create and publish to your social pages — from one calendar, with posts drafted by AI.',
    details: ['Post & festival-poster creation', 'Scheduling & publishing', 'Social profile management', 'Campaign landing pages'] },
  { id: 'pwa', icon: 'Smartphone', title: 'PWA & mobile apps', billing: 'Included',
    description: 'Your business and your customers get installable apps that work like native mobile apps — no app-store wait.',
    details: ['Vendor app on your phone', 'Client app for booking, ordering & paying', 'Push notifications', 'Works from any phone'] },
  { id: 'themes', icon: 'Palette', title: 'Theme & website customization', billing: 'Included',
    description: 'A professional industry website live in 24 hours, then customized to your brand — colours, layout, content and sections.',
    details: ['Ready-made industry templates', 'Brand colours, fonts & layout', 'Content & product management (CMS)', 'Free subdomain, hosting & SSL'] },
];

export type Cell = boolean | string;
export interface MatrixRow { feature: string; ws: Cell; bos: Cell; dc: Cell; ms: Cell }
export interface MatrixGroup { title: string; rows: MatrixRow[] }

const BUILD = 'Custom build';

/** Workspace | BOS | DomainCampaign | Managed Services. `false` renders a dash. */
export function buildMatrix(ws: PlanTerm, bos: PlanTerm, fmt: (n: number) => string): MatrixGroup[] {
  return [
    {
      title: 'Website & apps',
      rows: [
        { feature: 'Industry website, hosting & SSL', ws: true, bos: true, dc: false, ms: 'Custom web app' },
        { feature: 'Theme & website customization', ws: `${ws.themeChangesPerYear} changes/yr`, bos: `${bos.themeChangesPerYear} changes/yr`, dc: false, ms: 'Fully custom' },
        { feature: 'PWA — installable on any phone', ws: true, bos: true, dc: false, ms: true },
        { feature: 'Mobile apps', ws: 'PWA', bos: 'PWA', dc: false, ms: 'Native iOS & Android' },
        { feature: 'Live in 24 hours', ws: true, bos: true, dc: false, ms: false },
      ],
    },
    {
      title: 'CRM & communication',
      rows: [
        { feature: 'CRM & lead capture', ws: true, bos: true, dc: false, ms: BUILD },
        { feature: 'TeleCRM — call queue & follow-ups', ws: true, bos: true, dc: false, ms: BUILD },
        { feature: 'Website auto-bot reply', ws: true, bos: true, dc: false, ms: false },
        { feature: 'WhatsApp bot reply', ws: false, bos: true, dc: false, ms: false },
        { feature: 'Communication Hub — WhatsApp, SMS & email', ws: true, bos: true, dc: false, ms: false },
      ],
    },
    {
      title: 'Accounting, HRM & inventory',
      rows: [
        { feature: 'GST invoicing', ws: true, bos: true, dc: false, ms: BUILD },
        { feature: 'Expense tracking', ws: true, bos: true, dc: false, ms: BUILD },
        { feature: 'Accounting — P&L and GSTR filing', ws: false, bos: true, dc: false, ms: BUILD },
        { feature: 'HRM — staff, attendance & payroll', ws: false, bos: true, dc: false, ms: BUILD },
        { feature: 'Inventory management', ws: false, bos: true, dc: false, ms: BUILD },
        { feature: 'Task management & assigning', ws: false, bos: true, dc: false, ms: BUILD },
        { feature: 'Team access with roles', ws: true, bos: true, dc: false, ms: false },
      ],
    },
    {
      title: 'AI, content & social',
      rows: [
        { feature: 'AI Studio — content, images & blog writing', ws: `${fmt(ws.welcomeCredit)} credit`, bos: `${fmt(bos.welcomeCredit)} credit`, dc: 'We create it', ms: 'We create it' },
        { feature: 'Social media management & posting', ws: true, bos: true, dc: true, ms: true },
      ],
    },
    {
      title: 'SEO & Google',
      rows: [
        { feature: 'SEO, GEO & AEO — keyword + meta optimization', ws: `${ws.freeSeoKeywords} keywords`, bos: `${bos.freeSeoKeywords} keywords`, dc: 'Ongoing', ms: false },
        { feature: 'Google Business Profile listing', ws: true, bos: true, dc: false, ms: false },
        { feature: 'Google Analytics & Search Console', ws: true, bos: true, dc: false, ms: false },
        { feature: 'Backlinks & off-page SEO', ws: true, bos: true, dc: true, ms: false },
        { feature: 'Analytics & reporting', ws: true, bos: true, dc: 'Monthly statement', ms: false },
      ],
    },
    {
      title: 'Done-for-you marketing & builds',
      rows: [
        { feature: 'Managed Meta & Google ads', ws: false, bos: false, dc: true, ms: true },
        { feature: 'Influencer collaboration', ws: false, bos: false, dc: false, ms: true },
        { feature: 'Commercial ad production', ws: false, bos: false, dc: false, ms: true },
        { feature: 'Custom web, mobile & CRM/ERP software', ws: false, bos: false, dc: false, ms: true },
      ],
    },
  ];
}

/** "Why Get4Domain" comparison — general positioning only, no named competitors. */
export const WHY_ROWS: { feature: string; us: string | true; builders: string; agency: string }[] = [
  { feature: 'Time to go live', us: '24 hours', builders: 'Days to weeks of DIY setup', agency: '2–6 months' },
  { feature: 'Website + CRM + invoicing in one login', us: true, builders: '3–5 separate subscriptions', agency: 'Built per project' },
  { feature: 'WhatsApp, SMS & email', us: true, builders: '₹500–2,000/mo extra', agency: '₹500–2,000/mo extra' },
  { feature: 'AI content studio', us: true, builders: '₹999+/mo separate', agency: 'Not included' },
  { feature: 'Accounting, HRM & inventory', us: true, builders: 'A separate tool for each', agency: '₹2–5L+ custom build' },
  { feature: 'SEO, GEO/AEO, Google profile & backlinks', us: true, builders: 'DIY, or a retainer', agency: 'Monthly retainer' },
  { feature: 'Industry-specific out of the box (20+)', us: true, builders: 'Generic templates', agency: 'Built from scratch' },
  { feature: 'Who keeps it running', us: 'We do — hosting, updates, support', builders: 'You do', agency: 'Extra maintenance fee' },
  { feature: 'Typical monthly cost', us: 'From ₹999', builders: '₹5,000–15,000+', agency: 'Project fee + retainer' },
];

/** DomainCampaign management-fee brackets (PRD §88; mirrors backend domain-campaign-fee.ts and /domain-campaign). */
export const CAMPAIGN_BRACKETS = [
  { range: 'Up to ₹20,000', fee: '₹2,000', example: 'Spend ₹15,000 → pay ₹2,000' },
  { range: '₹20,001 – ₹1,00,000', fee: '₹5,000', example: 'Spend ₹50,000 → pay ₹5,000' },
  { range: 'Above ₹1,00,000', fee: '₹10,000', example: 'Spend ₹1,50,000 → pay ₹10,000' },
];

/** One-line scope summaries for the done-for-you products, used where space is tight (dashboard). */
export const CAMPAIGN_SUMMARY = ['Managed Meta & Google ads', 'Content & creative management', 'SEO / GEO / AEO growth', 'Monthly spend & fee statement'];
export const MANAGED_SUMMARY = ['Custom web & mobile applications', 'Bespoke CRM / ERP / business software', 'Managed paid ads', 'Content, social media & influencer work'];

/** Matrix rows that differ between Workspace and BOS — i.e. exactly what an upgrade changes. */
export function upgradeDelta(ws: PlanTerm, bos: PlanTerm, fmt: (n: number) => string): MatrixRow[] {
  return buildMatrix(ws, bos, fmt).flatMap((g) => g.rows).filter((r) => r.ws !== r.bos);
}
