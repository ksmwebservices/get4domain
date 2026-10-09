// Admin navigation as plain data (no React, no icons) so it can be unit-tested in Node.
// The layout (app/admin/layout.tsx) attaches icons by href. Role groups follow the locked-tab pattern.
//
// KSM: the MARKETING staff role must never see — or be able to open — anything under /admin/commerce
// (payee bank details, payment proofs, negotiated prices). The backend enforces this on every
// /admin/commerce endpoint (CommercialAdminGuard); this module keeps the UI honest too.

export type AdminRoleKey = 'SUPER_ADMIN' | 'MARKETING' | 'OPERATIONS';

export interface AdminNavEntry {
  label: string;
  href: string;
  roles: AdminRoleKey[];
}

const SUPER: AdminRoleKey[] = ['SUPER_ADMIN'];
const SUPER_MKT: AdminRoleKey[] = ['SUPER_ADMIN', 'MARKETING'];
const SUPER_OPS: AdminRoleKey[] = ['SUPER_ADMIN', 'OPERATIONS'];
const ALL_STAFF: AdminRoleKey[] = ['SUPER_ADMIN', 'MARKETING', 'OPERATIONS'];

/** Everything under this prefix is the Commerce area. */
export const COMMERCE_PREFIX = '/admin/commerce';
/** Roles allowed into the Commerce area. MARKETING is deliberately absent. */
export const COMMERCE_ROLES: AdminRoleKey[] = SUPER_OPS;

export const ADMIN_NAV: AdminNavEntry[] = [
  { label: 'Overview', href: '/admin', roles: SUPER },
  { label: 'TeleCRM', href: '/admin/telecrm', roles: SUPER_MKT },
  { label: 'AI Studio', href: '/admin/ai-studio', roles: SUPER_MKT },
  { label: 'Content Library', href: '/admin/library', roles: SUPER_MKT },
  { label: 'Send Quote', href: '/admin/send-quote', roles: SUPER_MKT },
  { label: 'Managed Services', href: '/admin/managed-services', roles: SUPER_MKT },
  { label: 'Demo Bookings', href: '/admin/leads', roles: SUPER },
  { label: 'Vendors', href: '/admin/customers', roles: SUPER },
  { label: 'Invoices', href: '/admin/invoices', roles: SUPER_OPS },
  { label: 'Commerce', href: COMMERCE_PREFIX, roles: COMMERCE_ROLES },
  { label: 'Renewals', href: '/admin/renewals', roles: SUPER_OPS },
  { label: 'Domains', href: '/admin/domains', roles: SUPER_OPS },
  { label: 'Accounting', href: '/admin/accounting', roles: SUPER },
  { label: 'Utilization', href: '/admin/utilization', roles: SUPER },
  { label: 'LeadSpace', href: '/admin/leadspace', roles: ALL_STAFF },
  { label: 'Support', href: '/admin/support', roles: SUPER_OPS },
  { label: 'Website CMS', href: '/admin/cms', roles: SUPER_OPS },
  { label: 'Vendor Access', href: '/admin/vendor-access', roles: SUPER },
  { label: 'Pricing Manager', href: '/admin/pricing', roles: SUPER },
  { label: 'Integrations', href: '/admin/api-settings', roles: SUPER },
  { label: 'Team', href: '/admin/team', roles: SUPER },
];

export const isCommerceHref = (href: string): boolean => href === COMMERCE_PREFIX || href.startsWith(`${COMMERCE_PREFIX}/`);

export const canSeeCommerce = (role: AdminRoleKey): boolean => COMMERCE_ROLES.includes(role);

/** The entries a given staff role may see. */
export const navForRole = (role: AdminRoleKey): AdminNavEntry[] => ADMIN_NAV.filter((i) => i.roles.includes(role));
