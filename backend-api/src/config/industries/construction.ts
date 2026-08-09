import { IndustryConfig } from './types';

export const constructionConfig: IndustryConfig = {
  key: 'construction',
  label: 'Construction',
  icon: 'HardHat',
  entities: {
    contact: { label: 'Client', labelPlural: 'Clients' },
    catalogItem: { label: 'Service', labelPlural: 'Services' },
    record: { label: 'Project', labelPlural: 'Projects' },
  },
  recordStatuses: [
    { key: 'planning', label: 'Planning', color: '#64748b' },
    { key: 'in_progress', label: 'In Progress', color: '#2563eb' },
    { key: 'on_hold', label: 'On Hold', color: '#f59e0b' },
    { key: 'completed', label: 'Completed', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'siteAddress', label: 'Site Address', type: 'textarea', required: true },
    { key: 'projectPhase', label: 'Project Phase', type: 'select', options: ['Foundation', 'Structure', 'Finishing', 'Handover'] },
    { key: 'estimatedCompletion', label: 'Estimated Completion', type: 'date' },
  ],
  catalogCustomFields: [{ key: 'unit', label: 'Unit', type: 'text' }],
  defaultAddons: ['project_management'],
  availableAddons: ['project_management', 'document_management', 'inventory_management'],
  websiteTemplate: 'construction',
  dashboardTabs: [
    { key: 'projects', label: 'Projects', icon: 'Hammer' },
    { key: 'clients', label: 'Clients', icon: 'Users' },
    { key: 'materials', label: 'Materials', icon: 'Boxes' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
