// Single source of truth for the "what's in each plan / service" lists.
// Consumed by the marketing /pricing page AND the vendor dashboard Billing page, so the
// two can never drift apart. Edit here only.

// What each annual plan includes. BOS = Workspace + the items below; HRM and
// Office management are flagged "coming soon" — they are not built yet
// (confirmed by the 01-Oct-2026 engineering audit), so BOS never claims them
// as live.
export const WORKSPACE_INCLUDED = [
  { group: 'WEBSITE', items: ['Professional industry website', 'Free subdomain (vendorname.get4domain.com)', 'Free hosting + SSL', 'Mobile responsive, SEO optimized', 'Basic CMS for content updates'] },
  { group: 'WORKPLACE', items: ['Contacts management (industry-labeled)', 'Products/Services catalog', 'Bookings/Orders/Appointments', 'GST invoicing', 'Basic expense management', 'Staff dashboard management'] },
  { group: 'CRM & TELECRM', items: ['Lead pipeline (Kanban)', 'TeleCRM with call queue', 'Follow-up reminders', 'Website auto-bot reply'] },
  { group: 'GROWTH HUB', items: ['3 free SEO keywords', 'SEO/GEO/AEO + blog + social + GMB + directory + 20 backlinks bundle', '2 theme changes/year'] },
  { group: 'AI STUDIO', items: ['₹499 one-time credit included', 'Text, images, posters, reels, documents'] },
  { group: 'TEAM & SUPPORT', items: ['Team access with roles', 'Instant AI support assistant (human callback if needed)'] },
];
export const BOS_EXTRA = [
  'Everything in Workspace',
  'WhatsApp bot reply too',
  'Task management & assigning',
  'Full GST + P&L accounting',
  'HRM — coming soon',
  'Office management — coming soon',
  '₹1,299 one-time AI Studio credit',
  '6 free SEO keywords',
  '4 theme changes/year',
];

// DomainCampaign / Managed Services — summaries only; the full pages are the source of truth.
export const CAMPAIGN_BRACKETS = [
  { range: 'Ad budget up to ₹20,000', fee: '₹2,000' },
  { range: '₹20,001 – ₹1,00,000', fee: '₹5,000' },
  { range: 'Above ₹1,00,000', fee: '₹10,000' },
];
export const CAMPAIGN_INCLUDES = ['Managed Meta & Google ads', 'Content & creative management', 'SEO / GEO / AEO growth', 'Monthly spend & fee statement'];
export const MANAGED_INCLUDES = ['Custom web & mobile applications', 'Bespoke CRM / ERP / business software', 'Managed paid ads', 'Content, social media & influencer work'];

/** True for BOS items that are on the roadmap but not built yet (never presented as live). */
export const isComingSoon = (item: string): boolean => item.includes('coming soon');
