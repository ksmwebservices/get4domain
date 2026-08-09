import { TAB_ADDON_REQUIREMENT } from '@/lib/dashboard-config';

export type ViewKind = 'records' | 'contacts' | 'catalog' | 'billing' | 'addon';

// Tabs that map to the shared Catalog entity across industries.
const CATALOG_TABS = new Set([
  'menu', 'products', 'packages', 'services', 'tests', 'courses', 'plans', 'properties', 'produce',
]);

// Tabs that map to the shared Contact entity.
const CONTACT_TABS = new Set([
  'customers', 'clients', 'patients', 'buyers', 'members', 'students', 'guests',
]);

const BILLING_TABS = new Set(['billing', 'invoicing', 'fees']);

// Peripheral tabs that need their own (not-yet-built) workspace — shown as a
// "coming soon" stub, same treatment as addon-backed tabs.
const STUB_TABS = new Set(['doctors', 'stylists', 'kitchen', 'prescriptions', 'reports']);

/**
 * Resolves an industry dashboardTab.key to the shared view that should render
 * it. Core record tabs (bookings/orders/appointments/…) fall through to
 * 'records'. Addon-backed and peripheral tabs render the 'addon' stub.
 */
export function resolveView(tabKey: string): ViewKind {
  if (tabKey in TAB_ADDON_REQUIREMENT || STUB_TABS.has(tabKey)) return 'addon';
  if (BILLING_TABS.has(tabKey)) return 'billing';
  if (CATALOG_TABS.has(tabKey)) return 'catalog';
  if (CONTACT_TABS.has(tabKey)) return 'contacts';
  return 'records';
}
