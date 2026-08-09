import { IndustryConfig, DEFAULT_STATUSES } from './types';

export const generalConfig: IndustryConfig = {
  key: 'general',
  label: 'General Business',
  icon: 'Briefcase',
  entities: {
    contact: { label: 'Customer', labelPlural: 'Customers' },
    catalogItem: { label: 'Product / Service', labelPlural: 'Products & Services' },
    record: { label: 'Transaction', labelPlural: 'Transactions' },
  },
  recordStatuses: DEFAULT_STATUSES,
  recordCustomFields: [],
  catalogCustomFields: [],
  defaultAddons: [],
  availableAddons: ['inventory_management', 'document_management', 'project_management'],
  websiteTemplate: 'general',
  dashboardTabs: [
    { key: 'transactions', label: 'Transactions', icon: 'Receipt' },
    { key: 'customers', label: 'Customers', icon: 'Users' },
    { key: 'catalog', label: 'Catalog', icon: 'Package' },
    { key: 'billing', label: 'Billing', icon: 'FileText' },
  ],
};
