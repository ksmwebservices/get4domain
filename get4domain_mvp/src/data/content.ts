import {
  UtensilsCrossed,
  Plane,
  Building2,
  HeartPulse,
  GraduationCap,
  HardHat,
  ShoppingBag,
  Sparkles,
  Dumbbell,
  Briefcase,
  PartyPopper,
  Landmark,
  Car,
  Truck,
  Stethoscope,
  Hotel,
  Camera,
  Cpu,
  Leaf,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

export interface Industry {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  coverImage: string;
  color: string;
  bgColor: string;
  features: string[];
  badge?: string;
}

export const industries: Industry[] = [
  {
    id: 'restaurant',
    name: 'Restaurant & Food',
    description: 'Digital menus, table reservations, online ordering and food galleries.',
    icon: UtensilsCrossed,
    coverImage: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    features: ['Digital Menu', 'Table Booking', 'Online Orders', 'Food Gallery'],
    badge: 'Popular',
  },
  {
    id: 'travel',
    name: 'Travel & Tours',
    description: 'Tour packages, itineraries, booking forms and destination showcases.',
    icon: Plane,
    coverImage: 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    features: ['Tour Packages', 'Itinerary Builder', 'Booking Form', 'Trip Gallery'],
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    description: 'Property listings, virtual tours, agent profiles and inquiry forms.',
    icon: Building2,
    coverImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    features: ['Property Listings', 'Agent Profiles', 'Enquiry Forms', 'Map View'],
  },
  {
    id: 'healthcare',
    name: 'Clinic & Hospital',
    description: 'Doctor profiles, appointment booking, services and patient information.',
    icon: HeartPulse,
    coverImage: 'https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    features: ['Doctor Profiles', 'Appointments', 'Services List', 'Emergency Info'],
    badge: 'Popular',
  },
  {
    id: 'education',
    name: 'School & College',
    description: 'Course catalogs, admissions, faculty profiles and campus galleries.',
    icon: GraduationCap,
    coverImage: 'https://images.pexels.com/photos/207692/pexels-photo-207692.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    features: ['Course Catalog', 'Admission Form', 'Faculty Profiles', 'Event Calendar'],
  },
  {
    id: 'construction',
    name: 'Construction & Interior',
    description: 'Project portfolios, service catalogs, quotes and material galleries.',
    icon: HardHat,
    coverImage: 'https://images.pexels.com/photos/159306/house-server-architecture-internet-159306.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    features: ['Project Portfolio', 'Quote Request', 'Team Profiles', 'Material Gallery'],
  },
  {
    id: 'retail',
    name: 'Retail & Shopping',
    description: 'Product catalogs, store locator, offers and customer reviews.',
    icon: ShoppingBag,
    coverImage: 'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    features: ['Product Catalog', 'Offers Section', 'Store Locator', 'Reviews'],
    badge: 'Popular',
  },
  {
    id: 'beauty',
    name: 'Salon & Spa',
    description: 'Service menus, appointment booking, galleries and stylist profiles.',
    icon: Sparkles,
    coverImage: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-fuchsia-600',
    bgColor: 'bg-fuchsia-50',
    features: ['Service Menu', 'Appointment Booking', 'Before/After Gallery', 'Stylists'],
  },
  {
    id: 'fitness',
    name: 'Gym & Fitness',
    description: 'Class schedules, trainer profiles, membership plans and galleries.',
    icon: Dumbbell,
    coverImage: 'https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-lime-600',
    bgColor: 'bg-lime-50',
    features: ['Class Schedule', 'Trainer Profiles', 'Membership Plans', 'Gallery'],
  },
  {
    id: 'professional',
    name: 'CA & Professional Services',
    description: 'Service listings, team profiles, case studies and contact forms.',
    icon: Briefcase,
    coverImage: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    features: ['Service Listings', 'Team Profiles', 'Case Studies', 'Client Enquiry'],
  },
  {
    id: 'events',
    name: 'Events & Entertainment',
    description: 'Event galleries, booking forms, packages and client showcases.',
    icon: PartyPopper,
    coverImage: 'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    features: ['Event Gallery', 'Package Details', 'Booking Form', 'Client Showcase'],
  },
  {
    id: 'finance',
    name: 'Finance & Insurance',
    description: 'Service catalogs, policy details, calculators and inquiry forms.',
    icon: Landmark,
    coverImage: 'https://images.pexels.com/photos/356056/pexels-photo-356056.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    features: ['Service Catalog', 'Policy Details', 'Premium Calculator', 'Enquiry'],
  },
  {
    id: 'automobile',
    name: 'Automobile & Showroom',
    description: 'Vehicle listings, test drive booking, service center and offers.',
    icon: Car,
    coverImage: 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    features: ['Vehicle Listings', 'Test Drive Booking', 'EMI Calculator', 'Service Center'],
  },
  {
    id: 'logistics',
    name: 'Logistics & Transport',
    description: 'Fleet management, route tracking, service areas and freight booking.',
    icon: Truck,
    coverImage: 'https://images.pexels.com/photos/2199293/pexels-photo-2199293.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    features: ['Fleet Info', 'Service Areas', 'Freight Enquiry', 'Route Planning'],
  },
  {
    id: 'diagnostics',
    name: 'Diagnostic Lab',
    description: 'Test packages, home collection, report tracking and health packages.',
    icon: Stethoscope,
    coverImage: 'https://images.pexels.com/photos/4226119/pexels-photo-4226119.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    features: ['Test Packages', 'Home Collection', 'Report Download', 'Health Packages'],
  },
  {
    id: 'hotel',
    name: 'Hotel & Hospitality',
    description: 'Room listings, amenities, booking form and guest reviews.',
    icon: Hotel,
    coverImage: 'https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    features: ['Room Listings', 'Amenities', 'Online Booking', 'Guest Reviews'],
  },
  {
    id: 'photography',
    name: 'Photography & Studio',
    description: 'Portfolio galleries, package pricing, booking forms and client work.',
    icon: Camera,
    coverImage: 'https://images.pexels.com/photos/1264210/pexels-photo-1264210.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    features: ['Portfolio Gallery', 'Package Pricing', 'Booking Form', 'Client Work'],
  },
  {
    id: 'technology',
    name: 'IT & Software Company',
    description: 'Service showcase, case studies, tech stack and team profiles.',
    icon: Cpu,
    coverImage: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    features: ['Service Showcase', 'Case Studies', 'Tech Stack', 'Team Profiles'],
  },
  {
    id: 'agriculture',
    name: 'Agriculture & Farm',
    description: 'Product catalog, farm details, bulk orders and seasonal offers.',
    icon: Leaf,
    coverImage: 'https://images.pexels.com/photos/1595104/pexels-photo-1595104.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    features: ['Product Catalog', 'Farm Details', 'Bulk Orders', 'Seasonal Offers'],
  },
  {
    id: 'coaching',
    name: 'Coaching & Tuition',
    description: 'Course listings, faculty, batch schedules and admission enquiry.',
    icon: BookOpen,
    coverImage: 'https://images.pexels.com/photos/4145153/pexels-photo-4145153.jpeg?auto=compress&cs=tinysrgb&w=800',
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    features: ['Course Listings', 'Faculty Profiles', 'Batch Schedule', 'Admission Form'],
  },
];

export interface ThemeTemplate {
  id: string;
  name: string;
  industryId: string;
  previewImage: string;
  features: string[];
  pagesIncluded: string[];
}

export const themes: ThemeTemplate[] = [
  {
    id: 'restaurant-a',
    name: 'Saffron Elegance',
    industryId: 'restaurant',
    previewImage: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Digital Menu', 'Table Reservation', 'Online Ordering', 'Food Gallery', 'Reviews Section'],
    pagesIncluded: ['Home', 'Menu', 'About', 'Gallery', 'Reservation', 'Contact'],
  },
  {
    id: 'travel-a',
    name: 'Wanderlust Pro',
    industryId: 'travel',
    previewImage: 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Tour Packages', 'Itinerary Builder', 'Booking Form', 'Destination Gallery', 'Travel Blog'],
    pagesIncluded: ['Home', 'Packages', 'Destinations', 'About', 'Blog', 'Contact'],
  },
  {
    id: 'realestate-a',
    name: 'Estate Prime',
    industryId: 'realestate',
    previewImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Property Listings', 'Virtual Tours', 'Agent Profiles', 'Mortgage Calculator', 'Inquiry Forms'],
    pagesIncluded: ['Home', 'Properties', 'Agents', 'About', 'Blog', 'Contact'],
  },
  {
    id: 'healthcare-a',
    name: 'CareWell Medical',
    industryId: 'healthcare',
    previewImage: 'https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Doctor Profiles', 'Appointment Booking', 'Service Catalog', 'Patient Portal', 'Emergency Contact'],
    pagesIncluded: ['Home', 'Services', 'Doctors', 'About', 'Appointment', 'Contact'],
  },
  {
    id: 'education-a',
    name: 'Scholar Academy',
    industryId: 'education',
    previewImage: 'https://images.pexels.com/photos/207692/pexels-photo-207692.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Course Catalog', 'Admission Form', 'Faculty Profiles', 'Campus Gallery', 'Event Calendar'],
    pagesIncluded: ['Home', 'Courses', 'Faculty', 'About', 'Admissions', 'Contact'],
  },
  {
    id: 'construction-a',
    name: 'BuildPro',
    industryId: 'construction',
    previewImage: 'https://images.pexels.com/photos/159306/house-server-architecture-internet-159306.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Project Portfolio', 'Service Catalog', 'Quote Request', 'Material Gallery', 'Team Profiles'],
    pagesIncluded: ['Home', 'Projects', 'Services', 'About', 'Quote', 'Contact'],
  },
  {
    id: 'retail-a',
    name: 'ShopWave',
    industryId: 'retail',
    previewImage: 'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Product Catalog', 'Store Locator', 'Offers Section', 'Customer Reviews', 'Loyalty Program'],
    pagesIncluded: ['Home', 'Products', 'Stores', 'About', 'Offers', 'Contact'],
  },
  {
    id: 'beauty-a',
    name: 'Glow Studio',
    industryId: 'beauty',
    previewImage: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Service Menu', 'Appointment Booking', 'Before/After Gallery', 'Stylist Profiles', 'Gift Cards'],
    pagesIncluded: ['Home', 'Services', 'Gallery', 'Stylists', 'Booking', 'Contact'],
  },
  {
    id: 'fitness-a',
    name: 'PowerHouse Gym',
    industryId: 'fitness',
    previewImage: 'https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Class Schedule', 'Trainer Profiles', 'Membership Plans', 'Workout Gallery', 'Progress Tracking'],
    pagesIncluded: ['Home', 'Classes', 'Trainers', 'Membership', 'Gallery', 'Contact'],
  },
  {
    id: 'professional-a',
    name: 'ConsultPro',
    industryId: 'professional',
    previewImage: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Service Listings', 'Team Profiles', 'Case Studies', 'Client Testimonials', 'Contact Forms'],
    pagesIncluded: ['Home', 'Services', 'Team', 'Case Studies', 'About', 'Contact'],
  },
  {
    id: 'events-a',
    name: 'EventMakers',
    industryId: 'events',
    previewImage: 'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Event Gallery', 'Package Details', 'Booking Form', 'Client Showcase', 'Venue Locator'],
    pagesIncluded: ['Home', 'Events', 'Packages', 'Gallery', 'About', 'Contact'],
  },
  {
    id: 'finance-a',
    name: 'FinSecure',
    industryId: 'finance',
    previewImage: 'https://images.pexels.com/photos/356056/pexels-photo-356056.jpeg?auto=compress&cs=tinysrgb&w=1200',
    features: ['Service Catalog', 'Policy Details', 'Premium Calculator', 'Client Portal', 'Inquiry Forms'],
    pagesIncluded: ['Home', 'Services', 'Policies', 'Calculator', 'About', 'Contact'],
  },
];

export interface AddOn {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: string;
  duration: string;
}

export const addOns: AddOn[] = [
  { id: 'seo', name: 'SEO Services', description: 'On-page & off-page SEO to rank higher on Google and attract organic leads.', icon: 'Search', price: '₹2,999', duration: 'Monthly' },
  { id: 'gbp', name: 'Google Business Profile', description: 'Setup and optimize your Google Business Profile for local visibility.', icon: 'MapPin', price: '₹1,499', duration: 'One-time' },
  { id: 'whatsapp-campaign', name: 'WhatsApp Campaign', description: 'Broadcast promotional messages to your customers via WhatsApp.', icon: 'MessageCircle', price: '₹1,999', duration: 'Monthly' },
  { id: 'sms-campaign', name: 'SMS Campaign', description: 'Send bulk SMS campaigns to your entire customer database.', icon: 'Smartphone', price: '₹999', duration: 'Monthly' },
  { id: 'email-campaign', name: 'Email Campaign', description: 'Design and send professional email newsletters and promotions.', icon: 'Mail', price: '₹1,499', duration: 'Monthly' },
  { id: 'social-posters', name: 'Social Media Posters', description: 'Custom-designed social media posters for your brand every month.', icon: 'Image', price: '₹2,499', duration: '10 posters' },
  { id: 'social-posting', name: 'Social Media Posting', description: 'We post and manage your social media accounts daily.', icon: 'Share2', price: '₹3,999', duration: 'Monthly' },
  { id: 'maintenance', name: 'Website Maintenance', description: 'Regular updates, backups, security patches and content changes.', icon: 'Wrench', price: '₹999', duration: 'Monthly' },
  { id: 'content-writing', name: 'Content Writing', description: 'Professional website content written by expert copywriters.', icon: 'PenTool', price: '₹1,999', duration: 'Per page' },
  { id: 'logo-design', name: 'Logo Design', description: 'Custom logo design with multiple concepts and revisions.', icon: 'Palette', price: '₹1,499', duration: 'One-time' },
];

export interface PortfolioItem {
  id: string;
  industry: string;
  businessName: string;
  image: string;
  url: string;
  city: string;
}

// No client websites launched yet — Portfolio component shows a "coming soon" state when this is empty.
export const portfolioItems: PortfolioItem[] = [];

export interface Testimonial {
  id: string;
  businessName: string;
  ownerName: string;
  city: string;
  rating: number;
  review: string;
  avatar: string;
  product: string;
}

export const testimonials: Testimonial[] = [
  {
    id: 't1',
    businessName: 'Spice Garden Restaurant',
    ownerName: 'Rajesh Kumar',
    city: 'Mumbai',
    rating: 5,
    review: 'Get4Domain launched our restaurant website professionally. The digital menu and WhatsApp integration increased our orders significantly. Very happy with the DomainApp!',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
    product: 'DomainApp Startup',
  },
  {
    id: 't2',
    businessName: 'MR Travels',
    ownerName: 'Muthukumar',
    city: 'Chennai',
    rating: 5,
    review: 'Our travel business needed an online presence fast. Get4Domain built a complete fleet management and booking platform. The ERP system helps us manage everything from one place.',
    avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200',
    product: 'DomainApp Enterprise',
  },
  {
    id: 't3',
    businessName: 'CareWell Clinic',
    ownerName: 'Dr. Anil Mehta',
    city: 'Pune',
    rating: 5,
    review: 'The appointment booking system has transformed how we manage patients. Our clinic looks very professional online now.',
    avatar: 'https://images.pexels.com/photos/697509/pexels-photo-697509.jpeg?auto=compress&cs=tinysrgb&w=200',
    product: 'DomainApp Startup',
  },
  {
    id: 't4',
    businessName: 'BuildRight Infra',
    ownerName: 'Suresh Patel',
    city: 'Ahmedabad',
    rating: 5,
    review: 'The DomainCampaign team manages all our social media and Google ads. We have seen a 3x increase in enquiries since we started.',
    avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200',
    product: 'DomainCampaign Business',
  },
  {
    id: 't5',
    businessName: 'Glow Beauty Lounge',
    ownerName: 'Anjali Reddy',
    city: 'Hyderabad',
    rating: 5,
    review: 'The salon website looks absolutely premium. Clients book appointments online and I get WhatsApp notifications instantly.',
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200',
    product: 'DomainApp Startup',
  },
  {
    id: 't6',
    businessName: 'Bright Future Academy',
    ownerName: 'Vikram Singh',
    city: 'Jaipur',
    rating: 5,
    review: 'Our school website showcases everything beautifully. Admissions enquiries have doubled since going live with Get4Domain.',
    avatar: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=200',
    product: 'DomainApp Enterprise',
  },
];

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export const faqs: FAQItem[] = [
  {
    id: 'faq1',
    question: 'How long does it take to launch my business online?',
    answer: 'Once you book a demo and share your requirements, our team designs, develops and deploys your professional business website typically within a few business days. Complex projects take longer — we give you a clear timeline upfront.',
    category: 'general',
  },
  {
    id: 'faq2',
    question: 'What is the difference between DomainApp Startup and Enterprise?',
    answer: 'DomainApp Startup is perfect for businesses that need a professional website with basic CRM, lead forms and WhatsApp integration. Enterprise includes the full Business OS — CRM, HR, payroll, accounting, invoicing, inventory, reporting and much more.',
    category: 'products',
  },
  {
    id: 'faq3',
    question: 'Do I need technical knowledge to use Get4Domain?',
    answer: 'No technical knowledge is required. You book a demo, share your business details, and our team handles everything from design to deployment. You get a dashboard to manage your content easily.',
    category: 'general',
  },
  {
    id: 'faq4',
    question: 'What is DomainCampaign?',
    answer: 'DomainCampaign is a fully managed digital marketing platform. Our team runs your social media, creates content, manages SEO, posts on Google Business Profile and sends monthly reports — you just watch your leads grow.',
    category: 'products',
  },
  {
    id: 'faq5',
    question: 'How do I pay after booking a demo?',
    answer: 'After your demo and requirement discussion, we share a payment link on your dashboard. You can pay via Razorpay — UPI, Credit/Debit Card, or Net Banking. Invoice is generated automatically after payment.',
    category: 'payments',
  },
  {
    id: 'faq6',
    question: 'Can I upgrade my plan later?',
    answer: 'Yes. You can upgrade from Startup to Enterprise at any time by paying the difference. You can also add DomainCampaign to your existing DomainApp subscription.',
    category: 'products',
  },
  {
    id: 'faq7',
    question: 'What industries do you support?',
    answer: 'We support 20+ industries including Restaurant, Travel, Healthcare, Education, Real Estate, Retail, Beauty, Fitness, Construction, Finance, Automobile, Logistics, Diagnostics, Hotel, Photography, IT, Agriculture and more.',
    category: 'general',
  },
  {
    id: 'faq8',
    question: 'Is there a refund policy?',
    answer: 'Yes. If we fail to deliver as per the agreed scope and timeline, we offer a full refund. Please read our Refund Policy page for full details.',
    category: 'payments',
  },
];

export const domainAppStartupFeatures = [
  'Professional Business Website',
  'CMS — Easy Content Management',
  'Company Profile & Services Pages',
  'Products / Services Showcase',
  'Gallery & Blog',
  'Lead Capture Forms',
  'WhatsApp Chat Integration',
  'Google Maps Integration',
  'Basic SEO Setup',
  'Contact & Enquiry Forms',
  'Basic CRM Dashboard',
  'Business Analytics',
  'SSL Certificate & Hosting',
  '30 Days Support',
];

export const domainAppEnterpriseFeatures = [
  'Everything in Startup',
  'Advanced Lead CRM',
  'Customer CRM',
  'Telecalling CRM',
  'Quotation & Estimate',
  'GST Invoice Generator',
  'Payment Collection',
  'Outstanding Reports',
  'Accounting (Income/Expense)',
  'Cash Book & Bank Book',
  'Profit & Loss Statement',
  'HR — Employees & Departments',
  'Attendance & Leave Management',
  'Payroll & Salary Slips',
  'Task Assignment & Daily Work Register',
  'Inventory Management',
  'Poster Designer & Festival Posters',
  'WhatsApp Bot',
  'Business Reports Dashboard',
  'API & Webhook Access',
];

export const domainCampaignStarterFeatures = [
  '15 Social Media Posts / Month',
  '20 Poster Designs / Month',
  'SEO — 4 Keywords',
  'Google Business Profile Setup',
  '3 Monthly GBP Updates',
  'Directory Submission',
  'Social Profile Creation & Optimization',
  'Monthly Performance Report',
];

export const domainCampaignBusinessFeatures = [
  'Everything in Starter',
  '120 Social Posts / Month',
  '150 Poster Designs / Month',
  '10 Blog Articles / Month',
  'SEO — 10 Keywords',
  '12 Monthly GBP Updates',
  'Monthly Directory Submission',
  'Creative Content Requests',
  'Landing Pages for Campaigns',
  'Detailed Campaign Reports',
  'Lead Reports & Analytics',
];

export const howItWorksSteps = [
  { id: 's1', title: 'Book a Demo', description: 'Fill a short form with your industry and business details. Our consultant will call you within 24 hours.', icon: 'Calendar' },
  { id: 's2', title: 'Requirement Discussion', description: 'We understand your goals, show demos of live websites and recommend the right plan for your business.', icon: 'MessageCircle' },
  { id: 's3', title: 'Plan & Payment', description: 'Choose your plan. Pay securely via Razorpay from your dashboard — UPI, card or net banking.', icon: 'CreditCard' },
  { id: 's4', title: 'Design & Build', description: 'Our team designs and builds your complete business solution — website, CRM, modules as per your plan.', icon: 'Settings' },
  { id: 's5', title: 'Review & Launch', description: 'Review your platform, request adjustments, and go live. Your business is online and ready to grow.', icon: 'Rocket' },
];
