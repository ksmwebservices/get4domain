import { IndustryConfig } from './types';

export const technologyConfig: IndustryConfig = {
  key: 'technology',
  label: 'Technology & IT',
  icon: 'Code2',
  entities: {
    contact: { label: 'Client', labelPlural: 'Clients' },
    catalogItem: { label: 'Service', labelPlural: 'Services' },
    record: { label: 'Project', labelPlural: 'Projects' },
  },
  recordStatuses: [
    { key: 'proposal', label: 'Proposal', color: '#64748b' },
    { key: 'in_progress', label: 'In Progress', color: '#2563eb' },
    { key: 'testing', label: 'Testing', color: '#f59e0b' },
    { key: 'delivered', label: 'Delivered', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'projectType', label: 'Project Type', type: 'select', options: ['Web', 'Mobile', 'SaaS', 'AI/ML', 'Support', 'Other'] },
    { key: 'techStack', label: 'Tech Stack', type: 'text' },
    { key: 'deadline', label: 'Deadline', type: 'date' },
  ],
  catalogCustomFields: [{ key: 'billingType', label: 'Billing Type', type: 'select', options: ['Fixed', 'Hourly', 'Retainer'] }],
  defaultAddons: ['project_management'],
  availableAddons: ['project_management', 'document_management'],
  websiteTemplate: 'technology',
  dashboardTabs: [
    { key: 'projects', label: 'Projects', icon: 'FolderKanban' },
    { key: 'clients', label: 'Clients', icon: 'Users' },
    { key: 'tasks', label: 'Tasks', icon: 'ListChecks' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
