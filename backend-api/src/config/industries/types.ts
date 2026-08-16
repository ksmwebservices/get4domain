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
