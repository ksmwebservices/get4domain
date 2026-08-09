import { IndustryConfig } from './types';

export const diagnosticsConfig: IndustryConfig = {
  key: 'diagnostics',
  label: 'Diagnostics & Lab',
  icon: 'FlaskConical',
  entities: {
    contact: { label: 'Patient', labelPlural: 'Patients' },
    catalogItem: { label: 'Test', labelPlural: 'Tests' },
    record: { label: 'Booking', labelPlural: 'Bookings' },
  },
  recordStatuses: [
    { key: 'booked', label: 'Booked', color: '#64748b' },
    { key: 'sample_collected', label: 'Sample Collected', color: '#2563eb' },
    { key: 'processing', label: 'Processing', color: '#f59e0b' },
    { key: 'report_ready', label: 'Report Ready', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'testDate', label: 'Test Date', type: 'date', required: true },
    { key: 'referringDoctor', label: 'Referring Doctor', type: 'text' },
  ],
  catalogCustomFields: [
    { key: 'sampleType', label: 'Sample Type', type: 'select', options: ['Blood', 'Urine', 'Imaging', 'Swab', 'Other'] },
    { key: 'reportTime', label: 'Report Time (hrs)', type: 'number' },
  ],
  defaultAddons: ['appointment_scheduling'],
  availableAddons: ['appointment_scheduling', 'document_management'],
  websiteTemplate: 'diagnostics',
  dashboardTabs: [
    { key: 'bookings', label: 'Bookings', icon: 'CalendarCheck' },
    { key: 'tests', label: 'Tests', icon: 'FlaskConical' },
    { key: 'patients', label: 'Patients', icon: 'Users' },
    { key: 'reports', label: 'Reports', icon: 'FileText' },
  ],
};
