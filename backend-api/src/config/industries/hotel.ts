import { IndustryConfig } from './types';

export const hotelConfig: IndustryConfig = {
  key: 'hotel',
  label: 'Hotel',
  icon: 'Hotel',
  entities: {
    contact: { label: 'Guest', labelPlural: 'Guests' },
    catalogItem: { label: 'Room Type', labelPlural: 'Room Types' },
    record: { label: 'Reservation', labelPlural: 'Reservations' },
  },
  recordStatuses: [
    { key: 'booked', label: 'Booked', color: '#64748b' },
    { key: 'confirmed', label: 'Confirmed', color: '#2563eb' },
    { key: 'checked_in', label: 'Checked In', color: '#f59e0b' },
    { key: 'checked_out', label: 'Checked Out', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'checkIn', label: 'Check-in', type: 'date', required: true },
    { key: 'checkOut', label: 'Check-out', type: 'date', required: true },
    { key: 'roomNumber', label: 'Room Number', type: 'text' },
    { key: 'guestCount', label: 'Guests', type: 'number' },
  ],
  catalogCustomFields: [
    { key: 'occupancy', label: 'Max Occupancy', type: 'number' },
    { key: 'bedType', label: 'Bed Type', type: 'select', options: ['Single', 'Double', 'Twin', 'Suite'] },
  ],
  defaultAddons: ['room_management'],
  availableAddons: ['room_management', 'inventory_management'],
  websiteTemplate: 'hotel',
  dashboardTabs: [
    { key: 'reservations', label: 'Reservations', icon: 'CalendarCheck' },
    { key: 'rooms', label: 'Rooms', icon: 'BedDouble' },
    { key: 'housekeeping', label: 'Housekeeping', icon: 'Sparkles' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
