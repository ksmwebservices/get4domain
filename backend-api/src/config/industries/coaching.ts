import { IndustryConfig } from './types';

export const coachingConfig: IndustryConfig = {
  key: 'coaching',
  label: 'Coaching Centre',
  icon: 'BookMarked',
  entities: {
    contact: { label: 'Student', labelPlural: 'Students' },
    catalogItem: { label: 'Course', labelPlural: 'Courses' },
    record: { label: 'Enrollment', labelPlural: 'Enrollments' },
  },
  recordStatuses: [
    { key: 'enquiry', label: 'Enquiry', color: '#64748b' },
    { key: 'enrolled', label: 'Enrolled', color: '#2563eb' },
    { key: 'ongoing', label: 'Ongoing', color: '#f59e0b' },
    { key: 'completed', label: 'Completed', color: '#16a34a' },
    { key: 'dropped', label: 'Dropped', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'batchTiming', label: 'Batch Timing', type: 'text', required: true },
    { key: 'subject', label: 'Subject', type: 'text' },
  ],
  catalogCustomFields: [
    { key: 'level', label: 'Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
  ],
  defaultAddons: ['batch_management'],
  availableAddons: ['batch_management', 'attendance_tracking'],
  websiteTemplate: 'coaching',
  dashboardTabs: [
    { key: 'students', label: 'Students', icon: 'Users' },
    { key: 'courses', label: 'Courses', icon: 'BookOpen' },
    { key: 'batches', label: 'Batches', icon: 'Layers' },
    { key: 'fees', label: 'Fees', icon: 'Receipt' },
  ],
};
