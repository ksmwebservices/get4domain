import { IndustryConfig } from './types';

export const travelConfig: IndustryConfig = {
  key: 'travel',
  label: 'Travel & Tours',
  icon: 'Plane',
  entities: {
    contact: { label: 'Passenger', labelPlural: 'Passengers' },
    catalogItem: { label: 'Package', labelPlural: 'Packages' },
    record: { label: 'Booking', labelPlural: 'Bookings' },
  },
  recordStatuses: [
    { key: 'enquiry', label: 'Enquiry', color: '#64748b' },
    { key: 'confirmed', label: 'Confirmed', color: '#2563eb' },
    { key: 'ongoing', label: 'Ongoing', color: '#f59e0b' },
    { key: 'completed', label: 'Completed', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    // Local cab / point-to-point bookings: one-way vs round-trip on a single date.
    // Optional so it doesn't disrupt package-tour bookings that don't need it.
    { key: 'tripType', label: 'Trip Type', type: 'select', options: ['One-way', 'Round-trip'] },
    { key: 'pickupLocation', label: 'Pickup Location', type: 'text', required: true },
    { key: 'dropLocation', label: 'Drop Location', type: 'text', required: true },
    { key: 'travelDate', label: 'Travel Date', type: 'date', required: true },
    {
      key: 'vehicleType',
      label: 'Vehicle Type',
      type: 'select',
      options: ['Sedan', 'SUV', 'Tempo Traveller', 'Bus', 'Other'],
    },
  ],
  catalogCustomFields: [
    { key: 'destination', label: 'Destination', type: 'text' },
    { key: 'durationDays', label: 'Duration (days)', type: 'number' },
  ],
  defaultAddons: ['fleet', 'driver'],
  availableAddons: ['fleet', 'driver', 'driver_outsourcing'],
  websiteTemplate: 'travel',
  dashboardTabs: [
    { key: 'bookings', label: 'Bookings', icon: 'CalendarCheck' },
    { key: 'trip-sheets', label: 'Trips', icon: 'Map' },
    { key: 'visa', label: 'Visa', icon: 'Stamp' },
    { key: 'fleet', label: 'Fleet', icon: 'Car' },
    { key: 'drivers', label: 'Drivers', icon: 'UserCog' },
    { key: 'contracts', label: 'Contracts', icon: 'FileSignature' },
    { key: 'invoicing', label: 'Invoicing', icon: 'FileText' },
  ],
};
