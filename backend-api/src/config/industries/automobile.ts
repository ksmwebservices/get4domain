import { IndustryConfig } from './types';

export const automobileConfig: IndustryConfig = {
  key: 'automobile',
  label: 'Automobile Service',
  icon: 'Wrench',
  entities: {
    contact: { label: 'Customer', labelPlural: 'Customers' },
    catalogItem: { label: 'Service', labelPlural: 'Services' },
    record: { label: 'Job', labelPlural: 'Jobs' },
  },
  recordStatuses: [
    { key: 'received', label: 'Received', color: '#64748b' },
    { key: 'in_service', label: 'In Service', color: '#2563eb' },
    { key: 'ready', label: 'Ready', color: '#f59e0b' },
    { key: 'delivered', label: 'Delivered', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'vehicleNumber', label: 'Vehicle Number', type: 'text', required: true },
    { key: 'vehicleModel', label: 'Vehicle Model', type: 'text' },
    { key: 'jobType', label: 'Job Type', type: 'select', options: ['General Service', 'Repair', 'Body Work', 'Insurance', 'Other'] },
  ],
  catalogCustomFields: [{ key: 'laborHours', label: 'Labor Hours', type: 'number' }],
  defaultAddons: ['inventory_management'],
  availableAddons: ['inventory_management'],
  websiteTemplate: 'automobile',
  dashboardTabs: [
    { key: 'jobs', label: 'Jobs', icon: 'Wrench' },
    { key: 'customers', label: 'Customers', icon: 'Users' },
    { key: 'inventory', label: 'Inventory', icon: 'Boxes' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
