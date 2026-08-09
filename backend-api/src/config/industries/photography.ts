import { IndustryConfig } from './types';

export const photographyConfig: IndustryConfig = {
  key: 'photography',
  label: 'Photography',
  icon: 'Camera',
  entities: {
    contact: { label: 'Client', labelPlural: 'Clients' },
    catalogItem: { label: 'Package', labelPlural: 'Packages' },
    record: { label: 'Booking', labelPlural: 'Bookings' },
  },
  recordStatuses: [
    { key: 'enquiry', label: 'Enquiry', color: '#64748b' },
    { key: 'confirmed', label: 'Confirmed', color: '#2563eb' },
    { key: 'shot', label: 'Shot Done', color: '#f59e0b' },
    { key: 'delivered', label: 'Delivered', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'eventDate', label: 'Event Date', type: 'date', required: true },
    { key: 'eventType', label: 'Event Type', type: 'select', options: ['Wedding', 'Pre-Wedding', 'Portrait', 'Product', 'Event', 'Other'] },
    { key: 'deliverables', label: 'Deliverables', type: 'textarea' },
  ],
  catalogCustomFields: [{ key: 'hours', label: 'Coverage Hours', type: 'number' }],
  defaultAddons: ['gallery_management'],
  availableAddons: ['gallery_management', 'document_management'],
  websiteTemplate: 'photography',
  dashboardTabs: [
    { key: 'bookings', label: 'Bookings', icon: 'CalendarCheck' },
    { key: 'packages', label: 'Packages', icon: 'Package' },
    { key: 'gallery', label: 'Gallery', icon: 'Images' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
