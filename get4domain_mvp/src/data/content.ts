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
    coverImage: '/demo-library/pexels-958545.jpg',
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
    coverImage: '/demo-library/pexels-3601425.jpg',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    features: ['Tour Packages', 'Itinerary Builder', 'Booking Form', 'Trip Gallery'],
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    description: 'Property listings, virtual tours, agent profiles and inquiry forms.',
    icon: Building2,
    coverImage: '/demo-library/pexels-323780.jpg',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    features: ['Property Listings', 'Agent Profiles', 'Enquiry Forms', 'Map View'],
  },
  {
    id: 'clinic',
    name: 'Clinic & Hospital',
    description: 'Doctor profiles, appointment booking, services and patient information.',
    icon: HeartPulse,
    coverImage: '/demo-library/pexels-263402.jpg',
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
    coverImage: '/demo-library/pexels-207692.jpg',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    features: ['Course Catalog', 'Admission Form', 'Faculty Profiles', 'Event Calendar'],
  },
  {
    id: 'construction',
    name: 'Construction & Interior',
    description: 'Project portfolios, service catalogs, quotes and material galleries.',
    icon: HardHat,
    coverImage: '/demo-library/pexels-159306.jpg',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    features: ['Project Portfolio', 'Quote Request', 'Team Profiles', 'Material Gallery'],
  },
  {
    id: 'retail',
    name: 'Retail & Shopping',
    description: 'Product catalogs, store locator, offers and customer reviews.',
    icon: ShoppingBag,
    coverImage: '/demo-library/pexels-264636.jpg',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    features: ['Product Catalog', 'Offers Section', 'Store Locator', 'Reviews'],
    badge: 'Popular',
  },
  {
    id: 'salon',
    name: 'Salon & Spa',
    description: 'Service menus, appointment booking, galleries and stylist profiles.',
    icon: Sparkles,
    coverImage: '/demo-library/pexels-3993449.jpg',
    color: 'text-fuchsia-600',
    bgColor: 'bg-fuchsia-50',
    features: ['Service Menu', 'Appointment Booking', 'Before/After Gallery', 'Stylists'],
  },
  {
    id: 'gym',
    name: 'Gym & Fitness',
    description: 'Class schedules, trainer profiles, membership plans and galleries.',
    icon: Dumbbell,
    coverImage: '/demo-library/pexels-1954524.jpg',
    color: 'text-lime-600',
    bgColor: 'bg-lime-50',
    features: ['Class Schedule', 'Trainer Profiles', 'Membership Plans', 'Gallery'],
  },
  {
    id: 'professional',
    name: 'CA & Professional Services',
    description: 'Service listings, team profiles, case studies and contact forms.',
    icon: Briefcase,
    coverImage: '/demo-library/pexels-3184465.jpg',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    features: ['Service Listings', 'Team Profiles', 'Case Studies', 'Client Enquiry'],
  },
  {
    id: 'events',
    name: 'Events & Entertainment',
    description: 'Event galleries, booking forms, packages and client showcases.',
    icon: PartyPopper,
    coverImage: '/demo-library/pexels-169198.jpg',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    features: ['Event Gallery', 'Package Details', 'Booking Form', 'Client Showcase'],
  },
  {
    id: 'finance',
    name: 'Finance & Insurance',
    description: 'Service catalogs, policy details, calculators and inquiry forms.',
    icon: Landmark,
    coverImage: '/demo-library/pexels-356056.jpg',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    features: ['Service Catalog', 'Policy Details', 'Premium Calculator', 'Enquiry'],
  },
  {
    id: 'automobile',
    name: 'Automobile & Showroom',
    description: 'Vehicle listings, test drive booking, service center and offers.',
    icon: Car,
    coverImage: '/demo-library/pexels-3802510.jpg',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    features: ['Vehicle Listings', 'Test Drive Booking', 'EMI Calculator', 'Service Center'],
  },
  {
    id: 'logistics',
    name: 'Logistics & Transport',
    description: 'Fleet management, route tracking, service areas and freight booking.',
    icon: Truck,
    coverImage: '/demo-library/pexels-2199293.jpg',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    features: ['Fleet Info', 'Service Areas', 'Freight Enquiry', 'Route Planning'],
  },
  {
    id: 'diagnostics',
    name: 'Diagnostic Lab',
    description: 'Test packages, home collection, report tracking and health packages.',
    icon: Stethoscope,
    coverImage: '/demo-library/pexels-4226119.jpg',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    features: ['Test Packages', 'Home Collection', 'Report Download', 'Health Packages'],
  },
  {
    id: 'hotel',
    name: 'Hotel & Hospitality',
    description: 'Room listings, amenities, booking form and guest reviews.',
    icon: Hotel,
    coverImage: '/demo-library/pexels-338504.jpg',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    features: ['Room Listings', 'Amenities', 'Online Booking', 'Guest Reviews'],
  },
  {
    id: 'photography',
    name: 'Photography & Studio',
    description: 'Portfolio galleries, package pricing, booking forms and client work.',
    icon: Camera,
    coverImage: '/demo-library/pexels-1264210.jpg',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    features: ['Portfolio Gallery', 'Package Pricing', 'Booking Form', 'Client Work'],
  },
  {
    id: 'technology',
    name: 'IT & Software Company',
    description: 'Service showcase, case studies, tech stack and team profiles.',
    icon: Cpu,
    coverImage: '/demo-library/pexels-3183150.jpg',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    features: ['Service Showcase', 'Case Studies', 'Tech Stack', 'Team Profiles'],
  },
  {
    id: 'agriculture',
    name: 'Agriculture & Farm',
    description: 'Product catalog, farm details, bulk orders and seasonal offers.',
    icon: Leaf,
    coverImage: '/demo-library/pexels-1595104.jpg',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    features: ['Product Catalog', 'Farm Details', 'Bulk Orders', 'Seasonal Offers'],
  },
  {
    id: 'coaching',
    name: 'Coaching & Tuition',
    description: 'Course listings, faculty, batch schedules and admission enquiry.',
    icon: BookOpen,
    coverImage: '/demo-library/pexels-4145153.jpg',
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
    previewImage: '/demo-library/pexels-958545.jpg',
    features: ['Digital Menu', 'Table Reservation', 'Online Ordering', 'Food Gallery', 'Reviews Section'],
    pagesIncluded: ['Home', 'Menu', 'About', 'Gallery', 'Reservation', 'Contact'],
  },
  {
    id: 'travel-a',
    name: 'Wanderlust Pro',
    industryId: 'travel',
    previewImage: '/demo-library/pexels-3601425.jpg',
    features: ['Tour Packages', 'Itinerary Builder', 'Booking Form', 'Destination Gallery', 'Travel Blog'],
    pagesIncluded: ['Home', 'Packages', 'Destinations', 'About', 'Blog', 'Contact'],
  },
  {
    id: 'realestate-a',
    name: 'Estate Prime',
    industryId: 'realestate',
    previewImage: '/demo-library/pexels-323780.jpg',
    features: ['Property Listings', 'Virtual Tours', 'Agent Profiles', 'Mortgage Calculator', 'Inquiry Forms'],
    pagesIncluded: ['Home', 'Properties', 'Agents', 'About', 'Blog', 'Contact'],
  },
  {
    id: 'healthcare-a',
    name: 'CareWell Medical',
    industryId: 'clinic',
    previewImage: '/demo-library/pexels-263402.jpg',
    features: ['Doctor Profiles', 'Appointment Booking', 'Service Catalog', 'Patient Portal', 'Emergency Contact'],
    pagesIncluded: ['Home', 'Services', 'Doctors', 'About', 'Appointment', 'Contact'],
  },
  {
    id: 'education-a',
    name: 'Scholar Academy',
    industryId: 'education',
    previewImage: '/demo-library/pexels-207692.jpg',
    features: ['Course Catalog', 'Admission Form', 'Faculty Profiles', 'Campus Gallery', 'Event Calendar'],
    pagesIncluded: ['Home', 'Courses', 'Faculty', 'About', 'Admissions', 'Contact'],
  },
  {
    id: 'construction-a',
    name: 'BuildPro',
    industryId: 'construction',
    previewImage: '/demo-library/pexels-159306.jpg',
    features: ['Project Portfolio', 'Service Catalog', 'Quote Request', 'Material Gallery', 'Team Profiles'],
    pagesIncluded: ['Home', 'Projects', 'Services', 'About', 'Quote', 'Contact'],
  },
  {
    id: 'retail-a',
    name: 'ShopWave',
    industryId: 'retail',
    previewImage: '/demo-library/pexels-264636.jpg',
    features: ['Product Catalog', 'Store Locator', 'Offers Section', 'Customer Reviews', 'Loyalty Program'],
    pagesIncluded: ['Home', 'Products', 'Stores', 'About', 'Offers', 'Contact'],
  },
  {
    id: 'beauty-a',
    name: 'Glow Studio',
    industryId: 'salon',
    previewImage: '/demo-library/pexels-3993449.jpg',
    features: ['Service Menu', 'Appointment Booking', 'Before/After Gallery', 'Stylist Profiles', 'Gift Cards'],
    pagesIncluded: ['Home', 'Services', 'Gallery', 'Stylists', 'Booking', 'Contact'],
  },
  {
    id: 'fitness-a',
    name: 'PowerHouse Gym',
    industryId: 'gym',
    previewImage: '/demo-library/pexels-1954524.jpg',
    features: ['Class Schedule', 'Trainer Profiles', 'Membership Plans', 'Workout Gallery', 'Progress Tracking'],
    pagesIncluded: ['Home', 'Classes', 'Trainers', 'Membership', 'Gallery', 'Contact'],
  },
  {
    id: 'professional-a',
    name: 'ConsultPro',
    industryId: 'professional',
    previewImage: '/demo-library/pexels-3184465.jpg',
    features: ['Service Listings', 'Team Profiles', 'Case Studies', 'Client Testimonials', 'Contact Forms'],
    pagesIncluded: ['Home', 'Services', 'Team', 'Case Studies', 'About', 'Contact'],
  },
  {
    id: 'events-a',
    name: 'EventMakers',
    industryId: 'events',
    previewImage: '/demo-library/pexels-169198.jpg',
    features: ['Event Gallery', 'Package Details', 'Booking Form', 'Client Showcase', 'Venue Locator'],
    pagesIncluded: ['Home', 'Events', 'Packages', 'Gallery', 'About', 'Contact'],
  },
  {
    id: 'finance-a',
    name: 'FinSecure',
    industryId: 'finance',
    previewImage: '/demo-library/pexels-356056.jpg',
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
    avatar: '/demo-library/pexels-220453.jpg',
    product: 'DomainApp Startup',
  },
  {
    id: 't2',
    businessName: 'MR Travels',
    ownerName: 'Muthukumar',
    city: 'Chennai',
    rating: 5,
    review: 'Our travel business needed an online presence fast. Get4Domain built a complete fleet management and booking platform. The ERP system helps us manage everything from one place.',
    avatar: '/demo-library/pexels-415829.jpg',
    product: 'DomainApp Enterprise',
  },
  {
    id: 't3',
    businessName: 'CareWell Clinic',
    ownerName: 'Dr. Anil Mehta',
    city: 'Pune',
    rating: 5,
    review: 'The appointment booking system has transformed how we manage patients. Our clinic looks very professional online now.',
    avatar: '/demo-library/pexels-697509.jpg',
    product: 'DomainApp Startup',
  },
  {
    id: 't4',
    businessName: 'BuildRight Infra',
    ownerName: 'Suresh Patel',
    city: 'Ahmedabad',
    rating: 5,
    review: 'The DomainCampaign team manages all our social media and Google ads. We have seen a 3x increase in enquiries since we started.',
    avatar: '/demo-library/pexels-1222271.jpg',
    product: 'DomainCampaign Business',
  },
  {
    id: 't5',
    businessName: 'Glow Beauty Lounge',
    ownerName: 'Anjali Reddy',
    city: 'Hyderabad',
    rating: 5,
    review: 'The salon website looks absolutely premium. Clients book appointments online and I get WhatsApp notifications instantly.',
    avatar: '/demo-library/pexels-774909.jpg',
    product: 'DomainApp Startup',
  },
  {
    id: 't6',
    businessName: 'Bright Future Academy',
    ownerName: 'Vikram Singh',
    city: 'Jaipur',
    rating: 5,
    review: 'Our school website showcases everything beautifully. Admissions enquiries have doubled since going live with Get4Domain.',
    avatar: '/demo-library/pexels-1681010.jpg',
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
