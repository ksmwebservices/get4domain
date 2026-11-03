// Category presets for Shop Lite (the 8 Ecommerce categories).
import { buildPreset } from '../../lib/preset-build.mjs';
import { presetsFrom } from '../shared/preset-content.mjs';

const FAQS = {
  en: [
    { q: 'How do I order?', a: 'Pick what you like and send us an enquiry or a WhatsApp message. We will confirm the price and the details with you.' },
    { q: 'Do you deliver?', a: 'Yes, in our area and, for many {label} items, further away. Ask us before you order and we will tell you the cost.' },
    { q: 'Can I return or exchange something?', a: 'Tell us within a few days if something is not right and we will help you with a return or an exchange.' },
    { q: 'How do I pay?', a: 'By UPI, cash on delivery where available, or bank transfer.' },
    { q: 'Are the products genuine?', a: 'Yes. Ask us for the bill and warranty details for anything you buy.' },
  ],
  ta: [
    { q: 'எப்படி ஆர்டர் செய்வது?', a: 'உங்களுக்குப் பிடித்ததைத் தேர்ந்தெடுத்து விசாரணை அல்லது வாட்ஸ்அப் செய்தி அனுப்புங்கள். விலையையும் விவரங்களையும் உறுதிப்படுத்துவோம்.' },
    { q: 'டெலிவரி செய்கிறீர்களா?', a: 'ஆம், எங்கள் பகுதியிலும், பல {label} பொருட்களுக்குத் தொலைவிலும். ஆர்டர் செய்யும் முன் கேளுங்கள், கட்டணத்தைச் சொல்வோம்.' },
    { q: 'திருப்பித் தரலாமா அல்லது மாற்றலாமா?', a: 'ஏதாவது சரியில்லை என்றால் சில நாட்களுக்குள் சொல்லுங்கள்; திருப்புதல் அல்லது மாற்றலில் உதவுவோம்.' },
    { q: 'எப்படிப் பணம் செலுத்துவது?', a: 'UPI, கிடைக்கும் இடங்களில் டெலிவரியில் ரொக்கம், அல்லது வங்கிப் பரிமாற்றம்.' },
    { q: 'பொருட்கள் உண்மையானவையா?', a: 'ஆம். நீங்கள் வாங்கும் எதற்கும் பில் மற்றும் உத்தரவாத விவரங்களைக் கேளுங்கள்.' },
  ],
};

const TABLE = {
  'fashion-apparel': { h: 332, s: 0.75, accentShift: 40, fonts: ['Poppins', 'DM Sans'], pattern: 'diagonal', blocks: 'keep', hidden: ['stats'] },
  jewellery: { h: 44, s: 0.7, accentShift: 20, fonts: ['Playfair Display', 'DM Sans'], pattern: 'rings', blocks: 'rotate', hidden: ['stats'] },
  'grocery-kirana': { h: 122, s: 0.65, accentShift: 35, fonts: ['Nunito', 'DM Sans'], pattern: 'dots', blocks: 'keep', hidden: [], order: ['highlights'] },
  'bakery-sweets': { h: 18, s: 0.75, accentShift: 30, fonts: ['Poppins', 'Nunito'], pattern: 'blobs', blocks: 'reverse', hidden: ['stats'] },
  'electronics-mobile': { h: 222, s: 0.75, accentShift: 35, fonts: ['Manrope', 'Inter'], pattern: 'grid', blocks: 'rotate', hidden: [] },
  'home-furniture': { h: 30, s: 0.55, accentShift: 25, fonts: ['Work Sans', 'Work Sans'], pattern: 'chevrons', blocks: 'keep', hidden: ['stats'] },
  'gifts-handicrafts': { h: 292, s: 0.6, accentShift: 45, fonts: ['Nunito', 'Poppins'], pattern: 'waves', blocks: 'reverse', hidden: [] },
  'books-stationery': { h: 206, s: 0.65, accentShift: 30, fonts: ['Merriweather', 'Work Sans'], pattern: 'rays', blocks: 'keep', hidden: ['stats'] },
};

export default presetsFrom(TABLE, FAQS, buildPreset);
