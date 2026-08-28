export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  required?: boolean;
}

export interface RecordStatus {
  key: string;
  label: string;
  color: string;
}

export interface DashboardTab {
  key: string;
  label: string;
  icon: string;
}

/** Per-industry visual skin layered on the shared dashboard components (2.1). */
export interface QuickAction {
  key: string;
  label: string;
  icon: string;
  href: string;
}
export interface IndustrySkin {
  accentColor: string;      // hex — primary accent for this industry
  accentColorDark: string;  // hex — gradient end / hover
  welcomeText: string;      // industry-appropriate dashboard greeting
  quickActions: QuickAction[];
}

export interface IndustryConfig {
  key: string;
  label: string;
  icon: string;
  entities: {
    contact: { label: string; labelPlural: string };
    catalogItem: { label: string; labelPlural: string };
    record: { label: string; labelPlural: string };
  };
  recordStatuses: RecordStatus[];
  recordCustomFields: CustomField[];
  catalogCustomFields: CustomField[];
  defaultAddons: string[];
  availableAddons: string[];
  websiteTemplate: string;
  dashboardTabs: DashboardTab[];
  skin?: IndustrySkin;
}

// Shared, GST-compliant default status set. Industries override where a more
// domain-appropriate workflow reads better (e.g. restaurant kitchen states).
export const DEFAULT_STATUSES: RecordStatus[] = [
  { key: 'draft', label: 'Draft', color: '#64748b' },
  { key: 'confirmed', label: 'Confirmed', color: '#2563eb' },
  { key: 'completed', label: 'Completed', color: '#16a34a' },
  { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
];

/**
 * Customer-portal shape (Customer Portal Upgrade). The /customer app is a
 * different audience from the vendor dashboard: a customer sees only their own
 * records, the vendor's public catalogue, their bills and a way to reach the
 * business. Derived from the industry's own entity labels so the portal speaks
 * each industry's language ("Menu" for a restaurant, "Room Types" for a hotel,
 * "Fees" for a school) without a parallel label table to keep in sync.
 */
export type CustomerTabKey = 'home' | 'records' | 'catalog' | 'invoices' | 'support';

export interface CustomerTab {
  key: CustomerTabKey;
  label: string;
  icon: string;
}

export interface CustomerPortalConfig {
  tabs: CustomerTab[];
  /** Convenience labels so the client never re-derives copy. */
  recordsLabel: string;
  recordLabel: string;
  catalogLabel: string;
  invoicesLabel: string;
  showCatalog: boolean;
  /** This industry's own non-terminal record statuses. */
  openStatuses: string[];
}
