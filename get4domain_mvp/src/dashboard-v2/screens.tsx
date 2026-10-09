'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// Which existing screen(s) each Dashboard v2 feature mounts. "Move screens, do not rewrite them": every Component here is the old page,
// unchanged (the only internals touched: Website Manager honours a `section`, and the industry tab dispatcher became a reusable component).
// Features not listed here are not built (Coming soon) and render no screen.

const Loading = () => <div className="py-16 text-center text-sm text-slate-400">Loading…</div>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazy = (loader: () => Promise<{ default: ComponentType<any> }>): ComponentType => dynamic(loader, { loading: Loading }) as ComponentType;

export type IndustryOwner = 'products' | 'customers' | 'orders' | 'invoices' | 'workspace';

export type Screen =
  | { kind: 'page'; Component: ComponentType }
  | { kind: 'tabs'; tabs: { key: string; label: string; Component: ComponentType }[] }
  | { kind: 'website'; section: 'content' | 'design' | 'search' }
  | { kind: 'industry'; owner: IndustryOwner };

const CrmBoard = lazy(() => import('@/app/dashboard/crm/page'));
const TeleCrm = lazy(() => import('@/app/dashboard/telecrm/page'));
const CustomerHub = lazy(() => import('@/app/dashboard/customer-hub/page'));
const AiStudio = lazy(() => import('@/app/dashboard/ai-studio/page'));
const DomainPage = lazy(() => import('@/app/dashboard/domain-management/page'));
const EmbedPage = lazy(() => import('@/app/dashboard/embed/page'));
const Readiness = lazy(() => import('@/app/dashboard/website-engine/page'));
const StockPage = lazy(() => import('@/bos/Stock'));
const AccountsPage = lazy(() => import('@/bos/Accounts'));
const InvoicesPage = lazy(() => import('@/bos/Invoices'));
const QuotesPage = lazy(() => import('@/bos/Quotes'));
const CounterPage = lazy(() => import('@/bos/Counter'));
const PurchasesPage = lazy(() => import('@/bos/Purchases'));
const PaymentsPage = lazy(() => import('@/bos/PaymentsSettings'));
const RecurringPage = lazy(() => import('@/bos/Recurring'));
const CaPage = lazy(() => import('@/bos/CaAccounts'));
const TeamPage = lazy(() => import('@/app/dashboard/team/page'));
const InboxPage = lazy(() => import('@/app/dashboard/communication/page'));
const NotificationsPage = lazy(() => import('@/app/dashboard/notifications/page'));
const BillingPage = lazy(() => import('@/app/dashboard/billing/page'));
const GoLivePage = lazy(() => import('@/app/dashboard/go-live/page'));
const MyServicesPage = lazy(() => import('@/app/dashboard/my-services/page'));
const ReceiptsPage = lazy(() => import('@/dashboard-v2/PlanReceipts'));
const WalletPage = lazy(() => import('@/app/dashboard/wallet/page'));
const SupportPage = lazy(() => import('@/app/dashboard/support/page'));
const StationeryPage = lazy(() => import('@/app/dashboard/stationery/page'));
const CampaignsPage = lazy(() => import('@/app/dashboard/campaigns/page'));
const LandingPage = lazy(() => import('@/app/dashboard/landing-page/page'));
const ReportsPage = lazy(() => import('@/app/dashboard/reports/page'));
const BotPage = lazy(() => import('@/app/dashboard/whatsapp-bot/page'));
const BusinessProfile = lazy(() => import('@/dashboard-v2/BusinessProfile'));

export const SCREENS: Record<string, Screen> = {
  'sales.leads': { kind: 'tabs', tabs: [{ key: 'board', label: 'Board', Component: CrmBoard }, { key: 'queue', label: 'Call queue', Component: TeleCrm }] },
  'sales.customers': { kind: 'industry', owner: 'customers' },
  'sales.portal': { kind: 'page', Component: CustomerHub },
  'marketing.campaigns': { kind: 'tabs', tabs: [{ key: 'campaigns', label: 'Campaigns', Component: CampaignsPage }, { key: 'landing', label: 'Landing pages', Component: LandingPage }] },
  'home.reports': { kind: 'page', Component: ReportsPage },
  'communication.whatsapp-bot': { kind: 'page', Component: BotPage },
  'marketing.ai-studio': { kind: 'page', Component: AiStudio },
  'website.content': { kind: 'website', section: 'content' },
  'website.design': { kind: 'website', section: 'design' },
  'website.search': { kind: 'website', section: 'search' },
  'website.domain': { kind: 'page', Component: DomainPage },
  'website.widget': { kind: 'page', Component: EmbedPage },
  'website.readiness': { kind: 'page', Component: Readiness },
  'commerce.products': { kind: 'industry', owner: 'products' },
  'commerce.stock': { kind: 'page', Component: StockPage },
  'commerce.orders': { kind: 'industry', owner: 'orders' },
  'commerce.workspace': { kind: 'industry', owner: 'workspace' },
  'sales.quotes': { kind: 'page', Component: QuotesPage },
  'commerce.pos': { kind: 'page', Component: CounterPage },
  'commerce.inventory': { kind: 'page', Component: PurchasesPage },
  'finance.invoices': { kind: 'page', Component: InvoicesPage },
  'finance.collect-payments': { kind: 'page', Component: PaymentsPage },
  'finance.recurring': { kind: 'page', Component: RecurringPage },
  'finance.expenses': { kind: 'page', Component: AccountsPage },
  'finance.ca-accounts': { kind: 'page', Component: CaPage },
  'people.team': { kind: 'page', Component: TeamPage },
  'communication.inbox': { kind: 'page', Component: InboxPage },
  'communication.notifications': { kind: 'page', Component: NotificationsPage },
  'account.billing': { kind: 'tabs', tabs: [
    { key: 'billing', label: 'Plan and invoices', Component: BillingPage }, { key: 'golive', label: 'Buy or go live', Component: GoLivePage },
    { key: 'services', label: 'Add-ons and services', Component: MyServicesPage }, { key: 'receipts', label: 'Receipts', Component: ReceiptsPage },
  ] },
  'account.wallet': { kind: 'page', Component: WalletPage },
  'account.profile': { kind: 'page', Component: BusinessProfile },
  'account.help': { kind: 'page', Component: SupportPage },
  'account.stationery': { kind: 'page', Component: StationeryPage },
};

/** The old address to send a flag-OFF vendor to when they open a v2 address (e.g. from a shared link or a stale cookie). */
export const OLD_ADDRESS: Record<string, string> = {
  'website.design': '/dashboard/my-website', 'website.search': '/dashboard/my-website',
  'commerce.workspace': '/dashboard', 'sales.customers': '/dashboard', 'sales.quotes': '/dashboard/invoices?tab=quotes',
};
