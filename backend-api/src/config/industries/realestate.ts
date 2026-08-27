import { IndustryConfig } from './types';

export const realestateConfig: IndustryConfig = {
  key: 'realestate',
  label: 'Real Estate',
  icon: 'Building2',
  entities: {
    contact: { label: 'Client', labelPlural: 'Clients' },
    catalogItem: { label: 'Property', labelPlural: 'Properties' },
    record: { label: 'Enquiry', labelPlural: 'Enquiries' },
  },
  recordStatuses: [
    { key: 'new', label: 'New', color: '#64748b' },
    { key: 'site_visit', label: 'Site Visit', color: '#2563eb' },
    { key: 'negotiation', label: 'Negotiation', color: '#f59e0b' },
    { key: 'closed_won', label: 'Closed Won', color: '#16a34a' },
    { key: 'closed_lost', label: 'Closed Lost', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'propertyType', label: 'Property Type', type: 'select', options: ['Apartment', 'Villa', 'Plot', 'Commercial', 'Office'] },
    { key: 'budget', label: 'Budget', type: 'number' },
    { key: 'location', label: 'Preferred Location', type: 'text' },
  ],
  catalogCustomFields: [
    { key: 'area', label: 'Area (sq.ft)', type: 'number' },
    { key: 'bhk', label: 'Configuration', type: 'select', options: ['1BHK', '2BHK', '3BHK', '4BHK+', 'NA'] },
  ],
  defaultAddons: ['property_management'],
  availableAddons: ['property_management', 'document_management'],
  websiteTemplate: 'realestate',
  dashboardTabs: [
    { key: 'enquiries', label: 'Pipeline', icon: 'MessageSquare' },
    { key: 'properties', label: 'Listings', icon: 'Building2' },
    { key: 'visits', label: 'Site Visits', icon: 'CalendarClock' },
    { key: 'clients', label: 'Clients', icon: 'Users' },
    { key: 'documents', label: 'Documents', icon: 'FileText' },
  ],
};
