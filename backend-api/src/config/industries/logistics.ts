import { IndustryConfig } from './types';

export const logisticsConfig: IndustryConfig = {
  key: 'logistics',
  label: 'Logistics & Transport',
  icon: 'Truck',
  entities: {
    contact: { label: 'Client', labelPlural: 'Clients' },
    catalogItem: { label: 'Service', labelPlural: 'Services' },
    record: { label: 'Shipment', labelPlural: 'Shipments' },
  },
  recordStatuses: [
    { key: 'booked', label: 'Booked', color: '#64748b' },
    { key: 'picked_up', label: 'Picked Up', color: '#2563eb' },
    { key: 'in_transit', label: 'In Transit', color: '#f59e0b' },
    { key: 'delivered', label: 'Delivered', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'origin', label: 'Origin', type: 'text', required: true },
    { key: 'destination', label: 'Destination', type: 'text', required: true },
    { key: 'weight', label: 'Weight (kg)', type: 'number' },
  ],
  catalogCustomFields: [{ key: 'mode', label: 'Mode', type: 'select', options: ['Road', 'Rail', 'Air', 'Sea'] }],
  defaultAddons: ['fleet', 'driver'],
  availableAddons: ['fleet', 'driver', 'driver_outsourcing'],
  websiteTemplate: 'logistics',
  dashboardTabs: [
    { key: 'shipments', label: 'Shipments', icon: 'PackageCheck' },
    { key: 'fleet', label: 'Fleet', icon: 'Truck' },
    { key: 'drivers', label: 'Drivers', icon: 'UserCog' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
