import type { WebsiteTemplate } from './template';
import { THEMES } from './themes';
import { IMG } from './content';

/**
 * Phase-1 seed template library (in-code for now; Phase 2 moves these into the DB via
 * the admin authoring UI, same shape). Each entry is a fully data-driven layout that
 * renders for any vendor via resolveTemplate — proving a vendor can switch to a visibly
 * different design with no redeploy. `gym-bold` is deliberately distinct from the default
 * gym site: panel hero, an orange accent, a tiles showcase and a pricing table.
 */
export const SAMPLE_TEMPLATES: Record<string, WebsiteTemplate> = {
  'gym-bold': {
    id: 'gym-bold',
    name: 'Bold Fitness',
    industry: 'gym',
    brandDefaults: {
      name: 'IronCore Fitness',
      tagline: 'Stronger Every Day.',
      about: 'Expert coaches, high-energy classes and 24×7 access — a gym that shows up for you.',
    },
    theme: { ...THEMES.gym, accent: '#FF5A1F', accent2: '#FFB088', accentFg: '#1A0A03' },
    choices: ['Membership', 'Personal Training', 'Group Classes', 'Day Pass'],
    choiceLabel: 'Interested in',
    nav: [
      { href: '#programs', label: 'Programs' },
      { href: '#coaches', label: 'Coaches' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#enquiry', label: 'Join' },
    ],
    bottomNav: [
      { label: 'Home', icon: 'home', href: '#top' },
      { label: 'Programs', icon: 'services', href: '#programs' },
      { label: 'Join', icon: 'book', href: '#enquiry', emphasis: true },
      { label: 'Coaches', icon: 'users', href: '#coaches' },
      { label: 'More', icon: 'more', href: '#pricing' },
    ],
    primaryCta: { intent: 'engine.enquiry', label: 'Join Now', kind: 'booking' },
    sections: [
      {
        type: 'hero', variant: 'panel', eyebrow: 'Bold Fitness',
        headline: 'Stronger Every Day.',
        subline: 'Train with expert coaches in a space built for results — strength, conditioning and group energy.',
        highlight: 'Expert coaches · 24×7 access · First session free', image: IMG.gym[0],
        ctaPrimary: { label: 'Join Now', href: '#enquiry' }, ctaSecondary: { label: 'View Programs', href: '#programs' },
      },
      { type: 'stats', items: [
        { value: '2,000+', label: 'Members' }, { value: '25', label: 'Classes / week' },
        { value: '12', label: 'Coaches' }, { value: '24×7', label: 'Access' },
      ] },
      { type: 'showcase', id: 'programs', variant: 'tiles', eyebrow: 'Train', title: 'Programs for every goal', sub: 'Build strength, burn fat, or train for sport.', items: [
        { title: 'Strength & Conditioning', subtitle: 'Coached', desc: 'Progressive programming, real results.', image: IMG.gym[1] },
        { title: 'Group HIIT', subtitle: 'High energy', desc: '45-minute fat-burning classes.', image: IMG.gym[2] },
        { title: 'Personal Training', subtitle: '1-on-1', desc: 'A coach in your corner, every session.', image: IMG.gym[3] },
      ] },
      { type: 'people', id: 'coaches', eyebrow: 'Our team', title: 'Meet the coaches', sub: 'Certified, motivating, in your corner.', items: [
        { name: 'Arjun Rao', role: 'Head Coach', note: 'S&C · 10 yrs' },
        { name: 'Meera Iyer', role: 'HIIT & Mobility', note: 'NASM certified' },
        { name: 'Karan Shah', role: 'Personal Trainer', note: 'Nutrition + strength' },
      ] },
      { type: 'rows', id: 'pricing', eyebrow: 'Pricing', title: 'Simple membership plans', note: 'No joining fee. Cancel anytime.', items: [
        { label: 'Monthly', value: '₹1,999 / mo' },
        { label: 'Quarterly', value: '₹4,999 / 3 mo' },
        { label: 'Annual', value: '₹14,999 / yr' },
        { label: 'Personal Training', value: 'from ₹800 / session' },
      ] },
      { type: 'faq', id: 'faq', eyebrow: 'FAQ', title: 'Good to know', items: [
        { q: 'Is the first session free?', a: 'Yes — book a free trial session and tour the facility.' },
        { q: 'Do you offer personal training?', a: 'Yes, 1-on-1 and small-group PT with certified coaches.' },
        { q: 'What are your hours?', a: 'Members get 24×7 access with secure entry.' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Join', title: 'Start today', sub: 'Tell us your goal and we’ll set you up with a free first session.', points: ['Free first session', 'No joining fee', 'Cancel anytime'], tabs: [
        { key: 'enquiry', label: 'Enquire', icon: 'MessageSquare', action: { intent: 'engine.enquiry', label: 'Enquire', kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel: 'Send enquiry' },
      ] },
    ],
  },
};
