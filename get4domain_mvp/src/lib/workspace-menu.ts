// The Workspace-plan dashboard menu (opt-in per vendor via the `workspace_menu` addon).
//
// When the addon is ON the sidebar is built ONLY from this list — it is not "everything minus some items", so a BOS-only or duplicate-catalogue
// entry can never appear by accident, whatever modules/addons/industry tabs the vendor has. Vendors without the addon see the old menu, unchanged.
// Server-side permissions are the real boundary; this is what the vendor is shown.

export const WORKSPACE_MENU_ADDON = 'workspace_menu';

export interface WorkspaceNavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name
  /** Team-member area that gates the item (mirrors the layout's TEAM_AREA maps); omitted = visible to everyone on the account. */
  moduleKey?: string;
  walletGated?: boolean;
}
export interface WorkspaceNavSection { title?: string; items: WorkspaceNavItem[] }

export const WORKSPACE_SECTIONS: WorkspaceNavSection[] = [
  { items: [{ label: 'Home', href: '/dashboard', icon: 'LayoutDashboard' }] },
  {
    title: 'Sell',
    items: [
      { label: 'My Products', href: '/dashboard/my-products', icon: 'Package', moduleKey: 'website_manager' },
      { label: 'Stock', href: '/dashboard/stock', icon: 'Boxes', moduleKey: 'website_manager' },
      { label: 'Orders', href: '/dashboard/orders', icon: 'ShoppingBag', moduleKey: 'website_manager' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { label: 'Leads & CRM', href: '/dashboard/crm', icon: 'Users' },
      { label: 'TeleCRM', href: '/dashboard/telecrm', icon: 'Phone', moduleKey: 'telecrm' },
    ],
  },
  {
    title: 'Website',
    items: [
      // SEO lives inside Website Manager (its "SEO" tab).
      { label: 'Website Manager', href: '/dashboard/my-website', icon: 'Globe', moduleKey: 'website_manager' },
      { label: 'Domain', href: '/dashboard/domain-management', icon: 'Link' },
      { label: 'AI Studio', href: '/dashboard/ai-studio', icon: 'Sparkles', walletGated: true },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Invoices', href: '/dashboard/invoices', icon: 'FileText' },
      { label: 'Expenses', href: '/dashboard/accounts', icon: 'Receipt' },
      // AI Studio runs on the wallet, so topping it up has to stay reachable.
      { label: 'Wallet', href: '/dashboard/wallet', icon: 'Wallet' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Team', href: '/dashboard/team', icon: 'UserPlus' },
      { label: 'Plan & Billing', href: '/dashboard/billing', icon: 'CreditCard' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
    ],
  },
];

/** True when the vendor's addon switches turn the Workspace menu on. Anything but an explicit `true` keeps the standard menu. */
export function isWorkspaceMenu(addons: Record<string, boolean> | undefined | null): boolean {
  return Boolean(addons && addons[WORKSPACE_MENU_ADDON] === true);
}

/** Every href the Workspace menu may link to. */
export function workspaceHrefs(): string[] {
  return WORKSPACE_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
}

/** Entries that must NEVER appear for a Workspace vendor: BOS-only features and the duplicate catalogue/inventory tabs. */
export const BOS_ONLY_HREFS = [
  '/dashboard/hrm', '/dashboard/campaigns', '/dashboard/whatsapp-bot', '/dashboard/communication', '/dashboard/stationery',
  '/dashboard/customer-hub', '/dashboard/reports', '/dashboard/website-engine', '/dashboard/embed',
];
/** Industry tabs (`/dashboard/domain-app/<key>`) that read CatalogItem / RetailProduct — duplicates of My Products + Stock. */
export const DUPLICATE_CATALOGUE_PREFIX = '/dashboard/domain-app';

/** Items for the mobile bottom sheets, honouring team-member area gating the same way the desktop menu does. */
export function workspaceVisible(sections: WorkspaceNavSection[], hidden: (item: WorkspaceNavItem) => boolean): WorkspaceNavSection[] {
  return sections.map((s) => ({ ...s, items: s.items.filter((i) => !hidden(i)) })).filter((s) => s.items.length > 0);
}
