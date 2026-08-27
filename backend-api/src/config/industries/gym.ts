import { IndustryConfig } from './types';

export const gymConfig: IndustryConfig = {
  key: 'gym',
  label: 'Gym & Fitness',
  icon: 'Dumbbell',
  entities: {
    contact: { label: 'Member', labelPlural: 'Members' },
    catalogItem: { label: 'Membership Plan', labelPlural: 'Membership Plans' },
    record: { label: 'Enrollment', labelPlural: 'Enrollments' },
  },
  recordStatuses: [
    { key: 'active', label: 'Active', color: '#16a34a' },
    { key: 'expiring', label: 'Expiring Soon', color: '#f59e0b' },
    { key: 'expired', label: 'Expired', color: '#dc2626' },
    { key: 'cancelled', label: 'Cancelled', color: '#64748b' },
  ],
  recordCustomFields: [
    { key: 'startDate', label: 'Start Date', type: 'date', required: true },
    { key: 'endDate', label: 'End Date', type: 'date', required: true },
    { key: 'trainerAssigned', label: 'Trainer Assigned', type: 'text' },
  ],
  catalogCustomFields: [
    { key: 'durationMonths', label: 'Duration (months)', type: 'number' },
    { key: 'planType', label: 'Plan Type', type: 'select', options: ['Gym', 'Gym + Cardio', 'Personal Training', 'Group Class'] },
  ],
  defaultAddons: ['attendance_tracking'],
  availableAddons: ['attendance_tracking'],
  websiteTemplate: 'gym',
  dashboardTabs: [
    { key: 'members', label: 'Members', icon: 'Users' },
    { key: 'classes', label: 'Classes', icon: 'CalendarClock' },
    { key: 'plans', label: 'Plans', icon: 'Package' },
    { key: 'attendance', label: 'Attendance', icon: 'CalendarCheck' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
