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
  slug: string;
  category: string;
  blurb: string;
  href: string;
  domain: string;
  accent: string; // gradient endpoint colour for the card motif
  /** true = not yet launched → link to an in-site /products/<slug> Coming Soon page. */
  comingSoon?: boolean;
  /** Longer, feature-level description shown on the Coming Soon page. */
  about?: string;
}

/** Where a product card/link should point: internal Coming Soon page, or its live domain. */
export function productHref(p: Product): string {
  return p.comingSoon ? `/products/${p.slug}` : p.href;
}

export const PRODUCTS: Product[] = [
  {
    name: 'Get4Domain',
    slug: 'get4domain',
    category: 'Business Technology Platform',
    blurb:
      'An all-in-one platform that gives a business its website plus the software to run it — CRM, invoicing, bookings, campaigns and an AI studio — across 20 industries.',
    href: 'https://get4domain.com',
    domain: 'get4domain.com',
    accent: '#6d6cff',
  },
  {
    name: 'SignBot',
    slug: 'signbot',
    category: 'AI Trading Technology Platform',
    blurb:
      'An AI-driven trading technology platform that turns market signals into structured, automatable decisions for modern traders.',
    href: 'https://signbot.in',
    domain: 'signbot.in',
    accent: '#22d3ee',
  },
  {
    name: 'NextBOS',
    slug: 'nextbos',
    category: 'Next-Generation Business Operating System',
    blurb:
      'A next-generation business operating system that unifies operations, data and workflows into one intelligent control layer for growing companies.',
    href: 'https://nextbos.ai',
    domain: 'nextbos.ai',
    accent: '#a78bfa',
    comingSoon: true,
    about:
      'NextBOS is being built as the operating layer a growing company runs on — one place that connects operations, data and workflows instead of a patchwork of disconnected tools. The plan: a unified data model across departments, configurable workflow automation, real-time operational dashboards, role-based access, and an intelligence layer that surfaces what needs attention and can act on routine steps for you. Designed to scale from a single team to a whole organization.',
  },
  {
    name: 'HiDude',
    slug: 'hidude',
    category: 'AI-Powered Digital Assistant',
    blurb:
      'An AI-powered digital assistant that helps people and teams get things done through natural, conversational interfaces.',
    href: 'https://hidude.ai',
    domain: 'hidude.ai',
    accent: '#34d399',
    comingSoon: true,
    about:
      'HiDude is being built as an AI-powered digital assistant that gets real work done through natural conversation — not just answers. The plan: understand a request in plain language, pull the right context, and carry out multi-step tasks across the tools people already use, with memory of past interactions and sensible, permissioned actions. Aimed at individuals and teams who want an assistant that acts, not just chats.',
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
