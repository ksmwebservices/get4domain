import { IndustryConfig } from './types';

export const clinicConfig: IndustryConfig = {
  key: 'clinic',
  label: 'Clinic',
  icon: 'Stethoscope',
  entities: {
    contact: { label: 'Patient', labelPlural: 'Patients' },
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
    { key: 'doctorName', label: 'Doctor', type: 'text', required: true },
    { key: 'symptoms', label: 'Symptoms', type: 'textarea' },
    { key: 'prescriptionNotes', label: 'Prescription Notes', type: 'textarea' },
  ],
  catalogCustomFields: [{ key: 'department', label: 'Department', type: 'text' }],
  defaultAddons: ['appointment_scheduling'],
  availableAddons: ['appointment_scheduling', 'document_management', 'inventory_management'],
  websiteTemplate: 'clinic',
  dashboardTabs: [
    { key: 'appointments', label: 'Appointments', icon: 'CalendarClock' },
    { key: 'patients', label: 'Patients', icon: 'Users' },
    { key: 'doctors', label: 'Doctors', icon: 'UserCog' },
    { key: 'prescriptions', label: 'Prescriptions', icon: 'FileText' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
