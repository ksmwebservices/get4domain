import type { EngineSiteData } from '../../types';
import type { KitSiteModel, EnquiryTab } from '../../kit/model';
import { THEMES } from '../../kit/themes';
import { brandFrom, itemsFrom, IMG } from '../../kit/content';

/**
 * Appointment / practitioner industries. They share structural DNA (services →
 * practitioners → book) but each gets its OWN theme + hero/showcase variant + section
 * order + copy, so a clinic, a salon, a gym and a photographer read as four different
 * sites. Sub-categories (dental vs eye clinic) flow through the same builder via the
 * demo content injected as CMS — content varies, design does not fork.
 */

const nav = (...items: [string, string][]) => items.map(([href, label]) => ({ href, label }));
const enquire = (label = 'Enquire'): EnquiryTab => ({ key: 'enquiry', label, icon: 'MessageSquare', action: { intent: 'engine.enquiry', label, kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel: 'Send enquiry' });
const bookTab = (label: string, submitLabel: string): EnquiryTab => ({ key: 'book', label, icon: 'CalendarCheck', action: { intent: 'engine.enquiry', label, kind: 'booking' }, fields: ['choice', 'date', 'message'], submitLabel });

export function buildClinic(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { tagline: 'Trusted care, close to home.', about: 'A modern clinic combining experienced doctors, clean facilities and same-day appointments — so getting the right care is simple and stress-free.' });
  const treatments = itemsFrom(site, [
    { title: 'General Consultation', subtitle: 'OPD', price: '₹500', desc: 'Same-day appointments with experienced physicians.', image: IMG.clinic[1] },
    { title: 'Preventive Health Check', subtitle: 'Packages', price: 'from ₹1,499', desc: 'Comprehensive screening with a next-day report.', image: IMG.clinic[2] },
    { title: 'Specialist Care', subtitle: 'Referrals', desc: 'Cardiology, dermatology, orthopaedics and more.', image: IMG.clinic[3] },
  ]);
  return {
    brand: b, theme: THEMES.clinic, choices: ['General Physician', 'Specialist', 'Health Check', 'Not sure'], choiceLabel: 'Department',
    nav: nav(['#treatments', 'Treatments'], ['#doctors', 'Doctors'], ['#facilities', 'Facilities'], ['#how', 'How it works']),
    primaryCta: { intent: 'engine.enquiry', label: 'Book appointment', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Appointments open today', headline: b.tagline, subline: b.about, highlight: 'Same-day appointments · Digital records · Insurance accepted', image: b.logo ? IMG.clinic[0] : IMG.clinic[0] },
      { type: 'stats', items: [{ value: '20+', label: 'Years of care' }, { value: '15k+', label: 'Patients treated' }, { value: '4.9★', label: 'Patient rating' }, { value: 'Same-day', label: 'Appointments' }] },
      { type: 'showcase', id: 'treatments', variant: 'cards', eyebrow: 'What we treat', title: 'Treatments & services', sub: 'Everyday care and specialist consultations under one roof.', items: treatments },
      { type: 'people', id: 'doctors', eyebrow: 'Our team', title: 'Meet the doctors', sub: 'Experienced, empathetic specialists.', items: [
        { name: 'Dr. Meera Rao', role: 'General Physician', note: 'MBBS, MD · 18 yrs' },
        { name: 'Dr. Anil Kumar', role: 'Cardiologist', note: 'DM Cardiology' },
        { name: 'Dr. Farah Sheikh', role: 'Dermatologist', note: 'MD Dermatology' },
        { name: 'Dr. Ravi Nair', role: 'Orthopaedic', note: 'MS Ortho' },
      ] },
      { type: 'iconGrid', id: 'facilities', eyebrow: 'Facilities', title: 'Care you can rely on', items: [
        { label: 'On-site pharmacy', icon: 'Pill' }, { label: 'Digital X-ray & lab', icon: 'Microscope' }, { label: 'Cashless insurance', icon: 'ShieldCheck' },
        { label: 'Emergency support', icon: 'HeartPulse' }, { label: 'Vaccinations', icon: 'Syringe' }, { label: 'Health monitoring', icon: 'Activity' },
      ] },
      { type: 'steps', id: 'how', eyebrow: 'Simple process', title: 'How it works', items: [
        { title: 'Book online', desc: 'Pick a doctor and a slot.' }, { title: 'Consult', desc: 'In-clinic or teleconsult.' },
        { title: 'Treatment', desc: 'Clear plan and prescription.' }, { title: 'Follow-up', desc: 'Digital records, reminders.' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Patients', title: 'What patients say', items: [
        { quote: 'Got an appointment the same day and the doctor actually listened. Spotless clinic.', author: 'Kavya S.' },
        { quote: 'Digital reports on WhatsApp within hours. So convenient for my parents.', author: 'Imran K.' },
        { quote: 'Cashless insurance was smooth and the staff guided us throughout.', author: 'Deepa N.' },
      ] },
      { type: 'faq', id: 'faq', eyebrow: 'Good to know', title: 'Common questions', items: [
        { q: 'Do you accept walk-ins?', a: 'Yes, though booking a slot means little to no wait.' },
        { q: 'Is teleconsultation available?', a: 'Yes — choose teleconsult when booking and you get a secure video link.' },
        { q: 'Do you accept insurance?', a: 'We support cashless claims with most major insurers.' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Book now', title: 'Book your appointment', sub: 'Choose a department and a time that suits you — we confirm within minutes.', points: ['Same-day slots', 'Experienced specialists', 'Digital reports'], tabs: [bookTab('Book appointment', 'Request appointment'), enquire('Ask a question')] },
    ],
  };
}

export function buildSalon(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { tagline: 'Look the way you feel.', about: 'A calm, premium studio for hair, skin and beauty — where skilled stylists and quiet luxury make every appointment feel like time for yourself.' });
  const services = itemsFrom(site, [
    { title: 'Signature Haircut & Style', price: '₹799', desc: 'Consultation, wash, cut and finish.' },
    { title: 'Global Colour', subtitle: 'Premium', price: 'from ₹2,499', desc: 'Ammonia-free colour with a glossing finish.' },
    { title: 'Bridal Makeup', price: 'from ₹8,000', desc: 'HD or airbrush, trial included.' },
    { title: 'Luxury Facial', price: '₹1,499', desc: 'Deep-cleanse, mask and massage.' },
    { title: 'Manicure & Pedicure', price: '₹999', desc: 'Spa-style, gel options available.' },
    { title: 'Keratin Treatment', price: 'from ₹3,999', desc: 'Smooth, frizz-free for months.' },
  ]);
  return {
    brand: b, theme: THEMES.salon, choices: ['Hair', 'Colour', 'Skin', 'Bridal', 'Nails'], choiceLabel: 'Service',
    nav: nav(['#services', 'Services'], ['#stylists', 'Stylists'], ['#gallery', 'Gallery'], ['#experience', 'Experience']),
    primaryCta: { intent: 'engine.enquiry', label: 'Book appointment', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'By appointment', headline: b.tagline, subline: b.about, highlight: 'Master stylists · Premium products · Advance booking', image: IMG.salon[0] },
      { type: 'showcase', id: 'services', variant: 'menu', eyebrow: 'The menu', title: 'Services & pricing', sub: 'Transparent pricing. Every service starts with a consultation.', items: services },
      { type: 'people', id: 'stylists', eyebrow: 'The artists', title: 'Our stylists', items: [
        { name: 'Riya Kapoor', role: 'Creative Director', note: 'Colour specialist' }, { name: 'Sana Mirza', role: 'Senior Stylist', note: 'Bridal & updos' },
        { name: 'Aisha Verma', role: 'Skin Therapist', note: 'Advanced facials' }, { name: 'Neha Rao', role: 'Nail Artist', note: 'Gel & art' },
      ] },
      { type: 'gallery', id: 'gallery', eyebrow: 'Our work', title: 'Recent looks', images: IMG.salon },
      { type: 'iconGrid', id: 'experience', eyebrow: 'The experience', title: 'More than a salon', items: [
        { label: 'Luxe lounge', icon: 'Sparkles' }, { label: 'Premium brands', icon: 'Flower2' }, { label: 'Hygiene-first', icon: 'ShieldCheck' },
        { label: 'Complimentary spa', icon: 'Bath' }, { label: 'Loyalty rewards', icon: 'Gift' }, { label: 'Flexible timings', icon: 'Clock' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Guests', title: 'Loved by regulars', items: [
        { quote: 'Best colour I\'ve had in the city — and they remember exactly what I like.', author: 'Ananya' },
        { quote: 'My bridal look was flawless and lasted the whole day.', author: 'Pooja' },
        { quote: 'Calm, clean and never rushed. My monthly ritual.', author: 'Zara' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Reserve', title: 'Book your chair', sub: 'Tell us the service and a time — we\'ll confirm your stylist.', points: ['Master stylists', 'Premium products', 'Never rushed'], tabs: [bookTab('Book appointment', 'Request booking'), enquire('Ask us')] },
    ],
  };
}

export function buildGym(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { tagline: 'Stronger every single day.', about: 'A serious training floor with expert coaches, group energy and a plan for every body — whether you\'re starting out or chasing a PR.' });
  const programs = itemsFrom(site, [
    { title: 'Strength & Conditioning', subtitle: 'Coached', desc: 'Progressive programming, real results.', image: IMG.gym[1] },
    { title: 'Group HIIT', subtitle: 'High energy', desc: '45-minute fat-burning classes.', image: IMG.gym[2] },
    { title: 'Personal Training', subtitle: '1-on-1', desc: 'A coach in your corner, every session.', image: IMG.gym[3] },
  ]);
  return {
    brand: b, theme: THEMES.gym, choices: ['Monthly', 'Quarterly', 'Annual', 'Personal Training'], choiceLabel: 'Plan',
    nav: nav(['#programs', 'Programs'], ['#plans', 'Plans'], ['#facilities', 'Facilities'], ['#coaches', 'Coaches']),
    primaryCta: { intent: 'engine.enquiry', label: 'Start free trial', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'No excuses', headline: b.tagline, subline: b.about, highlight: 'Expert coaches · 24×7 access · First session free', image: IMG.gym[0] },
      { type: 'stats', items: [{ value: '2,000+', label: 'Members' }, { value: '25', label: 'Classes / week' }, { value: '12', label: 'Coaches' }, { value: '24×7', label: 'Access' }] },
      { type: 'showcase', id: 'programs', variant: 'cards', eyebrow: 'Train', title: 'Programs for every goal', sub: 'Build strength, burn fat, or train for sport.', items: programs },
      { type: 'showcase', id: 'plans', variant: 'menu', eyebrow: 'Membership', title: 'Simple, honest plans', sub: 'No hidden joining fees.', items: [
        { title: 'Monthly', price: '₹1,999', desc: 'Full floor + group classes.' }, { title: 'Quarterly', subtitle: 'Popular', price: '₹4,999', desc: 'Save 16% + 1 PT session.' },
        { title: 'Annual', price: '₹15,999', desc: 'Best value + 6 PT sessions.' }, { title: 'Personal Training', price: 'from ₹6,000', desc: '8 coached sessions / month.' },
      ] },
      { type: 'iconGrid', id: 'facilities', eyebrow: 'The floor', title: 'Everything you need', items: [
        { label: 'Free weights zone', icon: 'Dumbbell' }, { label: 'Functional rig', icon: 'Activity' }, { label: 'Cardio deck', icon: 'HeartPulse' },
        { label: 'Steam & showers', icon: 'Bath' }, { label: 'Locker rooms', icon: 'ShieldCheck' }, { label: 'Supplement bar', icon: 'Salad' },
      ] },
      { type: 'people', id: 'coaches', eyebrow: 'Your corner', title: 'Meet the coaches', items: [
        { name: 'Arjun D.', role: 'Head Coach', note: 'Strength' }, { name: 'Sneha P.', role: 'HIIT Lead', note: 'Conditioning' },
        { name: 'Vikram S.', role: 'PT', note: 'Body recomposition' }, { name: 'Meghna R.', role: 'Mobility', note: 'Recovery' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Results', title: 'Real member results', items: [
        { quote: 'Down 12kg and stronger than I\'ve ever been. The coaching makes the difference.', author: 'Rohit' },
        { quote: 'The 6am HIIT crew keeps me accountable. Best decision this year.', author: 'Priya' },
        { quote: 'Clean equipment, real coaches, no ego. Love it.', author: 'Karan' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Join', title: 'Claim your free session', sub: 'Pick a plan or come try a class free — we\'ll set you up.', points: ['First session free', 'Coached from day one', 'Cancel anytime'], tabs: [bookTab('Free trial', 'Book free session'), { key: 'join', label: 'Join now', icon: 'Trophy', action: { intent: 'engine.enquiry', label: 'Join', kind: 'booking' }, fields: ['choice', 'message'], submitLabel: 'Request membership' }, enquire()] },
    ],
  };
}

export function buildCoaching(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { tagline: 'Coaching that changes outcomes.', about: 'Focused batches, expert mentors and a proven method — for students and professionals who want results, not just classes.' });
  const courses = itemsFrom(site, [
    { title: 'Foundation Batch', subtitle: 'Class 9–10', price: 'from ₹18,000', desc: 'Concept-first teaching with weekly tests.', image: IMG.coaching[0] },
    { title: 'Competitive Exam Prep', subtitle: 'JEE / NEET', price: 'from ₹45,000', desc: 'Full syllabus, mocks and doubt-clearing.', image: IMG.coaching[2] },
    { title: 'Skill & Upskilling', subtitle: 'Professionals', price: 'from ₹9,999', desc: 'Weekend cohorts with live projects.', image: IMG.coaching[3] },
  ]);
  return {
    brand: b, theme: THEMES.coaching, choices: ['Foundation', 'Competitive', 'Skilling', 'Not sure'], choiceLabel: 'Course',
    nav: nav(['#courses', 'Courses'], ['#journey', 'Method'], ['#mentors', 'Mentors'], ['#results', 'Results']),
    primaryCta: { intent: 'engine.enquiry', label: 'Book a counselling call', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Admissions open', headline: b.tagline, subline: b.about, highlight: 'Small batches · Weekly tests · Doubt support', image: IMG.coaching[0] },
      { type: 'showcase', id: 'courses', variant: 'cards', eyebrow: 'Programs', title: 'Courses & batches', sub: 'Structured tracks with clear milestones.', items: courses },
      { type: 'steps', id: 'journey', eyebrow: 'Our method', title: 'How you\'ll progress', items: [
        { title: 'Assessment', desc: 'We map your starting point.' }, { title: 'Focused batch', desc: 'Small groups, expert mentors.' },
        { title: 'Weekly tests', desc: 'Track and correct fast.' }, { title: 'Mentorship', desc: '1-on-1 guidance to the goal.' },
      ] },
      { type: 'people', id: 'mentors', eyebrow: 'Faculty', title: 'Mentors who care', items: [
        { name: 'Prof. S. Iyer', role: 'Physics', note: '20 yrs' }, { name: 'Dr. N. Gupta', role: 'Biology', note: 'NEET expert' },
        { name: 'A. Sharma', role: 'Mathematics', note: 'JEE ranker' }, { name: 'R. Bose', role: 'Mentorship', note: 'Counsellor' },
      ] },
      { type: 'stats', items: [{ value: '3,500+', label: 'Students' }, { value: '92%', label: 'Selection rate' }, { value: '15:1', label: 'Batch ratio' }, { value: '120+', label: 'Top ranks' }] },
      { type: 'testimonials', id: 'results', eyebrow: 'Outcomes', title: 'Students who made it', items: [
        { quote: 'The weekly tests and mentor calls kept me on track. Cleared with a great rank.', author: 'Aditya', note: 'JEE 2025' },
        { quote: 'Small batch meant my doubts were actually addressed.', author: 'Sara', note: 'NEET' },
        { quote: 'The upskilling cohort got me a promotion in 4 months.', author: 'Nikhil', note: 'Working pro' },
      ] },
      { type: 'faq', id: 'faq', eyebrow: 'Questions', title: 'Before you enrol', items: [
        { q: 'Are there demo classes?', a: 'Yes — book a free counselling call and a demo session.' },
        { q: 'Do you offer instalments?', a: 'Fees can be paid in instalments for most programs.' },
        { q: 'Online or offline?', a: 'Both — many batches are hybrid with recorded backups.' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Get started', title: 'Book a free counselling call', sub: 'Tell us your goal — we\'ll recommend the right batch.', points: ['Free counselling', 'Instalment options', 'Demo class included'], tabs: [bookTab('Counselling call', 'Book call'), enquire('Course enquiry')] },
    ],
  };
}

export function buildEducation(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { tagline: 'Where potential meets opportunity.', about: 'A future-ready institution with dedicated faculty, modern facilities and a track record of results — building confident, capable students.' });
  const courses = itemsFrom(site, [
    { title: 'Science Stream', subtitle: 'Class 11–12', desc: 'PCM / PCB with competitive-exam support.', image: IMG.education[1] },
    { title: 'Commerce Stream', subtitle: 'Class 11–12', desc: 'Accountancy, economics and business studies.', image: IMG.education[3] },
    { title: 'Undergraduate Programs', subtitle: 'Degrees', desc: 'Industry-aligned curricula with internships.', image: IMG.education[2] },
  ]);
  return {
    brand: b, theme: THEMES.education, choices: ['Science', 'Commerce', 'Arts', 'Undergraduate'], choiceLabel: 'Program',
    nav: nav(['#programs', 'Programs'], ['#courses', 'Courses'], ['#faculty', 'Faculty'], ['#campus', 'Campus']),
    primaryCta: { intent: 'engine.enquiry', label: 'Admission enquiry', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Admissions 2026 open', headline: b.tagline, subline: b.about, highlight: 'Expert faculty · Modern campus · Proven results', image: IMG.education[0] },
      { type: 'featureIndex', id: 'programs', eyebrow: 'Streams', title: 'Choose your path', items: [
        { label: 'Science', blurb: 'PCM/PCB with competitive-exam mentoring.' }, { label: 'Commerce', blurb: 'Finance, economics and business.' },
        { label: 'Arts & Humanities', blurb: 'Languages, psychology and social science.' }, { label: 'Degrees', blurb: 'Industry-aligned undergraduate programs.' },
      ] },
      { type: 'showcase', id: 'courses', variant: 'cards', eyebrow: 'Courses', title: 'Programs on offer', items: courses },
      { type: 'people', id: 'faculty', eyebrow: 'Faculty', title: 'Learn from the best', items: [
        { name: 'Dr. K. Menon', role: 'Principal', note: 'PhD Education' }, { name: 'Prof. L. Das', role: 'Physics', note: '18 yrs' },
        { name: 'Ms. R. Pillai', role: 'Commerce', note: 'CA, M.Com' }, { name: 'Mr. S. Roy', role: 'Placements', note: 'Career cell' },
      ] },
      { type: 'stats', items: [{ value: '30 yrs', label: 'Legacy' }, { value: '95%', label: 'Pass rate' }, { value: '50+', label: 'Faculty' }, { value: '100%', label: 'Placement help' }] },
      { type: 'gallery', id: 'campus', eyebrow: 'Campus', title: 'Life on campus', images: IMG.education },
      { type: 'faq', id: 'faq', eyebrow: 'Admissions', title: 'Admission FAQs', items: [
        { q: 'What is the admission process?', a: 'Submit an enquiry, attend a counselling session, then complete the application.' },
        { q: 'Are scholarships available?', a: 'Yes — merit and need-based scholarships are offered.' },
        { q: 'Is there transport?', a: 'Bus routes cover most of the city.' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Apply', title: 'Start your admission enquiry', sub: 'Tell us the program and we\'ll guide you through the next steps.', points: ['Scholarships available', 'Campus visits welcome', 'Placement support'], tabs: [enquire('Admission enquiry'), bookTab('Book a campus visit', 'Request visit')] },
    ],
  };
}

export function buildProfessional(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { tagline: 'Clear advice. Confident decisions.', about: 'A professional practice built on expertise and trust — giving individuals and businesses straight answers and dependable execution.' });
  const services = itemsFrom(site, [
    { title: 'Advisory & Consulting', desc: 'Strategy and problem-solving for your situation.', image: IMG.professional[0] },
    { title: 'Compliance & Filing', desc: 'Accurate, on-time and stress-free.', image: IMG.professional[1] },
    { title: 'Representation', desc: 'We stand for you where it matters.', image: IMG.professional[2] },
  ]);
  return {
    brand: b, theme: THEMES.professional, choices: ['Advisory', 'Compliance', 'Representation', 'Other'], choiceLabel: 'Service',
    nav: nav(['#services', 'Services'], ['#how', 'How we work'], ['#team', 'Team'], ['#reviews', 'Clients']),
    primaryCta: { intent: 'engine.enquiry', label: 'Book a consultation', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Trusted since day one', headline: b.tagline, subline: b.about, highlight: 'Senior expertise · Fixed fees · Confidential', image: IMG.professional[3] },
      { type: 'showcase', id: 'services', variant: 'cards', eyebrow: 'Practice', title: 'How we help', items: services },
      { type: 'steps', id: 'how', eyebrow: 'Working together', title: 'A simple engagement', items: [
        { title: 'Consultation', desc: 'Understand your needs.' }, { title: 'Proposal', desc: 'Clear scope and fixed fee.' },
        { title: 'Execution', desc: 'Handled end-to-end.' }, { title: 'Ongoing', desc: 'A partner you can call.' },
      ] },
      { type: 'people', id: 'team', eyebrow: 'The team', title: 'Senior people on your matter', items: [
        { name: 'A. Raghavan', role: 'Principal', note: '22 yrs' }, { name: 'S. Kulkarni', role: 'Associate', note: 'Compliance' },
        { name: 'P. Menon', role: 'Advisory', note: 'Strategy' }, { name: 'N. Das', role: 'Client success', note: 'Onboarding' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Clients', title: 'Trusted by businesses', items: [
        { quote: 'Straight answers, no jargon, and they always meet deadlines.', author: 'Founder, D2C brand' },
        { quote: 'Handled a complex matter calmly and got us the right outcome.', author: 'Managing Partner' },
        { quote: 'Fixed fees meant no surprises. Highly recommend.', author: 'SME owner' },
      ] },
      { type: 'faq', id: 'faq', eyebrow: 'Details', title: 'Questions clients ask', items: [
        { q: 'How are fees structured?', a: 'Mostly fixed-fee per engagement, agreed upfront.' },
        { q: 'Is the first call free?', a: 'Yes — the initial consultation is complimentary.' },
        { q: 'Do you work with startups?', a: 'Absolutely — from incorporation onwards.' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Get in touch', title: 'Book a consultation', sub: 'Tell us briefly what you need — the first call is on us.', points: ['Free first call', 'Fixed fees', 'Strict confidentiality'], tabs: [bookTab('Book a consultation', 'Request consultation'), enquire('Send a query')] },
    ],
  };
}

export function buildFinance(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { tagline: 'Grow and protect what you\'ve built.', about: 'Independent financial advice — investments, insurance and planning — aligned to your goals, not a product sheet.' });
  const services = itemsFrom(site, [
    { title: 'Wealth & Investments', desc: 'Goal-based portfolios, reviewed regularly.', image: IMG.finance[0] },
    { title: 'Insurance & Protection', desc: 'The right cover, no over-selling.', image: IMG.finance[1] },
    { title: 'Tax & Retirement Planning', desc: 'Keep more, worry less.', image: IMG.finance[2] },
  ]);
  return {
    brand: b, theme: THEMES.finance, choices: ['Investments', 'Insurance', 'Tax planning', 'Retirement'], choiceLabel: 'Service',
    nav: nav(['#services', 'Services'], ['#process', 'Process'], ['#advisors', 'Advisors'], ['#reviews', 'Clients']),
    primaryCta: { intent: 'engine.enquiry', label: 'Book a portfolio review', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Independent advice', headline: b.tagline, subline: b.about, highlight: 'Fee-only · Goal-based · Transparent', image: IMG.finance[3] },
      { type: 'showcase', id: 'services', variant: 'cards', eyebrow: 'Advisory', title: 'How we help you grow', items: services },
      { type: 'stats', items: [{ value: '₹800Cr+', label: 'Advised assets' }, { value: '1,200+', label: 'Families' }, { value: '18 yrs', label: 'Track record' }, { value: 'Fee-only', label: 'No commissions' }] },
      { type: 'steps', id: 'process', eyebrow: 'The process', title: 'Advice that\'s truly yours', items: [
        { title: 'Discover', desc: 'Your goals and risk profile.' }, { title: 'Plan', desc: 'A written, goal-based plan.' },
        { title: 'Invest', desc: 'Low-cost, diversified.' }, { title: 'Review', desc: 'Quarterly, and rebalance.' },
      ] },
      { type: 'people', id: 'advisors', eyebrow: 'Your team', title: 'Advisors, not sales agents', items: [
        { name: 'V. Sharma', role: 'CFP', note: 'Wealth' }, { name: 'R. Iyer', role: 'Insurance', note: 'Protection' },
        { name: 'M. Nair', role: 'Tax', note: 'CA' }, { name: 'K. Bose', role: 'Client success', note: 'Reviews' },
      ] },
      { type: 'faq', id: 'faq', eyebrow: 'Transparency', title: 'Fair questions', items: [
        { q: 'How do you get paid?', a: 'A transparent advisory fee — we don\'t earn product commissions.' },
        { q: 'What\'s the minimum?', a: 'We work with a range of portfolios; ask during your review.' },
        { q: 'Is my data safe?', a: 'Yes — strict confidentiality and secure systems.' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Start', title: 'Book a free portfolio review', sub: 'A no-obligation review of where you are and where you want to be.', points: ['Fee-only advice', 'No product push', 'Confidential'], tabs: [bookTab('Portfolio review', 'Book review'), enquire('Ask an advisor')] },
    ],
  };
}

export function buildDiagnostics(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { tagline: 'Accurate results, faster.', about: 'A NABL-standard diagnostic lab with home sample collection and reports on your phone — testing made simple and dependable.' });
  const tests = itemsFrom(site, [
    { title: 'Full Body Checkup', subtitle: '80+ parameters', price: '₹1,499', desc: 'Comprehensive annual screening.', image: IMG.diagnostics[0] },
    { title: 'Diabetes Panel', price: '₹599', desc: 'HbA1c, fasting & PP glucose.', image: IMG.diagnostics[1] },
    { title: 'Thyroid Profile', price: '₹499', desc: 'T3, T4, TSH with free retest.', image: IMG.diagnostics[2] },
    { title: 'Vitamin & Mineral', price: '₹1,199', desc: 'D3, B12, calcium and more.', image: IMG.diagnostics[3] },
  ]);
  return {
    brand: b, theme: THEMES.diagnostics, choices: ['Full body', 'Diabetes', 'Thyroid', 'Custom'], choiceLabel: 'Test / package',
    nav: nav(['#tests', 'Tests'], ['#why', 'Why us'], ['#how', 'How it works'], ['#reviews', 'Reviews']),
    primaryCta: { intent: 'engine.enquiry', label: 'Book a test', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Home collection available', headline: b.tagline, subline: b.about, highlight: 'NABL standards · Free home collection · Reports in 24h', image: IMG.diagnostics[0] },
      { type: 'showcase', id: 'tests', variant: 'cards', eyebrow: 'Popular', title: 'Tests & health packages', sub: 'Transparent pricing, no hidden charges.', items: tests },
      { type: 'iconGrid', id: 'why', eyebrow: 'Why us', title: 'Testing you can trust', items: [
        { label: 'NABL-standard lab', icon: 'ShieldCheck' }, { label: 'Free home collection', icon: 'HeartPulse' }, { label: 'Reports in 24 hours', icon: 'Clock' },
        { label: 'Digital reports', icon: 'Activity' }, { label: 'Free retest on flags', icon: 'Microscope' }, { label: 'Doctor call-back', icon: 'Stethoscope' },
      ] },
      { type: 'steps', id: 'how', eyebrow: 'Simple', title: 'How it works', items: [
        { title: 'Book', desc: 'Choose a test and slot.' }, { title: 'Sample', desc: 'We collect at home.' },
        { title: 'Process', desc: 'NABL-standard analysis.' }, { title: 'Report', desc: 'On your phone in 24h.' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Patients', title: 'Trusted by families', items: [
        { quote: 'Sample collected on time and report came the same evening.', author: 'Sunil' },
        { quote: 'The free retest on an abnormal value gave real peace of mind.', author: 'Rekha' },
        { quote: 'So easy for my elderly parents — no travel needed.', author: 'Amit' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Book', title: 'Book a test or home collection', sub: 'Pick a package and a slot — we confirm collection instantly.', points: ['Free home collection', 'Reports in 24h', 'NABL standards'], tabs: [bookTab('Book a test', 'Book test'), enquire('Ask about a test')] },
    ],
  };
}

export function buildPhotography(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { tagline: 'Moments, made to last.', about: 'A photography studio for the days you\'ll want to relive — weddings, portraits and brands, shot with a cinematic eye.' });
  const portfolio = itemsFrom(site, [
    { title: 'Weddings', image: IMG.photography[1] }, { title: 'Portraits', image: IMG.photography[2] },
    { title: 'Events', image: IMG.photography[3] }, { title: 'Brand & Product', image: IMG.photography[0] },
  ]);
  return {
    brand: b, theme: THEMES.photography, choices: ['Wedding', 'Portrait', 'Event', 'Brand'], choiceLabel: 'Shoot type',
    nav: nav(['#portfolio', 'Portfolio'], ['#packages', 'Packages'], ['#how', 'Process'], ['#reviews', 'Clients']),
    primaryCta: { intent: 'engine.enquiry', label: 'Check availability', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Now booking', headline: b.tagline, subline: b.about, highlight: 'Cinematic · Candid · Delivered fast', image: IMG.photography[0] },
      { type: 'showcase', id: 'portfolio', variant: 'tiles', eyebrow: 'Work', title: 'Selected work', items: portfolio },
      { type: 'showcase', id: 'packages', variant: 'menu', eyebrow: 'Packages', title: 'Shoot packages', sub: 'Custom packages available on request.', items: [
        { title: 'Wedding — Full Day', price: 'from ₹85,000', desc: 'Two shooters, album and film.' }, { title: 'Portrait Session', price: '₹9,999', desc: '1 hour, 20 edited images.' },
        { title: 'Event Coverage', price: 'from ₹15,000', desc: 'Half-day candid coverage.' }, { title: 'Brand / Product', price: 'from ₹12,000', desc: 'Studio or on-location.' },
      ] },
      { type: 'steps', id: 'how', eyebrow: 'Process', title: 'How we work', items: [
        { title: 'Enquire', desc: 'Share date and vision.' }, { title: 'Plan', desc: 'Moodboard and shotlist.' },
        { title: 'Shoot', desc: 'Relaxed, directed, fun.' }, { title: 'Deliver', desc: 'Edited gallery, fast.' },
      ] },
      { type: 'gallery', id: 'gallery', eyebrow: 'More', title: 'From recent shoots', images: IMG.photography },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Couples & clients', title: 'Kind words', items: [
        { quote: 'Every photo felt like a film still. We relive the day every time we look.', author: 'Neha & Arjun' },
        { quote: 'Made a very camera-shy me look completely natural.', author: 'Ishaan' },
        { quote: 'Product shots lifted our whole brand. Fast turnaround too.', author: 'Label owner' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Book', title: 'Check your date', sub: 'Tell us the shoot type and date — we\'ll confirm availability.', points: ['Fast delivery', 'Cinematic style', 'Custom packages'], tabs: [bookTab('Check availability', 'Check my date'), enquire('Ask about packages')] },
    ],
  };
}
