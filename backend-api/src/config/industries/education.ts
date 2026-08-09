import { IndustryConfig } from './types';

export const educationConfig: IndustryConfig = {
  key: 'education',
  label: 'Education & Training',
  icon: 'GraduationCap',
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
    { key: 'batchName', label: 'Batch', type: 'text', required: true },
    { key: 'startDate', label: 'Start Date', type: 'date' },
    { key: 'guardianContact', label: 'Guardian Contact', type: 'text' },
  ],
  catalogCustomFields: [
    { key: 'durationWeeks', label: 'Duration (weeks)', type: 'number' },
    { key: 'mode', label: 'Mode', type: 'select', options: ['Classroom', 'Online', 'Hybrid'] },
  ],
  defaultAddons: ['batch_management'],
  availableAddons: ['batch_management', 'attendance_tracking', 'document_management'],
  websiteTemplate: 'education',
  dashboardTabs: [
    { key: 'students', label: 'Students', icon: 'Users' },
    { key: 'courses', label: 'Courses', icon: 'BookOpen' },
    { key: 'batches', label: 'Batches', icon: 'Layers' },
    { key: 'fees', label: 'Fees', icon: 'Receipt' },
  ],
};
