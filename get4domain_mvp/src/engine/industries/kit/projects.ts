import type { EngineSiteData } from '../../types';
import type { KitSiteModel, EnquiryTab, BottomNavItem } from '../../kit/model';
import { THEMES } from '../../kit/themes';
import { brandFrom, itemsFrom, IMG } from '../../kit/content';

const nav = (...items: [string, string][]) => items.map(([href, label]) => ({ href, label }));
const bn = (label: string, icon: string, href: string, emphasis = false): BottomNavItem => ({ label, icon, href, emphasis });
const enquire = (label = 'Enquire'): EnquiryTab => ({ key: 'enquiry', label, icon: 'MessageSquare', action: { intent: 'engine.enquiry', label, kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel: 'Send enquiry' });
const quoteTab = (label: string, submitLabel: string): EnquiryTab => ({ key: 'quote', label, icon: 'Calculator', action: { intent: 'engine.enquiry', label, kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel });
const callTab = (label: string, submitLabel: string): EnquiryTab => ({ key: 'call', label, icon: 'CalendarCheck', action: { intent: 'engine.enquiry', label, kind: 'booking' }, fields: ['choice', 'date', 'message'], submitLabel });

/* ── CONSTRUCTION — BuildRight Constructions (§26 style) ── */
export function buildConstruction(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'BuildRight Constructions', tagline: 'Built Right. Delivered on Time.', about: 'A construction firm that treats deadlines and budgets as promises — from turnkey homes to commercial builds, engineered to last.' });
  const services = itemsFrom(site, [
    { title: 'Turnkey Home Construction', desc: 'Design to handover, single point of accountability.', image: IMG.construction[0] },
    { title: 'Commercial & Industrial', desc: 'Offices, warehouses and retail builds.', image: IMG.construction[1] },
    { title: 'Renovation & Interiors', desc: 'Modernise without the chaos.', image: IMG.construction[2] },
  ]);
  return {
    brand: b, theme: THEMES.construction, choices: ['Home construction', 'Commercial', 'Renovation', 'Consultation'], choiceLabel: 'Project type',
    nav: nav(['#services', 'Services'], ['#projects', 'Projects'], ['#how', 'Process'], ['#why', 'Why us']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Services', 'services', '#services'), bn('Projects', 'building', '#projects'), bn('Enquiry', 'enquiry', '#enquiry', true), bn('More', 'more', '#why')],
    primaryCta: { intent: 'engine.enquiry', label: 'Request a Quote', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Now taking projects', headline: b.tagline, subline: b.about, highlight: 'Fixed timelines · Transparent costing · Quality-checked', image: IMG.construction[0],
        ctaPrimary: { label: 'Request a Quote', href: '#enquiry' }, ctaSecondary: { label: 'View Projects', href: '#projects' } },
      { type: 'showcase', id: 'services', variant: 'cards', eyebrow: 'What we build', title: 'Services', items: services },
      { type: 'stats', items: [{ value: '200+', label: 'Projects delivered' }, { value: '100%', label: 'On-time record' }, { value: '18 yrs', label: 'Experience' }, { value: 'ISO', label: 'Quality certified' }] },
      { type: 'showcase', id: 'projects', variant: 'tiles', eyebrow: 'Portfolio', title: 'Recent builds', items: itemsFrom(site, [
        { title: 'Residential Tower', image: IMG.construction[1] }, { title: 'Corporate Office', image: IMG.construction[2] },
        { title: 'Warehouse', image: IMG.construction[3] }, { title: 'Villa Community', image: IMG.construction[0] },
      ]) },
      { type: 'steps', id: 'how', eyebrow: 'Process', title: 'How we deliver', items: [
        { title: 'Consult', desc: 'Scope, site and budget.' }, { title: 'Design & cost', desc: 'Fixed BOQ and timeline.' },
        { title: 'Build', desc: 'Quality-checked stages.' }, { title: 'Handover', desc: 'On time, snag-free.' },
      ] },
      { type: 'iconGrid', id: 'why', eyebrow: 'Why us', title: 'Builders you can trust', items: [
        { label: 'Fixed timelines', icon: 'Clock' }, { label: 'Transparent BOQ', icon: 'Ruler' }, { label: 'Quality checks', icon: 'HardHat' },
        { label: 'Certified engineers', icon: 'Award' }, { label: 'Safety-first sites', icon: 'ShieldCheck' }, { label: 'Warranty on work', icon: 'Hammer' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Start', title: 'Request a project quote', sub: 'Tell us about your project — we\'ll respond with a clear plan and estimate.', points: ['Fixed timelines', 'Transparent costing', 'Quality-checked'], tabs: [quoteTab('Request a Quote', 'Send project brief'), callTab('Book a site consultation', 'Book consultation')] },
    ],
  };
}

/* ── TECHNOLOGY / IT — CodeCraft Technologies (§26 style) ── */
export function buildTechnology(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'CodeCraft Technologies', tagline: 'Software That Moves Your Business.', about: 'A product and engineering studio building web, mobile and cloud software — shipped fast, built to scale, backed by real support.' });
  const services = itemsFrom(site, [
    { title: 'Web & Mobile Apps', desc: 'From MVP to scale, in modern stacks.', image: IMG.technology[0] },
    { title: 'Cloud & DevOps', desc: 'Reliable, secure, cost-efficient infra.', image: IMG.technology[1] },
    { title: 'AI & Automation', desc: 'Put your data and workflows to work.', image: IMG.technology[2] },
  ]);
  return {
    brand: b, theme: THEMES.technology, choices: ['Web / mobile app', 'Cloud / DevOps', 'AI / automation', 'Not sure'], choiceLabel: 'What you need',
    nav: nav(['#services', 'Services'], ['#work', 'Work'], ['#how', 'Process'], ['#reviews', 'Clients']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Services', 'services', '#services'), bn('Work', 'grid', '#work'), bn('Enquiry', 'enquiry', '#enquiry', true), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Book a Call', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Engineering studio', headline: b.tagline, subline: b.about, highlight: 'Senior engineers · Fixed sprints · Real support', image: IMG.technology[0],
        ctaPrimary: { label: 'Book a Call', href: '#enquiry' }, ctaSecondary: { label: 'View Work', href: '#work' } },
      { type: 'showcase', id: 'services', variant: 'cards', eyebrow: 'What we do', title: 'Services', items: services },
      { type: 'featureIndex', id: 'work', eyebrow: 'How we\'re different', title: 'Not another agency', items: [
        { label: 'Senior-only teams', blurb: 'No junior hand-offs.' }, { label: 'Ship in sprints', blurb: 'Working software every 2 weeks.' },
        { label: 'Own your code', blurb: 'Clean handover, no lock-in.' }, { label: 'Support that stays', blurb: 'We don\'t vanish at launch.' },
      ] },
      { type: 'stats', items: [{ value: '120+', label: 'Products shipped' }, { value: '40+', label: 'Engineers' }, { value: '4.9★', label: 'Client rating' }, { value: '99.9%', label: 'Uptime' }] },
      { type: 'steps', id: 'how', eyebrow: 'Process', title: 'From idea to launch', items: [
        { title: 'Discovery', desc: 'Goals, scope, estimate.' }, { title: 'Design', desc: 'UX and architecture.' },
        { title: 'Build', desc: 'Sprints with demos.' }, { title: 'Launch & scale', desc: 'Monitor and iterate.' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Clients', title: 'What founders say', items: [
        { quote: 'They shipped our MVP in six weeks and it actually scaled.', author: 'Founder, fintech' },
        { quote: 'Senior engineers from day one — it showed in the quality.', author: 'CTO, SaaS' },
        { quote: 'Post-launch support has been genuinely excellent.', author: 'Product Head' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Start', title: 'Book a discovery call', sub: 'Tell us what you\'re building — we\'ll come with ideas and an estimate.', points: ['Senior engineers', 'Fixed-scope sprints', 'You own the code'], tabs: [callTab('Book a Call', 'Book call'), quoteTab('Get an estimate', 'Send brief')] },
    ],
  };
}

/* ── LOGISTICS — SwiftShip Logistics (§26 style) ── */
export function buildLogistics(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'SwiftShip Logistics', tagline: 'Delivered. On Time, Every Time.', about: 'Freight, transport and last-mile logistics with live tracking and dependable timelines — moving your goods without the guesswork.' });
  const services = itemsFrom(site, [
    { title: 'Full & Part Truck Load', desc: 'Nationwide road freight, any volume.', image: IMG.logistics[0] },
    { title: 'Warehousing & Fulfilment', desc: 'Store, pick, pack and dispatch.', image: IMG.logistics[1] },
    { title: 'Last-Mile Delivery', desc: 'Fast, tracked, city-wide.', image: IMG.logistics[2] },
  ]);
  return {
    brand: b, theme: THEMES.logistics, choices: ['Road freight', 'Warehousing', 'Last-mile', 'End-to-end'], choiceLabel: 'Service',
    nav: nav(['#services', 'Services'], ['#why', 'Why us'], ['#how', 'How it works'], ['#reviews', 'Clients']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Services', 'services', '#services'), bn('Quote', 'quote', '#enquiry', true), bn('Track', 'track', '#how'), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Get a Quote', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Pan-India network', headline: b.tagline, subline: b.about, highlight: 'Live tracking · On-time SLAs · Nationwide reach', image: IMG.logistics[0],
        ctaPrimary: { label: 'Get a Quote', href: '#enquiry' }, ctaSecondary: { label: 'Track Shipment', href: '#how' } },
      { type: 'showcase', id: 'services', variant: 'cards', eyebrow: 'Services', title: 'What we move', items: services },
      { type: 'stats', items: [{ value: '2M+', label: 'Shipments / yr' }, { value: '600+', label: 'Cities' }, { value: '98.7%', label: 'On-time' }, { value: 'Live', label: 'Tracking' }] },
      { type: 'iconGrid', id: 'why', eyebrow: 'Why us', title: 'Logistics without surprises', items: [
        { label: 'Real-time tracking', icon: 'MapPin' }, { label: 'On-time SLAs', icon: 'Clock' }, { label: 'Nationwide network', icon: 'Truck' },
        { label: 'Insured cargo', icon: 'ShieldCheck' }, { label: 'Dedicated manager', icon: 'Phone' }, { label: 'Flexible capacity', icon: 'Package' },
      ] },
      { type: 'steps', id: 'how', eyebrow: 'Simple', title: 'How it works', items: [
        { title: 'Quote', desc: 'Route, load and timeline.' }, { title: 'Pickup', desc: 'Scheduled and confirmed.' },
        { title: 'In transit', desc: 'Track every step live.' }, { title: 'Delivered', desc: 'Proof of delivery, instant.' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Clients', title: 'Trusted by shippers', items: [
        { quote: 'Live tracking ended the endless "where\'s my shipment" calls.', author: 'Ops Head, D2C' },
        { quote: 'They scaled with us through peak season without a hitch.', author: 'Founder, retail' },
        { quote: 'On-time percentage is exactly as promised. Rare.', author: 'Supply chain lead' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Quote', title: 'Get a shipping quote', sub: 'Tell us the route and load — we\'ll send pricing and timelines fast.', points: ['Live tracking', 'On-time SLAs', 'Nationwide reach'], tabs: [quoteTab('Get a Quote', 'Request quote'), enquire('Talk to sales')] },
    ],
  };
}
