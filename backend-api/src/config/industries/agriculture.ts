import { IndustryConfig } from './types';

export const agricultureConfig: IndustryConfig = {
  key: 'agriculture',
  label: 'Agriculture',
  icon: 'Sprout',
  entities: {
    contact: { label: 'Buyer', labelPlural: 'Buyers' },
    catalogItem: { label: 'Produce', labelPlural: 'Produce' },
    record: { label: 'Order', labelPlural: 'Orders' },
  },
  recordStatuses: [
    { key: 'pending', label: 'Pending', color: '#64748b' },
    { key: 'confirmed', label: 'Confirmed', color: '#2563eb' },
    { key: 'dispatched', label: 'Dispatched', color: '#f59e0b' },
    { key: 'delivered', label: 'Delivered', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'harvestDate', label: 'Harvest Date', type: 'date' },
  ],
  catalogCustomFields: [
    { key: 'unit', label: 'Unit', type: 'select', options: ['kg', 'quintal', 'tonne', 'dozen', 'crate'] },
    { key: 'grade', label: 'Grade', type: 'select', options: ['A', 'B', 'C'] },
  ],
  defaultAddons: ['inventory_management'],
  availableAddons: ['inventory_management'],
  websiteTemplate: 'agriculture',
  dashboardTabs: [
    { key: 'orders', label: 'Orders', icon: 'ClipboardList' },
    { key: 'produce', label: 'Produce', icon: 'Sprout' },
    { key: 'buyers', label: 'Buyers', icon: 'Users' },
    { key: 'inventory', label: 'Inventory', icon: 'Boxes' },
  ],
};
