// THE feature registry (Dashboard v2, Release 1A — KSM, 2026-10-08). Data only; logic lives in state.ts.
// To add or change a feature: edit this file, run `npm run registry:build`, commit the generated files. `npm run registry:check` is the guard.
// Rules: a feature is OPEN only if it is built (WORKING / LIMITED) AND has evidence (testId, or a manual check recorded in
// docs/v2/evidence/dashboard-v2/WALKTHROUGH.md). Anything not built or not verified is shown as Coming soon — never invented as working.
import type { Feature } from './types';

const ALL = 'all' as const;
const PRODUCT_LABELS = { COMMERCE: 'Products', APPOINTMENTS: 'Services', PACKAGES: 'Packages', SERVICES: 'Services', LISTINGS: 'Listings' } as const;
const ORDER_LABELS = { COMMERCE: 'Orders', APPOINTMENTS: 'Appointments', PACKAGES: 'Bookings', SERVICES: 'Enquiries', LISTINGS: 'Site visits' } as const;
const WALK = 'docs/v2/evidence/dashboard-v2/WALKTHROUGH.md';

export const FEATURES: Feature[] = [
  // ───────────────────────────── Home
  { id: 'home.today', department: 'home', label: 'Today', icon: 'LayoutDashboard', route: '/dashboard', purpose: 'home', minPlan: 'WORKSPACE', profiles: ALL,
    status: 'LIMITED', manualCheck: `${WALK}#home.today`, limits: 'Go-live checklist and banner are computed from live data; revenue widgets are the existing Overview.' },
  { id: 'home.reports', department: 'home', label: 'Reports', icon: 'BarChart3', route: '/dashboard/home/reports', legacyRoutes: ['/dashboard/reports'], purpose: 'reports',
    minPlan: 'BOS', profiles: ALL, status: 'UNTESTED', moduleKey: 'analytics_hub',
    upgrade: { headline: 'See how your business is doing', body: 'Cross-module reports for leads, orders and revenue.' } },

  // ───────────────────────────── Sales and CRM
  { id: 'sales.leads', department: 'sales', label: 'Leads', icon: 'Users', route: '/dashboard/sales/leads',
    legacyRoutes: [{ from: '/dashboard/crm', tab: 'board' }, { from: '/dashboard/telecrm', tab: 'queue' }], purpose: 'leads', minPlan: 'WORKSPACE', profiles: ALL,
    status: 'LIMITED', manualCheck: `${WALK}#sales.leads`, limits: 'Board and Call queue are two views of the same leads; no telephony (tap-to-call opens the phone).',
    moduleKey: 'telecrm', tabs: [{ key: 'board', label: 'Board' }, { key: 'queue', label: 'Call queue' }] },
  { id: 'sales.lead-tools', department: 'sales', label: 'Pitch scripts, assignment, sales reports', icon: 'ClipboardList', route: '/dashboard/sales/lead-tools', purpose: 'lead-tools',
    minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'sales.customers', department: 'sales', label: 'Customers', icon: 'UserCircle', route: '/dashboard/sales/customers', purpose: 'customers', minPlan: 'WORKSPACE', profiles: ALL,
    status: 'LIMITED', manualCheck: `${WALK}#sales.customers`, limits: 'One customer list per business (the editor follows your industry).', moduleKey: 'domainapp' },
  { id: 'sales.quotes', department: 'sales', label: 'Quotes', icon: 'FileText', route: '/dashboard/sales/quotes', purpose: 'quotes', minPlan: 'WORKSPACE', profiles: ALL, status: 'UNTESTED' },
  { id: 'sales.portal', department: 'sales', label: 'Customer portal', icon: 'Share2', route: '/dashboard/sales/portal', legacyRoutes: ['/dashboard/customer-hub'], purpose: 'customer-portal',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'LIMITED', manualCheck: `${WALK}#sales.portal`, limits: 'Portal invites by SMS/WhatsApp are sent only once the messaging key is set.', moduleKey: 'customer_hub' },

  // ───────────────────────────── Marketing and Growth
  { id: 'marketing.ai-studio', department: 'marketing', label: 'AI Studio', icon: 'Sparkles', route: '/dashboard/marketing/ai-studio', legacyRoutes: ['/dashboard/ai-studio'], purpose: 'ai-studio',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'LIMITED', testId: 'ai.studio.safe-generation',
    limits: 'Writes text and pictures from your wallet. Reels and video are Coming soon.' },
  { id: 'marketing.campaigns', department: 'marketing', label: 'Campaigns and landing pages', icon: 'Megaphone', route: '/dashboard/marketing/campaigns',
    legacyRoutes: [{ from: '/dashboard/campaigns', tab: 'campaigns' }, { from: '/dashboard/landing-page', tab: 'landing' }], purpose: 'campaigns', minPlan: 'BOS', profiles: ALL,
    status: 'UNTESTED', moduleKey: 'growth_hub', tabs: [{ key: 'campaigns', label: 'Campaigns' }, { key: 'landing', label: 'Landing pages' }],
    upgrade: { headline: 'Run campaigns from one place', body: 'Plan campaigns and build landing pages.' } },
  { id: 'marketing.social', department: 'marketing', label: 'Social posting', icon: 'Share2', route: '/dashboard/marketing/social', purpose: 'social-publish', minPlan: 'BOS', profiles: ALL,
    status: 'NOT_BUILT', hidden: true },
  { id: 'marketing.reviews-offers', department: 'marketing', label: 'Reviews and offers', icon: 'Star', route: '/dashboard/marketing/reviews-offers', purpose: 'reviews-offers', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },

  // ───────────────────────────── Website and Domain
  { id: 'website.content', department: 'website', label: 'Content and pages', icon: 'Globe', route: '/dashboard/website/content', legacyRoutes: ['/dashboard/my-website'], purpose: 'website-content',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'WORKING', testId: 'site.live-edit', moduleKey: 'website_manager' },
  { id: 'website.new-pages', department: 'website', label: 'Add new pages', icon: 'FileText', route: '/dashboard/website/new-pages', purpose: 'website-pages', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'website.design', department: 'website', label: 'Design and themes', icon: 'Sparkles', route: '/dashboard/website/design', purpose: 'website-design', minPlan: 'WORKSPACE', profiles: ALL,
    status: 'LIMITED', testId: 'themes.unlock', limits: 'Pick a template and logo/banner; theme changes per year follow your plan.', moduleKey: 'website_manager' },
  { id: 'website.domain', department: 'website', label: 'Domain', icon: 'Link', route: '/dashboard/website/domain', legacyRoutes: ['/dashboard/domain-management'], purpose: 'domain',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'LIMITED', manualCheck: `${WALK}#website.domain`, limits: 'Search and connect are shown; registration and DNS steps are completed by Get4Domain.' },
  { id: 'website.search', department: 'website', label: 'Search and AI visibility', icon: 'Search', route: '/dashboard/website/search', purpose: 'seo-basic', minPlan: 'WORKSPACE', profiles: ALL,
    status: 'LIMITED', manualCheck: `${WALK}#website.search`, limits: 'Title, description and keywords per page.', moduleKey: 'website_manager' },
  { id: 'website.search-pro', department: 'website', label: 'AI answers, Google tools', icon: 'Search', route: '/dashboard/website/search-pro', purpose: 'seo-pro', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'website.widget', department: 'website', label: 'Chat widget', icon: 'Code', route: '/dashboard/website/widget', legacyRoutes: ['/dashboard/embed'], purpose: 'chat-widget',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'LIMITED', manualCheck: `${WALK}#website.widget`, limits: 'Embeds your chat/enquiry widget on any website you control.', moduleKey: 'website_manager' },
  { id: 'website.readiness', department: 'website', label: 'Go-live readiness', icon: 'Rocket', route: '/dashboard/website/readiness', legacyRoutes: ['/dashboard/website-engine'], purpose: 'readiness',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'LIMITED', manualCheck: `${WALK}#website.readiness`, limits: 'The technical list of wired actions is an admin view.', moduleKey: 'website_manager' },

  // ───────────────────────────── Commerce and Operations
  { id: 'commerce.products', department: 'commerce', label: 'Products and services', labelByProfile: PRODUCT_LABELS, icon: 'Package', route: '/dashboard/commerce/products',
    legacyRoutes: ['/dashboard/my-products'], purpose: 'catalogue', minPlan: 'WORKSPACE', profiles: ALL, status: 'WORKING', testId: 'commerce.catalogue',
    moduleKey: 'website_manager',
    limits: 'Three product stores still exist (My Products, industry catalogue, retail products); they are mounted here as tabs and unified in a later release.' },
  { id: 'commerce.stock', department: 'commerce', label: 'Stock', icon: 'Boxes', route: '/dashboard/commerce/stock', legacyRoutes: ['/dashboard/stock'], purpose: 'stock', minPlan: 'WORKSPACE',
    profiles: ['COMMERCE'], status: 'WORKING', testId: 'commerce.stock.atomic', moduleKey: 'website_manager' },
  { id: 'commerce.orders', department: 'commerce', label: 'Orders, bookings, enquiries', labelByProfile: ORDER_LABELS, icon: 'ShoppingBag', route: '/dashboard/commerce/orders',
    legacyRoutes: ['/dashboard/orders'], purpose: 'orders', minPlan: 'WORKSPACE', profiles: ALL, status: 'WORKING', testId: 'commerce.orders.request', moduleKey: 'website_manager' },
  { id: 'commerce.workspace', department: 'commerce', label: 'Industry workspace', icon: 'LayoutGrid', route: '/dashboard/commerce/workspace', purpose: 'industry-workspace',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'LIMITED', manualCheck: `${WALK}#commerce.workspace`, moduleKey: 'domainapp',
    limits: 'Your industry\'s existing operation screens, with their add-on rules unchanged. The full set is Coming soon.' },
  { id: 'commerce.workspace-full', department: 'commerce', label: 'Full industry workspace', icon: 'LayoutGrid', route: '/dashboard/commerce/workspace-full', purpose: 'industry-workspace-full', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'commerce.inventory', department: 'commerce', label: 'Inventory and purchases', icon: 'Boxes', route: '/dashboard/commerce/inventory', purpose: 'inventory-purchases', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'commerce.pos', department: 'commerce', label: 'Counter and POS', icon: 'Store', route: '/dashboard/commerce/pos', purpose: 'pos', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'commerce.tasks', department: 'commerce', label: 'Tasks and workflow', icon: 'ClipboardList', route: '/dashboard/commerce/tasks', purpose: 'tasks', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'commerce.documents', department: 'commerce', label: 'Documents', icon: 'FileText', route: '/dashboard/commerce/documents', purpose: 'documents', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },

  // ───────────────────────────── Finance and Accounts
  { id: 'finance.invoices', department: 'finance', label: 'Customer invoices', icon: 'FileText', route: '/dashboard/finance/invoices', purpose: 'customer-invoices', minPlan: 'WORKSPACE', profiles: ALL,
    status: 'LIMITED', manualCheck: `${WALK}#finance.invoices`, limits: 'GST is one flat rate per invoice; invoice numbers are not yet per financial year.', moduleKey: 'domainapp' },
  { id: 'finance.collect-payments', department: 'finance', label: 'Collect payments', icon: 'CreditCard', route: '/dashboard/finance/collect-payments', purpose: 'collect-payments',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'UNTESTED' },
  { id: 'finance.recurring', department: 'finance', label: 'Recurring billing', icon: 'Receipt', route: '/dashboard/finance/recurring', purpose: 'recurring-billing', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'finance.expenses', department: 'finance', label: 'Expenses and GST', icon: 'Receipt', route: '/dashboard/finance/expenses', legacyRoutes: ['/dashboard/accounts'], purpose: 'expenses-gst',
    minPlan: 'BOS', profiles: ALL, status: 'LIMITED', manualCheck: `${WALK}#finance.expenses`, limits: 'Expense and GST tracking; accounting entries and GST filing are not built.',
    upgrade: { headline: 'Track expenses and GST', body: 'Record expenses, see profit and the GST you owe.' } },
  { id: 'finance.ca-accounts', department: 'finance', label: 'Accounts for the CA', icon: 'FileText', route: '/dashboard/finance/ca-accounts', purpose: 'ca-accounts', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },

  // ───────────────────────────── People and HR
  { id: 'people.team', department: 'people', label: 'Team and roles', icon: 'UserPlus', route: '/dashboard/people/team', legacyRoutes: ['/dashboard/team'], purpose: 'team', minPlan: 'WORKSPACE', profiles: ALL,
    status: 'WORKING', testId: 'team.area-access' },
  { id: 'people.team-pro', department: 'people', label: 'Branches, departments, audit log', icon: 'UserCog', route: '/dashboard/people/team-pro', purpose: 'team-pro', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'people.hr', department: 'people', label: 'HR and payroll', icon: 'UserCog', route: '/dashboard/people/hr', legacyRoutes: ['/dashboard/hrm'], purpose: 'hr', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },

  // ───────────────────────────── Communication
  { id: 'communication.inbox', department: 'communication', label: 'Inbox', icon: 'MessagesSquare', route: '/dashboard/communication/inbox', legacyRoutes: ['/dashboard/communication'], purpose: 'inbox',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'LIMITED', manualCheck: `${WALK}#communication.inbox`, limits: 'WhatsApp and website chat. SMS and e-mail are Coming soon.', moduleKey: 'communication_hub' },
  { id: 'communication.sms-email', department: 'communication', label: 'SMS and e-mail', icon: 'Mail', route: '/dashboard/communication/sms-email', purpose: 'sms-email', minPlan: 'WORKSPACE', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'communication.whatsapp-bot', department: 'communication', label: 'WhatsApp bot', icon: 'MessageCircle', route: '/dashboard/communication/whatsapp-bot', legacyRoutes: ['/dashboard/whatsapp-bot'],
    purpose: 'whatsapp-bot', minPlan: 'BOS', profiles: ALL, status: 'UNTESTED', moduleKey: 'communication_hub',
    upgrade: { headline: 'Answer customers on WhatsApp automatically', body: 'Replies from your own answers, with a hand-off to you.' } },
  { id: 'communication.notifications', department: 'communication', label: 'Notifications', icon: 'Bell', route: '/dashboard/communication/notifications', legacyRoutes: ['/dashboard/notifications'], purpose: 'notifications',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'WORKING', testId: 'notifications.own-only' },
  { id: 'communication.reminders', department: 'communication', label: 'Reminders and feedback', icon: 'Bell', route: '/dashboard/communication/reminders', purpose: 'reminders-feedback', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },

  // ───────────────────────────── Your Get4Domain account
  { id: 'account.billing', department: 'account', label: 'Plan and billing', icon: 'CreditCard', route: '/dashboard/account/billing',
    legacyRoutes: ['/dashboard/billing', { from: '/dashboard/go-live', tab: 'golive' }, { from: '/dashboard/my-services', tab: 'services' }, { from: '/dashboard/invoices', tab: 'receipts' }],
    purpose: 'plan-billing', minPlan: 'WORKSPACE', profiles: ALL, status: 'WORKING', testId: 'commercial.vendor-billing',
    tabs: [{ key: 'billing', label: 'Plan and invoices' }, { key: 'golive', label: 'Buy or go live' }, { key: 'services', label: 'Add-ons and services' }, { key: 'receipts', label: 'Receipts' }] },
  { id: 'account.wallet', department: 'account', label: 'Wallet', icon: 'Wallet', route: '/dashboard/account/wallet', legacyRoutes: ['/dashboard/wallet'], purpose: 'wallet', minPlan: 'WORKSPACE', profiles: ALL,
    status: 'WORKING', testId: 'wallet.topup' },
  { id: 'account.profile', department: 'account', label: 'Business profile', icon: 'Building2', route: '/dashboard/account/profile', legacyRoutes: ['/dashboard/settings'], purpose: 'business-profile',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'LIMITED', manualCheck: `${WALK}#account.profile`, limits: 'Business name, contact details and address save here; name, e-mail and password changes go through Support.' },
  { id: 'account.connections', department: 'account', label: 'Connections', icon: 'Link', route: '/dashboard/account/connections', purpose: 'connections', minPlan: 'BOS', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'account.disclosures', department: 'account', label: 'Website disclosures', icon: 'FileText', route: '/dashboard/account/disclosures', purpose: 'disclosures', minPlan: 'WORKSPACE', profiles: ALL, status: 'NOT_BUILT' },
  { id: 'account.help', department: 'account', label: 'Help and support', icon: 'HelpCircle', route: '/dashboard/account/help', legacyRoutes: ['/dashboard/support'], purpose: 'support', minPlan: 'WORKSPACE', profiles: ALL,
    status: 'LIMITED', manualCheck: `${WALK}#account.help`, limits: 'Raises a ticket; our team replies by phone or message.' },
  { id: 'account.stationery', department: 'account', label: 'Office and stationery', icon: 'Package', route: '/dashboard/account/stationery', legacyRoutes: ['/dashboard/stationery'], purpose: 'stationery',
    minPlan: 'WORKSPACE', profiles: ALL, status: 'LIMITED', manualCheck: `${WALK}#account.stationery`, hidden: true, limits: 'Reachable from Business profile > Extras.' },

  // ───────────────────────────── BOS Custom (visible only to Custom clients)
  ...(['delivery:Delivery', 'workflow:Workflow', 'portals:Portals', 'integrations:Integrations', 'finance:Finance', 'people:People', 'branding:Branding'] as const).map((s): Feature => {
    const [k, label] = s.split(':');
    return { id: `custom.${k}`, department: 'custom', label, icon: 'Sparkles', route: `/dashboard/custom/${k}`, purpose: `custom-${k}`, minPlan: 'CUSTOM', profiles: ALL, status: 'NOT_BUILT' };
  }),
];

/**
 * Old dashboard routes that are deliberately NOT redirected for Dashboard v2 vendors, with the reason. Every `app/dashboard/**` route must be a feature
 * route, a legacy route or listed here (the guard enforces it).
 */
export const KEPT_ROUTES: { route: string; reason: string }[] = [
  { route: '/dashboard/payments', reason: 'Collect payments is Coming soon in the menu, but this old screen holds the checkout-mode switch (order requests / online payment) that live shops already use; it stays reachable by address until KSM verifies Collect payments.' },
];

/** Dashboard routes that are served by the generic v2 route (`/dashboard/[dept]/[screen]`) or are real files; used by the guard's route scan. */
export const V2_ROUTE_PREFIXES = ['/dashboard/sales', '/dashboard/marketing', '/dashboard/website', '/dashboard/commerce', '/dashboard/finance', '/dashboard/people',
  '/dashboard/communication', '/dashboard/account', '/dashboard/custom', '/dashboard/home'];
