import { IndustryConfig } from './types';

export const salonConfig: IndustryConfig = {
  key: 'salon',
  label: 'Salon & Spa',
  icon: 'Scissors',
  entities: {
    contact: { label: 'Client', labelPlural: 'Clients' },
    catalogItem: { label: 'Service', labelPlural: 'Services' },
    record: { label: 'Appointment', labelPlural: 'Appointments' },
  },
  recordStatuses: [
    { key: 'scheduled', label: 'Scheduled', color: '#64748b' },
    { key: 'confirmed', label: 'Confirmed', color: '#2563eb' },
    { key: 'completed', label: 'Completed', color: '#16a34a' },
    { key: 'no_show', label: 'No Show', color: '#f59e0b' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'stylistName', label: 'Stylist', type: 'text', required: true },
    { key: 'serviceDuration', label: 'Duration (mins)', type: 'number' },
  ],
  catalogCustomFields: [
    { key: 'category', label: 'Category', type: 'select', options: ['Hair', 'Skin', 'Nails', 'Spa', 'Makeup'] },
  ],
  defaultAddons: ['appointment_scheduling'],
  availableAddons: ['appointment_scheduling', 'inventory_management'],
  websiteTemplate: 'salon',
  dashboardTabs: [
    { key: 'appointments', label: 'Appointments', icon: 'CalendarClock' },
    { key: 'services', label: 'Services', icon: 'Sparkles' },
    { key: 'stylists', label: 'Stylists', icon: 'UserCog' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
