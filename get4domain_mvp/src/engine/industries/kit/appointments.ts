import type { EngineSiteData } from '../../types';
import type { KitSiteModel, EnquiryTab, BottomNavItem } from '../../kit/model';
import { THEMES } from '../../kit/themes';
import { brandFrom, itemsFrom, IMG } from '../../kit/content';

/**
 * Appointment / practitioner industries, built to the master-prompt reference
 * (Sections 12–24): exact demo business names, sample data + prices, hero
 * headline/CTA pairs, industry-specific bottom-nav label sets and section lists.
 * Each keeps its own theme; sub-categories vary content, not design.
 */

const nav = (...items: [string, string][]) => items.map(([href, label]) => ({ href, label }));
const bn = (label: string, icon: string, href: string, emphasis = false): BottomNavItem => ({ label, icon, href, emphasis });
const enquire = (label = 'Enquire'): EnquiryTab => ({ key: 'enquiry', label, icon: 'MessageSquare', action: { intent: 'engine.enquiry', label, kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel: 'Send enquiry' });
const bookTab = (label: string, submitLabel: string): EnquiryTab => ({ key: 'book', label, icon: 'CalendarCheck', action: { intent: 'engine.enquiry', label, kind: 'booking' }, fields: ['choice', 'date', 'message'], submitLabel });

/* ── CLINIC / HEALTHCARE — CareWell Clinic (§12) ── */
export function buildClinic(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'CareWell Clinic', tagline: 'Compassionate Care. Better Health.', about: 'Experienced doctors, clean facilities and same-day appointments — trusted, everyday care for the whole family.' });
  const services = itemsFrom(site, [
    { title: 'General Consultation', subtitle: 'OPD', price: '₹500', desc: 'Same-day appointments with experienced physicians.', image: IMG.clinic[1] },
    { title: 'Health Checkup', subtitle: 'Preventive', price: '₹1,500', desc: 'Comprehensive screening with a next-day report.', image: IMG.clinic[2] },
    { title: 'Dental Consultation', subtitle: 'Dental', price: '₹700', desc: 'Cleaning, fillings and specialist referrals.', image: IMG.clinic[3] },
  ]);
  return {
    brand: b, theme: THEMES.clinic, choices: ['General Physician', 'Specialist', 'Health Checkup', 'Dental'], choiceLabel: 'Department',
    nav: nav(['#services', 'Services'], ['#doctors', 'Doctors'], ['#packages', 'Packages'], ['#enquiry', 'Book']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Services', 'services', '#services'), bn('Doctors', 'users', '#doctors'), bn('Book', 'book', '#enquiry', true), bn('More', 'more', '#faq')],
    primaryCta: { intent: 'engine.enquiry', label: 'Book Appointment', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Appointments open today', headline: b.tagline, subline: b.about, highlight: 'Same-day appointments · Digital records · Insurance accepted', image: IMG.clinic[0],
        ctaPrimary: { label: 'Book Appointment', href: '#enquiry' }, ctaSecondary: { label: 'WhatsApp Us', href: '#enquiry' } },
      { type: 'stats', items: [{ value: '20+', label: 'Years of care' }, { value: '15k+', label: 'Patients treated' }, { value: '4.9★', label: 'Patient rating' }, { value: 'Same-day', label: 'Appointments' }] },
      { type: 'showcase', id: 'services', variant: 'cards', eyebrow: 'What we treat', title: 'Services & consultations', sub: 'Everyday care and specialist consultations under one roof.', items: services },
      { type: 'people', id: 'doctors', eyebrow: 'Our team', title: 'Meet the doctors', sub: 'Experienced, empathetic specialists.', items: [
        { name: 'Dr. Anjali Mehta', role: 'General Physician', note: 'MBBS, MD · 18 yrs' },
        { name: 'Dr. Rahul Nair', role: 'Consultant', note: 'MD · Internal Medicine' },
        { name: 'Dr. Farah Sheikh', role: 'Dermatologist', note: 'MD Dermatology' },
        { name: 'Dr. Ravi Menon', role: 'Dental Surgeon', note: 'BDS, MDS' },
      ] },
      { type: 'iconGrid', id: 'packages', eyebrow: 'Health packages', title: 'Preventive care packages', items: [
        { label: 'Full Body Checkup', icon: 'Activity', desc: '80+ parameters · ₹1,499' }, { label: 'Diabetes Care', icon: 'HeartPulse', desc: 'HbA1c + review · ₹899' },
        { label: 'Cardiac Screen', icon: 'Stethoscope', desc: 'ECG + lipid · ₹1,999' }, { label: 'Women\'s Wellness', icon: 'ShieldCheck', desc: 'Annual · ₹2,499' },
        { label: 'Vaccinations', icon: 'Syringe', desc: 'Adult & travel' }, { label: 'Dental Cleaning', icon: 'Sparkles', desc: 'Scaling & polish · ₹800' },
      ] },
      { type: 'rows', id: 'timings', eyebrow: 'Clinic information', title: 'Timings & location', note: 'Walk-ins welcome; booking means little to no wait.', items: [
        { label: 'Mon – Sat', value: '9am – 8pm' }, { label: 'Sunday', value: '9am – 1pm' }, { label: 'Emergency', value: '24×7 on call' }, { label: 'Parking', value: 'Available' },
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
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Book now', title: 'Book your appointment', sub: 'Choose a department and a time that suits you — we confirm within minutes.', points: ['Same-day slots', 'Experienced specialists', 'Digital reports'], tabs: [bookTab('Book Appointment', 'Request appointment'), enquire('Ask a question')] },
    ],
  };
}

/* ── BEAUTY PARLOUR / UNISEX SALON — Glow Beauty Parlour (§15–16) ── */
export function buildSalon(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'Glow Beauty Parlour', tagline: 'Look Good. Feel Confident.', about: 'A calm, premium studio for hair, skin and beauty — where skilled stylists and quiet luxury make every appointment feel like time for yourself.' });
  const services = itemsFrom(site, [
    { title: 'Haircut & Style', price: '₹350', desc: 'Consultation, wash, cut and finish.' },
    { title: 'Facial', subtitle: 'Glow', price: '₹900', desc: 'Deep-cleanse, mask and massage.' },
    { title: 'Bridal Package', subtitle: 'Signature', price: '₹6,500', desc: 'HD makeup, hair and draping; trial included.' },
    { title: 'Hair Spa', price: '₹1,200', desc: 'Nourishing treatment for soft, healthy hair.' },
  ]);
  return {
    brand: b, theme: THEMES.salon, choices: ['Hair', 'Facial', 'Bridal', 'Hair Spa'], choiceLabel: 'Service',
    nav: nav(['#services', 'Services'], ['#stylists', 'Stylists'], ['#gallery', 'Gallery'], ['#offers', 'Offers']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Services', 'services', '#services'), bn('Book', 'book', '#enquiry', true), bn('Offers', 'offers', '#offers'), bn('More', 'more', '#gallery')],
    primaryCta: { intent: 'engine.enquiry', label: 'Book Appointment', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'By appointment', headline: b.tagline, subline: b.about, highlight: 'Master stylists · Premium products · Advance booking', image: IMG.salon[0],
        ctaPrimary: { label: 'Book Appointment', href: '#enquiry' }, ctaSecondary: { label: 'View Services', href: '#services' } },
      { type: 'showcase', id: 'services', variant: 'menu', eyebrow: 'The menu', title: 'Services & pricing', sub: 'Transparent pricing. Every service starts with a consultation.', items: services },
      { type: 'people', id: 'stylists', eyebrow: 'The artists', title: 'Our stylists', items: [
        { name: 'Riya Kapoor', role: 'Creative Director', note: 'Colour specialist' }, { name: 'Sana Mirza', role: 'Senior Stylist', note: 'Bridal & updos' },
        { name: 'Aisha Verma', role: 'Skin Therapist', note: 'Advanced facials' }, { name: 'Neha Rao', role: 'Nail Artist', note: 'Gel & art' },
      ] },
      { type: 'gallery', id: 'gallery', eyebrow: 'Our work', title: 'Recent looks', images: IMG.salon },
      { type: 'iconGrid', id: 'offers', eyebrow: 'Offers & memberships', title: 'More reasons to glow', items: [
        { label: 'Bridal early-bird', icon: 'Sparkles', desc: '15% off 60 days ahead' }, { label: 'Monthly membership', icon: 'Gift', desc: 'Save on every visit' }, { label: 'Referral reward', icon: 'Users', desc: '₹200 credit' },
        { label: 'Premium brands', icon: 'Flower2' }, { label: 'Hygiene-first', icon: 'ShieldCheck' }, { label: 'Flexible timings', icon: 'Clock' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Guests', title: 'Loved by regulars', items: [
        { quote: 'Best colour I\'ve had in the city — and they remember exactly what I like.', author: 'Ananya' },
        { quote: 'My bridal look was flawless and lasted the whole day.', author: 'Pooja' },
        { quote: 'Calm, clean and never rushed. My monthly ritual.', author: 'Zara' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Reserve', title: 'Book your chair', sub: 'Tell us the service and a time — we\'ll confirm your stylist.', points: ['Master stylists', 'Premium products', 'Never rushed'], tabs: [bookTab('Book Appointment', 'Request booking'), enquire('Ask us')] },
    ],
  };
}

/* ── GYM & FITNESS — IronCore Fitness Studio (§17) ── */
export function buildGym(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'IronCore Fitness Studio', tagline: 'Train Better. Get Stronger.', about: 'A serious training floor with expert coaches, group energy and a plan for every body — whether you\'re starting out or chasing a PR.' });
  const programs = itemsFrom(site, [
    { title: 'Strength & Conditioning', subtitle: 'Coached', desc: 'Progressive programming, real results.', image: IMG.gym[1] },
    { title: 'Group HIIT', subtitle: 'High energy', desc: '45-minute fat-burning classes.', image: IMG.gym[2] },
    { title: 'Personal Training', subtitle: '1-on-1', desc: 'A coach in your corner, every session.', image: IMG.gym[3] },
  ]);
  return {
    brand: b, theme: THEMES.gym, choices: ['Monthly', 'Quarterly', 'Annual', 'Personal Training'], choiceLabel: 'Plan',
    nav: nav(['#programs', 'Programs'], ['#plans', 'Plans'], ['#schedule', 'Schedule'], ['#trainers', 'Trainers']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Programs', 'programs', '#programs'), bn('Join', 'join', '#enquiry', true), bn('Schedule', 'schedule', '#schedule'), bn('More', 'more', '#trainers')],
    primaryCta: { intent: 'engine.enquiry', label: 'Join Now', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'No excuses', headline: b.tagline, subline: b.about, highlight: 'Expert coaches · 24×7 access · First session free', image: IMG.gym[0],
        ctaPrimary: { label: 'Join Now', href: '#enquiry' }, ctaSecondary: { label: 'View Programs', href: '#programs' } },
      { type: 'stats', items: [{ value: '2,000+', label: 'Members' }, { value: '25', label: 'Classes / week' }, { value: '12', label: 'Coaches' }, { value: '24×7', label: 'Access' }] },
      { type: 'showcase', id: 'programs', variant: 'cards', eyebrow: 'Train', title: 'Programs for every goal', sub: 'Build strength, burn fat, or train for sport.', items: programs },
      { type: 'showcase', id: 'plans', variant: 'menu', eyebrow: 'Membership', title: 'Simple, honest plans', sub: 'No hidden joining fees.', items: [
        { title: 'Monthly', price: '₹1,499', desc: 'Full floor + group classes.' }, { title: 'Quarterly', subtitle: 'Popular', price: '₹3,999', desc: 'Save more + 1 PT session.' },
        { title: 'Annual', price: '₹11,999', desc: 'Best value + 6 PT sessions.' }, { title: 'Personal Training', price: 'from ₹6,000', desc: '8 coached sessions / month.' },
      ] },
      { type: 'steps', id: 'schedule', eyebrow: 'Weekly schedule', title: 'Classes through the week', items: [
        { title: 'Mon · HIIT', desc: '6am · 7pm' }, { title: 'Tue · Strength', desc: '6am · 7pm' }, { title: 'Wed · Mobility', desc: '7am · 6pm' }, { title: 'Sat · Bootcamp', desc: '7am' },
      ] },
      { type: 'people', id: 'trainers', eyebrow: 'Your corner', title: 'Meet the coaches', items: [
        { name: 'Arjun D.', role: 'Head Coach', note: 'Strength' }, { name: 'Sneha P.', role: 'HIIT Lead', note: 'Conditioning' },
        { name: 'Vikram S.', role: 'PT', note: 'Body recomposition' }, { name: 'Meghna R.', role: 'Mobility', note: 'Recovery' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Results', title: 'Real member results', items: [
        { quote: 'Down 12kg and stronger than I\'ve ever been. The coaching makes the difference.', author: 'Rohit' },
        { quote: 'The 6am HIIT crew keeps me accountable. Best decision this year.', author: 'Priya' },
        { quote: 'Clean equipment, real coaches, no ego. Love it.', author: 'Karan' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Join', title: 'Claim your free session', sub: 'Pick a plan or come try a class free — we\'ll set you up.', points: ['First session free', 'Coached from day one', 'Cancel anytime'], tabs: [bookTab('Free trial', 'Book free session'), enquire('Membership enquiry')] },
    ],
  };
}

/* ── COACHING — BrightPath Coaching Centre (§19) ── */
export function buildCoaching(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'BrightPath Coaching Centre', tagline: 'Learn. Improve. Achieve More.', about: 'Focused batches, expert faculty and a proven method — for students who want results, not just classes.' });
  const courses = itemsFrom(site, [
    { title: 'NEET Foundation', subtitle: 'Medical', price: 'from ₹45,000', desc: 'Concept-first teaching with weekly tests.', image: IMG.coaching[0] },
    { title: 'JEE Preparation', subtitle: 'Engineering', price: 'from ₹48,000', desc: 'Full syllabus, mocks and doubt-clearing.', image: IMG.coaching[2] },
    { title: 'Mathematics Tuition', subtitle: 'Class 9–12', price: 'from ₹1,200/mo', desc: 'Small groups, personal attention.', image: IMG.coaching[3] },
    { title: 'Spoken English', subtitle: 'Skilling', price: 'from ₹4,999', desc: 'Confidence and fluency, fast.', image: IMG.coaching[1] },
  ]);
  return {
    brand: b, theme: THEMES.coaching, choices: ['NEET Foundation', 'JEE Preparation', 'Mathematics Tuition', 'Spoken English'], choiceLabel: 'Course',
    nav: nav(['#courses', 'Courses'], ['#faculty', 'Faculty'], ['#batches', 'Batches'], ['#results', 'Results']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Courses', 'courses', '#courses'), bn('Enquiry', 'enquiry', '#enquiry', true), bn('Admission', 'admission', '#enquiry'), bn('More', 'more', '#results')],
    primaryCta: { intent: 'engine.enquiry', label: 'Enquire Now', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Admissions open', headline: b.tagline, subline: b.about, highlight: 'Small batches · Weekly tests · Doubt support', image: IMG.coaching[0],
        ctaPrimary: { label: 'View Courses', href: '#courses' }, ctaSecondary: { label: 'Enquire Now', href: '#enquiry' } },
      { type: 'showcase', id: 'courses', variant: 'cards', eyebrow: 'Programs', title: 'Courses & batches', sub: 'Structured tracks with clear milestones.', items: courses },
      { type: 'steps', id: 'batches', eyebrow: 'Our method', title: 'How you\'ll progress', items: [
        { title: 'Assessment', desc: 'We map your starting point.' }, { title: 'Focused batch', desc: 'Small groups, expert faculty.' },
        { title: 'Weekly tests', desc: 'Track and correct fast.' }, { title: 'Mentorship', desc: '1-on-1 guidance to the goal.' },
      ] },
      { type: 'people', id: 'faculty', eyebrow: 'Faculty', title: 'Mentors who care', items: [
        { name: 'Prof. S. Iyer', role: 'Physics', note: '20 yrs' }, { name: 'Dr. N. Gupta', role: 'Biology', note: 'NEET expert' },
        { name: 'A. Sharma', role: 'Mathematics', note: 'JEE ranker' }, { name: 'R. Bose', role: 'English', note: 'Communication' },
      ] },
      { type: 'stats', items: [{ value: '3,500+', label: 'Students' }, { value: '92%', label: 'Selection rate' }, { value: '15:1', label: 'Batch ratio' }, { value: '120+', label: 'Top ranks' }] },
      { type: 'testimonials', id: 'results', eyebrow: 'Outcomes', title: 'Students who made it', items: [
        { quote: 'The weekly tests and mentor calls kept me on track. Cleared with a great rank.', author: 'Aditya', note: 'JEE 2025' },
        { quote: 'Small batch meant my doubts were actually addressed.', author: 'Sara', note: 'NEET' },
        { quote: 'My spoken English improved in weeks. Interviews feel easy now.', author: 'Nikhil' },
      ] },
      { type: 'faq', id: 'faq', eyebrow: 'Questions', title: 'Before you enrol', items: [
        { q: 'Are there demo classes?', a: 'Yes — book a free counselling call and a demo session.' },
        { q: 'Do you offer instalments?', a: 'Fees can be paid in instalments for most programs.' },
        { q: 'Online or offline?', a: 'Both — many batches are hybrid with recorded backups.' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Get started', title: 'Admission enquiry', sub: 'Tell us your goal — we\'ll recommend the right batch and share a demo class.', points: ['Free counselling', 'Instalment options', 'Demo class included'], tabs: [enquire('Enquire Now'), bookTab('Book a counselling call', 'Book call')] },
    ],
  };
}

/* ── EDUCATION — BrightPath Academy (§19, school/college variant) ── */
export function buildEducation(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'BrightPath Academy', tagline: 'Learn. Improve. Achieve More.', about: 'A future-ready institution with dedicated faculty, modern facilities and a track record of results — building confident, capable students.' });
  const courses = itemsFrom(site, [
    { title: 'Science Stream', subtitle: 'Class 11–12', desc: 'PCM / PCB with competitive-exam support.', image: IMG.education[1] },
    { title: 'Commerce Stream', subtitle: 'Class 11–12', desc: 'Accountancy, economics and business studies.', image: IMG.education[3] },
    { title: 'Undergraduate Programs', subtitle: 'Degrees', desc: 'Industry-aligned curricula with internships.', image: IMG.education[2] },
  ]);
  return {
    brand: b, theme: THEMES.education, choices: ['Science', 'Commerce', 'Arts', 'Undergraduate'], choiceLabel: 'Program',
    nav: nav(['#programs', 'Programs'], ['#courses', 'Courses'], ['#faculty', 'Faculty'], ['#campus', 'Campus']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Courses', 'courses', '#courses'), bn('Enquiry', 'enquiry', '#enquiry', true), bn('Admission', 'admission', '#enquiry'), bn('More', 'more', '#campus')],
    primaryCta: { intent: 'engine.enquiry', label: 'Admission Enquiry', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Admissions 2026 open', headline: b.tagline, subline: b.about, highlight: 'Expert faculty · Modern campus · Proven results', image: IMG.education[0],
        ctaPrimary: { label: 'View Courses', href: '#courses' }, ctaSecondary: { label: 'Enquire Now', href: '#enquiry' } },
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
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Apply', title: 'Start your admission enquiry', sub: 'Tell us the program and we\'ll guide you through the next steps.', points: ['Scholarships available', 'Campus visits welcome', 'Placement support'], tabs: [enquire('Admission Enquiry'), bookTab('Book a campus visit', 'Request visit')] },
    ],
  };
}

/* ── PROFESSIONAL — FinTax Advisors (CA / Tax / GST, §23; Legal is a sub) ── */
export function buildProfessional(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'FinTax Advisors', tagline: 'Accounting & Tax, Simplified.', about: 'A professional practice built on expertise and trust — GST, income tax, accounting and compliance handled accurately and on time.' });
  const services = itemsFrom(site, [
    { title: 'GST Registration & Filing', desc: 'Registration, monthly returns and reconciliation.', image: IMG.professional[0] },
    { title: 'Income Tax & Advisory', desc: 'Personal and business tax, planning and filing.', image: IMG.professional[1] },
    { title: 'Accounting & Payroll', desc: 'Books, payroll and MIS you can rely on.', image: IMG.professional[2] },
  ]);
  return {
    brand: b, theme: THEMES.professional, choices: ['GST', 'Income Tax', 'Accounting', 'Payroll', 'Advisory'], choiceLabel: 'Service',
    nav: nav(['#services', 'Services'], ['#how', 'How we work'], ['#team', 'Team'], ['#reviews', 'Clients']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Services', 'services', '#services'), bn('Enquiry', 'enquiry', '#enquiry', true), bn('Contact', 'contact', '#enquiry'), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Book Consultation', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Trusted since day one', headline: b.tagline, subline: b.about, highlight: 'Senior expertise · Fixed fees · Confidential', image: IMG.professional[3],
        ctaPrimary: { label: 'Book Consultation', href: '#enquiry' }, ctaSecondary: { label: 'Enquire Now', href: '#enquiry' } },
      { type: 'showcase', id: 'services', variant: 'cards', eyebrow: 'Practice', title: 'How we help', items: services },
      { type: 'steps', id: 'how', eyebrow: 'Working together', title: 'A simple engagement', items: [
        { title: 'Consultation', desc: 'Understand your needs.' }, { title: 'Proposal', desc: 'Clear scope and fixed fee.' },
        { title: 'Execution', desc: 'Filed accurately, on time.' }, { title: 'Ongoing', desc: 'A partner you can call.' },
      ] },
      { type: 'people', id: 'team', eyebrow: 'The team', title: 'Senior people on your matter', items: [
        { name: 'A. Raghavan', role: 'CA, Principal', note: '22 yrs' }, { name: 'S. Kulkarni', role: 'GST Lead', note: 'Compliance' },
        { name: 'P. Menon', role: 'Tax Advisory', note: 'Planning' }, { name: 'N. Das', role: 'Client success', note: 'Onboarding' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Clients', title: 'Trusted by businesses', items: [
        { quote: 'Straight answers, no jargon, and they always meet deadlines.', author: 'Founder, D2C brand' },
        { quote: 'Handled our GST cleanly and got us the right refund.', author: 'Managing Partner' },
        { quote: 'Fixed fees meant no surprises. Highly recommend.', author: 'SME owner' },
      ] },
      { type: 'faq', id: 'faq', eyebrow: 'Details', title: 'Questions clients ask', items: [
        { q: 'How are fees structured?', a: 'Mostly fixed-fee per engagement, agreed upfront.' },
        { q: 'Is the first call free?', a: 'Yes — the initial consultation is complimentary.' },
        { q: 'Do you work with startups?', a: 'Absolutely — from incorporation onwards.' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Get in touch', title: 'Book a consultation', sub: 'Tell us briefly what you need — the first call is on us.', points: ['Free first call', 'Fixed fees', 'Strict confidentiality'], tabs: [bookTab('Book Consultation', 'Request consultation'), enquire('Send a query')] },
    ],
  };
}

/* ── FINANCE — PrimeLoan DSA Services (Loan & Mortgage / DSA, §21; Insurance is a sub) ── */
export function buildFinance(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'PrimeLoan DSA Services', tagline: 'The Right Loan, Made Simple.', about: 'A loan and mortgage consultancy that compares lenders for you — home, personal, business and vehicle loans, with honest guidance (no guaranteed approvals).' });
  const loans = itemsFrom(site, [
    { title: 'Home Loan', subtitle: 'Up to ₹5 Cr', desc: 'Best rates across 20+ lenders.', image: IMG.finance[0] },
    { title: 'Personal Loan', subtitle: 'Quick', desc: 'Minimal documents, fast processing.', image: IMG.finance[1] },
    { title: 'Business Loan', desc: 'Working capital and expansion.', image: IMG.finance[2] },
    { title: 'Vehicle Loan', desc: 'New and used, two & four wheeler.', image: IMG.finance[3] },
  ]);
  return {
    brand: b, theme: THEMES.finance, choices: ['Home Loan', 'Personal Loan', 'Business Loan', 'Vehicle Loan'], choiceLabel: 'Loan type',
    nav: nav(['#loans', 'Loans'], ['#eligibility', 'Eligibility'], ['#how', 'Process'], ['#reviews', 'Clients']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Loans', 'loans', '#loans'), bn('Eligibility', 'eligibility', '#eligibility'), bn('Enquiry', 'enquiry', '#enquiry', true), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Check Eligibility', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Loans made easy', headline: b.tagline, subline: b.about, highlight: '20+ lenders compared · Minimal documents · Free guidance', image: IMG.finance[3],
        ctaPrimary: { label: 'Check Eligibility', href: '#eligibility' }, ctaSecondary: { label: 'Enquire Now', href: '#enquiry' } },
      { type: 'showcase', id: 'loans', variant: 'cards', eyebrow: 'Loan products', title: 'Loans we arrange', items: loans },
      { type: 'iconGrid', id: 'eligibility', eyebrow: 'Eligibility & documents', title: 'What you\'ll need', items: [
        { label: 'ID & address proof', icon: 'ShieldCheck' }, { label: 'Income proof', icon: 'FileText' }, { label: 'Bank statements', icon: 'Landmark' },
        { label: 'Property papers', icon: 'Building2', desc: 'for home loans' }, { label: 'GST returns', icon: 'Percent', desc: 'for business' }, { label: 'A free eligibility check', icon: 'Activity' },
      ] },
      { type: 'steps', id: 'how', eyebrow: 'The process', title: 'From enquiry to disbursal', items: [
        { title: 'Enquiry', desc: 'Tell us your need.' }, { title: 'Eligibility', desc: 'We compare lenders.' },
        { title: 'Apply', desc: 'We handle the paperwork.' }, { title: 'Disbursal', desc: 'Track it to your account.' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Customers', title: 'Real approvals', items: [
        { quote: 'Got a better home-loan rate than my own bank offered. Smooth process.', author: 'Suresh' },
        { quote: 'Business loan sorted in a week with minimal running around.', author: 'Lakshmi' },
        { quote: 'They explained every charge upfront. No surprises.', author: 'Farhan' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Start', title: 'Check your eligibility', sub: 'Share a few details — we\'ll check eligibility and call you back. No obligation.', points: ['20+ lenders', 'Minimal documents', 'Honest guidance'], tabs: [enquire('Check Eligibility'), bookTab('Request a callback', 'Request callback')] },
    ],
  };
}

/* ── DIAGNOSTICS — Precise Diagnostics (healthcare-adjacent, §26 style) ── */
export function buildDiagnostics(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'Precise Diagnostics', tagline: 'Accurate Results, Faster.', about: 'A NABL-standard diagnostic lab with home sample collection and reports on your phone — testing made simple and dependable.' });
  const tests = itemsFrom(site, [
    { title: 'Full Body Checkup', subtitle: '80+ parameters', price: '₹1,499', desc: 'Comprehensive annual screening.', image: IMG.diagnostics[0] },
    { title: 'Diabetes Panel', price: '₹599', desc: 'HbA1c, fasting & PP glucose.', image: IMG.diagnostics[1] },
    { title: 'Thyroid Profile', price: '₹499', desc: 'T3, T4, TSH with free retest.', image: IMG.diagnostics[2] },
    { title: 'Vitamin & Mineral', price: '₹1,199', desc: 'D3, B12, calcium and more.', image: IMG.diagnostics[3] },
  ]);
  return {
    brand: b, theme: THEMES.diagnostics, choices: ['Full body', 'Diabetes', 'Thyroid', 'Custom'], choiceLabel: 'Test / package',
    nav: nav(['#tests', 'Tests'], ['#why', 'Why us'], ['#how', 'How it works'], ['#reviews', 'Reviews']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Tests', 'services', '#tests'), bn('Book', 'book', '#enquiry', true), bn('Reports', 'eligibility', '#how'), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Book a Test', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Home collection available', headline: b.tagline, subline: b.about, highlight: 'NABL standards · Free home collection · Reports in 24h', image: IMG.diagnostics[0],
        ctaPrimary: { label: 'Book a Test', href: '#enquiry' }, ctaSecondary: { label: 'WhatsApp Us', href: '#enquiry' } },
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
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Book', title: 'Book a test or home collection', sub: 'Pick a package and a slot — we confirm collection instantly.', points: ['Free home collection', 'Reports in 24h', 'NABL standards'], tabs: [bookTab('Book a Test', 'Book test'), enquire('Ask about a test')] },
    ],
  };
}

/* ── PHOTOGRAPHY — Frame & Focus Studio (media, §26 style) ── */
export function buildPhotography(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'Frame & Focus Studio', tagline: 'Moments, Beautifully Captured.', about: 'A photography studio for the days you\'ll want to relive — weddings, portraits and brands, shot with a cinematic eye.' });
  const portfolio = itemsFrom(site, [
    { title: 'Weddings', image: IMG.photography[1] }, { title: 'Portraits', image: IMG.photography[2] },
    { title: 'Events', image: IMG.photography[3] }, { title: 'Brand & Product', image: IMG.photography[0] },
  ]);
  return {
    brand: b, theme: THEMES.photography, choices: ['Wedding', 'Portrait', 'Event', 'Brand'], choiceLabel: 'Shoot type',
    nav: nav(['#portfolio', 'Portfolio'], ['#packages', 'Packages'], ['#how', 'Process'], ['#reviews', 'Clients']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Portfolio', 'gallery', '#portfolio'), bn('Book', 'book', '#enquiry', true), bn('Packages', 'services', '#packages'), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Check Availability', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Now booking', headline: b.tagline, subline: b.about, highlight: 'Cinematic · Candid · Delivered fast', image: IMG.photography[0],
        ctaPrimary: { label: 'Check Availability', href: '#enquiry' }, ctaSecondary: { label: 'View Portfolio', href: '#portfolio' } },
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
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Book', title: 'Check your date', sub: 'Tell us the shoot type and date — we\'ll confirm availability.', points: ['Fast delivery', 'Cinematic style', 'Custom packages'], tabs: [bookTab('Check Availability', 'Check my date'), enquire('Ask about packages')] },
    ],
  };
}
