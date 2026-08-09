import { IndustryConfig } from './types';

export const eventsConfig: IndustryConfig = {
  key: 'events',
  label: 'Events & Wedding',
  icon: 'PartyPopper',
  entities: {
    contact: { label: 'Client', labelPlural: 'Clients' },
    catalogItem: { label: 'Package', labelPlural: 'Packages' },
    record: { label: 'Booking', labelPlural: 'Bookings' },
  },
  recordStatuses: [
    { key: 'enquiry', label: 'Enquiry', color: '#64748b' },
    { key: 'confirmed', label: 'Confirmed', color: '#2563eb' },
    { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
    { key: 'completed', label: 'Completed', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'eventDate', label: 'Event Date', type: 'date', required: true },
    { key: 'venue', label: 'Venue', type: 'text' },
    { key: 'guestCount', label: 'Guest Count', type: 'number' },
  ],
  catalogCustomFields: [
    { key: 'eventType', label: 'Event Type', type: 'select', options: ['Wedding', 'Birthday', 'Corporate', 'Concert', 'Other'] },
  ],
  defaultAddons: ['vendor_coordination'],
  availableAddons: ['vendor_coordination', 'document_management'],
  websiteTemplate: 'events',
  dashboardTabs: [
    { key: 'bookings', label: 'Bookings', icon: 'CalendarCheck' },
    { key: 'packages', label: 'Packages', icon: 'Package' },
    { key: 'vendors', label: 'Vendors', icon: 'Handshake' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
