export const BUSINESS = {
  name: 'Allwin Tours & Travels',
  location: 'Main Road, Gandhi Salai, Cuddalore, Tamil Nadu',
  phone: '8220467673',
  phoneIntl: '918220467673',
  whatsapp: '918220467673',
};

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Tour Packages', href: '/packages' },
  { label: 'Our Fleet', href: '/fleet' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export type Package = {
  slug: string;
  name: string;
  duration: string;
  price: string;
  highlights: string[];
  image: string;
};

export const PACKAGES: Package[] = [
  {
    slug: 'ooty',
    name: 'Ooty Package',
    duration: '2D/1N',
    price: '4,500',
    highlights: ['Botanical Gardens', 'Ooty Lake', 'Tea Estates'],
    image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&h=400&fit=crop',
  },
  {
    slug: 'kodaikanal',
    name: 'Kodaikanal Package',
    duration: '2D/1N',
    price: '4,800',
    highlights: ['Kodai Lake', 'Bryant Park', 'Pillar Rocks'],
    image: 'https://images.unsplash.com/photo-1606298855672-3efb63017be8?w=600&h=400&fit=crop',
  },
  {
    slug: 'tirupati',
    name: 'Tirupati Pilgrimage',
    duration: '1D',
    price: '2,500',
    highlights: ['Tirumala Temple', 'Alipiri', 'Kapila Theertham'],
    image: 'https://images.unsplash.com/photo-1545158535-c3f7168c28b6?w=600&h=400&fit=crop',
  },
  {
    slug: 'rameswaram',
    name: 'Rameswaram Tour',
    duration: '2D/1N',
    price: '3,500',
    highlights: ['Ramanathaswamy Temple', 'Dhanushkodi', 'Pamban Bridge'],
    image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&h=400&fit=crop',
  },
  {
    slug: 'kanyakumari',
    name: 'Kanyakumari Tour',
    duration: '1D',
    price: '3,000',
    highlights: ['Sunrise Point', 'Vivekananda Rock', 'Thiruvalluvar Statue'],
    image: 'https://images.unsplash.com/photo-1516937941344-00b4e0337589?w=600&h=400&fit=crop',
  },
  {
    slug: 'pondicherry',
    name: 'Pondicherry Day Trip',
    duration: '1D',
    price: '2,000',
    highlights: ['Auroville', 'French Quarter', 'Paradise Beach'],
    image: 'https://images.unsplash.com/photo-1598847461268-75e25e4c8fd7?w=600&h=400&fit=crop',
  },
];

export type Vehicle = {
  name: string;
  seats: string;
  tags: string[];
  image: string;
};

export const FLEET: Vehicle[] = [
  {
    name: 'Toyota Innova Crysta',
    seats: '7 Seater',
    tags: ['AC', 'GPS Tracked'],
    image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=600&h=400&fit=crop',
  },
  {
    name: 'Swift Dzire / Sedan',
    seats: '4 Seater',
    tags: ['AC', 'Comfortable'],
    image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&h=400&fit=crop',
  },
  {
    name: 'Maruti Ertiga / MPV',
    seats: '7 Seater',
    tags: ['AC', 'Family Friendly'],
    image: 'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=600&h=400&fit=crop',
  },
  {
    name: 'Tempo Traveller',
    seats: '12 Seater',
    tags: ['AC', 'Group Tours'],
    image: 'https://mrtravelstours.vercel.app/bus_interior1.jpeg',
  },
  {
    name: 'Mini Bus',
    seats: '20 Seater',
    tags: ['AC', 'Corporate'],
    image: 'https://mrtravelstours.vercel.app/bus_exterior.jpeg',
  },
];

export type Service = {
  icon: string;
  title: string;
  description: string;
};

export const SERVICES: Service[] = [
  {
    icon: '🛕',
    title: 'Pilgrimage Tours',
    description: 'Tirupati, Rameswaram, Shirdi, Kashi & all major temple circuits.',
  },
  {
    icon: '✈️',
    title: 'Airport Transfers',
    description: '24/7 pickup & drop to Chennai airport. Always on time.',
  },
  {
    icon: '🏔️',
    title: 'Tour Packages',
    description: 'Ooty, Kodaikanal, Coorg, Kerala — customised packages.',
  },
  {
    icon: '💒',
    title: 'Wedding Transport',
    description: 'Decorated vehicles for your special day.',
  },
  {
    icon: '🏢',
    title: 'Corporate Trips',
    description: 'Employee transport and corporate outings.',
  },
  {
    icon: '🚗',
    title: 'Cab Rentals',
    description: 'Daily rental, outstation travel with professional drivers.',
  },
];

export const WHY_CHOOSE_US = [
  { icon: '❄️', title: 'AC Vehicles', description: 'Clean and comfortable' },
  { icon: '👨‍✈️', title: 'Expert Drivers', description: 'Licensed and verified' },
  { icon: '⏱️', title: 'On-Time Service', description: 'Punctual always' },
  { icon: '📞', title: '24/7 Support', description: 'Always available' },
  { icon: '📍', title: 'GPS Tracking', description: 'Real-time tracking' },
  { icon: '💰', title: 'Best Prices', description: 'No hidden charges' },
];

export type Testimonial = {
  text: string;
  author: string;
  location: string;
  rating: number;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    text: 'Excellent service for our Tirupati trip! Very clean vehicle and professional driver. Highly recommend!',
    author: 'Murugan',
    location: 'Cuddalore',
    rating: 5,
  },
  {
    text: 'Booked for our family tour to Ooty. Perfect journey, comfortable vehicle, reached on time.',
    author: 'Lakshmi',
    location: 'Villupuram',
    rating: 5,
  },
  {
    text: 'Used for airport drop at 3am. Driver was very punctual and professional. Great service!',
    author: 'Karthik',
    location: 'Cuddalore',
    rating: 5,
  },
  {
    text: 'Good service for our corporate trip. Clean vehicle and experienced driver.',
    author: 'Priya',
    location: 'Chennai',
    rating: 4,
  },
];

export const BOOKING_SERVICES = [
  'Tirupati Pilgrimage',
  'Rameswaram Tour',
  'Ooty Package',
  'Kodaikanal Package',
  'Kanyakumari Tour',
  'Pondicherry Day Trip',
  'Airport Transfer',
  'Wedding Transport',
  'Corporate Trip',
  'Cab Rental',
  'Other',
];
