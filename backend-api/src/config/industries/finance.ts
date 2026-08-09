import { IndustryConfig } from './types';

export const financeConfig: IndustryConfig = {
  key: 'finance',
  label: 'Finance & Consulting',
  icon: 'Landmark',
  entities: {
    contact: { label: 'Client', labelPlural: 'Clients' },
    catalogItem: { label: 'Service', labelPlural: 'Services' },
    record: { label: 'Case', labelPlural: 'Cases' },
  },
  recordStatuses: [
    { key: 'open', label: 'Open', color: '#64748b' },
    { key: 'in_review', label: 'In Review', color: '#2563eb' },
    { key: 'filed', label: 'Filed', color: '#f59e0b' },
    { key: 'closed', label: 'Closed', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'caseType', label: 'Case Type', type: 'select', options: ['ITR', 'GST', 'Audit', 'Loan', 'Insurance', 'Other'] },
    { key: 'filingDeadline', label: 'Filing Deadline', type: 'date' },
  ],
  catalogCustomFields: [{ key: 'billingType', label: 'Billing Type', type: 'select', options: ['Fixed', 'Hourly', 'Retainer'] }],
  defaultAddons: ['document_management'],
  availableAddons: ['document_management'],
  websiteTemplate: 'finance',
  dashboardTabs: [
    { key: 'cases', label: 'Cases', icon: 'Briefcase' },
    { key: 'clients', label: 'Clients', icon: 'Users' },
    { key: 'documents', label: 'Documents', icon: 'FileText' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
