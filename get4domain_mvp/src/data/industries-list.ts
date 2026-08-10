// The 20 launch industries with their v2.0 workspace entity labels.
// `id` matches the /industries/[id] route params and the sitemap.
export interface IndustryListItem {
  id: string;
  icon: string;
  name: string;
  records: string;
  contacts: string;
}

export const INDUSTRIES: IndustryListItem[] = [
  { id: 'travel', icon: '🚗', name: 'Travel & Tours', records: 'Bookings', contacts: 'Passengers' },
  { id: 'restaurant', icon: '🍽️', name: 'Restaurant & Cafe', records: 'Orders', contacts: 'Customers' },
  { id: 'healthcare', icon: '🏥', name: 'Clinic & Healthcare', records: 'Appointments', contacts: 'Patients' },
  { id: 'hotel', icon: '🏨', name: 'Hotel & Hospitality', records: 'Reservations', contacts: 'Guests' },
  { id: 'beauty', icon: '💇', name: 'Salon & Beauty', records: 'Appointments', contacts: 'Clients' },
  { id: 'fitness', icon: '🏋️', name: 'Gym & Fitness', records: 'Memberships', contacts: 'Members' },
  { id: 'realestate', icon: '🏠', name: 'Real Estate', records: 'Deals', contacts: 'Clients' },
  { id: 'education', icon: '🎓', name: 'Education & Schools', records: 'Enrolments', contacts: 'Students' },
  { id: 'retail', icon: '🛒', name: 'Retail & E-commerce', records: 'Orders', contacts: 'Customers' },
  { id: 'construction', icon: '🏗️', name: 'Construction', records: 'Projects', contacts: 'Clients' },
  { id: 'events', icon: '🎉', name: 'Events & Planning', records: 'Bookings', contacts: 'Clients' },
  { id: 'finance', icon: '💰', name: 'Finance & Consulting', records: 'Policies', contacts: 'Clients' },
  { id: 'automobile', icon: '🚙', name: 'Automobile Services', records: 'Service Jobs', contacts: 'Customers' },
  { id: 'logistics', icon: '🚚', name: 'Logistics & Transport', records: 'Shipments', contacts: 'Clients' },
  { id: 'diagnostics', icon: '🔬', name: 'Diagnostics & Labs', records: 'Test Orders', contacts: 'Patients' },
  { id: 'photography', icon: '📸', name: 'Photography & Studio', records: 'Shoots', contacts: 'Clients' },
  { id: 'professional', icon: '💼', name: 'Professional Services', records: 'Engagements', contacts: 'Clients' },
  { id: 'agriculture', icon: '🌾', name: 'Agriculture', records: 'Orders', contacts: 'Buyers' },
  { id: 'coaching', icon: '📚', name: 'Coaching & Training', records: 'Batches', contacts: 'Students' },
  { id: 'technology', icon: '💻', name: 'Technology & IT', records: 'Projects', contacts: 'Clients' },
];
