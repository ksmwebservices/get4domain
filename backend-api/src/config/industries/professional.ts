import { IndustryConfig } from './types';

export const professionalConfig: IndustryConfig = {
  key: 'professional',
  label: 'Professional Services',
  icon: 'Scale',
  entities: {
    contact: { label: 'Client', labelPlural: 'Clients' },
    catalogItem: { label: 'Service', labelPlural: 'Services' },
    record: { label: 'Engagement', labelPlural: 'Engagements' },
  },
  recordStatuses: [
    { key: 'proposal', label: 'Proposal', color: '#64748b' },
    { key: 'active', label: 'Active', color: '#2563eb' },
    { key: 'on_hold', label: 'On Hold', color: '#f59e0b' },
    { key: 'completed', label: 'Completed', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'engagementType', label: 'Engagement Type', type: 'select', options: ['Consulting', 'Legal', 'Advisory', 'Retainer', 'Other'] },
    { key: 'billingType', label: 'Billing Type', type: 'select', options: ['Fixed', 'Hourly', 'Retainer'] },
  ],
  catalogCustomFields: [{ key: 'rate', label: 'Rate', type: 'number' }],
  defaultAddons: ['document_management'],
  availableAddons: ['document_management', 'project_management'],
  websiteTemplate: 'professional',
  dashboardTabs: [
    { key: 'engagements', label: 'Engagements', icon: 'Briefcase' },
    { key: 'clients', label: 'Clients', icon: 'Users' },
    { key: 'documents', label: 'Documents', icon: 'FileText' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
