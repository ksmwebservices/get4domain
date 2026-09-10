export const SITE = {
  name: 'KSM Quantum Technologies',
  short: 'KSM Quantum',
  tagline: 'Building Software. Empowering Businesses.',
  url: 'https://ksmquantum.get4domain.com',
  founded: '2014',
  city: 'Chennai, India',
  email: 'support@get4domain.com',
  address: 'Tidel Park, 1st Floor D Block, Tharamani, Chennai, Tamil Nadu 600113, India',
};

export const NAV = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Products', href: '/products' },
  { label: 'Technology', href: '/technology' },
  { label: 'Contact', href: '/contact' },
];

export interface Product {
  name: string;
  category: string;
  blurb: string;
  href: string;
  domain: string;
  accent: string; // gradient endpoint colour for the card motif
}

export const PRODUCTS: Product[] = [
  {
    name: 'Get4Domain',
    category: 'Business Technology Platform',
    blurb:
      'An all-in-one platform that gives a business its website plus the software to run it — CRM, invoicing, bookings, campaigns and an AI studio — across 20 industries.',
    href: 'https://get4domain.com',
    domain: 'get4domain.com',
    accent: '#6d6cff',
  },
  {
    name: 'SignBot',
    category: 'AI Trading Technology Platform',
    blurb:
      'An AI-driven trading technology platform that turns market signals into structured, automatable decisions for modern traders.',
    href: 'https://signbot.in',
    domain: 'signbot.in',
    accent: '#22d3ee',
  },
  {
    name: 'NextBOS',
    category: 'Next-Generation Business Operating System',
    blurb:
      'A next-generation business operating system that unifies operations, data and workflows into one intelligent control layer for growing companies.',
    href: 'https://nextbos.ai',
    domain: 'nextbos.ai',
    accent: '#a78bfa',
  },
  {
    name: 'HiDude',
    category: 'AI-Powered Digital Assistant',
    blurb:
      'An AI-powered digital assistant that helps people and teams get things done through natural, conversational interfaces.',
    href: 'https://hidude.ai',
    domain: 'hidude.ai',
    accent: '#34d399',
  },
];

export interface Capability {
  title: string;
  icon: string; // lucide icon name
  desc: string;
}

export const CAPABILITIES: Capability[] = [
  { title: 'Software Engineering', icon: 'Code2', desc: 'Product-grade systems built to last — clean architecture, typed end to end, and engineered for scale rather than demos.' },
  { title: 'Artificial Intelligence', icon: 'BrainCircuit', desc: 'Applied AI woven into real products — assistants, signal engines and automation that do useful work, not novelty.' },
  { title: 'Cloud & Infrastructure', icon: 'Cloud', desc: 'Containerised, observable deployments on resilient cloud infrastructure, shipped continuously and run reliably.' },
  { title: 'Web Platforms', icon: 'Globe', desc: 'Fast, accessible, SEO-strong web applications with server rendering and considered, distinctive interfaces.' },
  { title: 'Mobile Experiences', icon: 'Smartphone', desc: 'Responsive, app-like experiences and progressive web apps that feel native on every screen.' },
  { title: 'Automation', icon: 'Workflow', desc: 'Workflow and process automation that removes manual toil and connects the tools a business already runs on.' },
];

export const STATS = [
  { value: '2014', label: 'Founded in Chennai' },
  { value: '4', label: 'Products built & operated' },
  { value: '20+', label: 'Industries served by our platforms' },
  { value: 'SaaS', label: 'Owned, managed, always-on' },
];
